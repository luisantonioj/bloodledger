import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ApiFailure } from "./errors.js";
import { sha256 } from "./hash.js";
import { deriveVerifier, verifyPassword, type SessionClaims, type WebPrincipal } from "./session.js";
import { operatorPrincipal, type OperatorProfile } from "./institution-access.js";

export interface VerificationInput { operatorId: string; pin: string; action: string; payload: unknown; idempotencyKey: string }
export function allowedOperatorAction(principal: WebPrincipal, operator: OperatorProfile, action: string): boolean {
  if (operator.capabilityProfile === "PRC_REVIEWER" && action === "POST /api/v2/onboarding/operators") return principal.accountCategory === "PRC";
  if (operator.capabilityProfile === "INSTITUTION_ADMIN" && (action === "POST /api/v2/onboarding/operators" || /^POST \/api\/v2\/onboarding\/institutions\/[A-Z0-9_-]+\/profile$/.test(action))) return true;
  if (operator.capabilityProfile === "PRC_REVIEWER") return principal.accountCategory === "PRC" && /^POST \/api\/v2\/onboarding\/(invitations|applications\/[A-Z0-9_-]+\/(review|approve|reject|activate)|institutions\/[A-Z0-9_-]+\/(suspend|reactivate|profile|account)|operators\/[A-Z0-9_-]+\/(reset-pin|revoke))$/.test(action);
  if (operator.capabilityProfile === "INSTITUTION_ADMIN") return /^POST \/api\/v2\/onboarding\/operators\/[A-Z0-9_-]+\/(reset-pin|revoke)$/.test(action);
  if (operator.roleId === "ROLE-03") return action === "POST /api/v2/transfers" || /^POST \/api\/v2\/(transfers\/[A-Z0-9_-]+\/(cancellation|receipt|compromise)|reservations\/[A-Z0-9_-]+\/(receive|compromise|cancel))$/.test(action);
  if (operator.roleId !== "ROLE-01" && operator.roleId !== "ROLE-02") return false;
  if (action === "POST /api/v2/transfers") return operator.roleId === "ROLE-02";
  if (action === "POST /api/v2/reservations" || /^POST \/api\/v2\/transfers\/[A-Z0-9_-]+\/(approval|rejection|cancellation)$/.test(action)) return operator.roleId === "ROLE-02";
  return /^POST \/api\/v2\/(inbound-captures|local-releases|reconciliation|reconciliation\/[A-Z0-9_-]+\/resolve|components\/[A-Z0-9_-]+\/expiry|alerts\/[A-Z0-9_-]+\/acknowledge|reservations\/[A-Z0-9_-]+\/(prepare|dispatch|transit|receive|local-release-complete|cancel|compromise))$/.test(action);
}
export async function identityTransaction<T>(pool: Pool, action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await action(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
/** Recheck authority inside each off-chain write transaction, serialized with suspension. */
export async function lockActiveOperator(client: PoolClient, principal: WebPrincipal): Promise<void> {
  if (!principal.operatorId || !principal.accountId) return;
  const institution = await client.query("SELECT status FROM app.institutions WHERE institution_id=$1 FOR UPDATE",[principal.institutionId]);
  const actor = await client.query("SELECT 1 FROM app.institution_operators o JOIN app.application_users u ON u.user_id=o.account_id WHERE o.operator_id=$1 AND o.account_id=$2 AND o.status='ACTIVE' AND u.status='ACTIVE' AND o.version=$3 FOR UPDATE OF o,u",[principal.operatorId,principal.accountId,principal.operatorVersion]);
  const session=await client.query("SELECT 1 FROM app.application_sessions WHERE session_id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP FOR SHARE",[principal.verificationSessionId,principal.accountId]);
  if(!session.rows.length||institution.rows[0]?.status!=="ACTIVE" || !actor.rows.length)throw new ApiFailure(401,"AUTH_SESSION_REVOKED","Account authority has been revoked.");
}
export class PostgresOperatorVerification {
  constructor(readonly pool: Pool) {}
  async managed(): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 FROM app.institution_account_migrations WHERE status IN ('APPLIED','ROLLED_BACK') LIMIT 1");
    return result.rows.length > 0;
  }
  async verify(account: WebPrincipal, claims: SessionClaims, input: VerificationInput, now: Date) {
    if (!account.accountId || !/^USR_[A-Z0-9_-]{1,48}$/.test(input.operatorId) || !/^[0-9]{8}$/.test(input.pin) ||
      !/^IDEM_[A-Z0-9_-]{1,59}$/.test(input.idempotencyKey) || typeof input.action !== "string" || input.action.length > 256 || !input.payload || typeof input.payload !== "object")
      throw new ApiFailure(400, "OPERATOR_INPUT_INVALID", "Operator verification input is invalid.");
    const result = await identityTransaction(this.pool, async client => {
      // Institution serialization also prevents cross-session throttle races.
      await client.query("SELECT institution_id FROM app.institutions WHERE institution_id=$1 FOR UPDATE", [account.institutionId]);
      const active = await client.query("SELECT 1 FROM app.application_sessions WHERE session_id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>$3", [claims.sessionId, account.accountId, now]);
      if (!active.rows.length) return { error: "AUTH_SESSION_REVOKED" };
      for (const scope of [sha256({ institution: account.institutionId }), sha256({ session: claims.sessionId })]) {
        await client.query("INSERT INTO app.operator_attempt_windows(scope_digest,attempts,window_start) VALUES($1,0,$2) ON CONFLICT(scope_digest) DO NOTHING", [scope, now]);
        const window = await client.query<Record<string, unknown>>("SELECT attempts,window_start FROM app.operator_attempt_windows WHERE scope_digest=$1 FOR UPDATE", [scope]);
        const fresh = new Date(String(window.rows[0].window_start)).getTime() > now.getTime() - 900_000;
        if (fresh && Number(window.rows[0].attempts) >= 30) return { error: "OPERATOR_RATE_LIMITED" };
        await client.query("UPDATE app.operator_attempt_windows SET attempts=$2,window_start=$3 WHERE scope_digest=$1", [scope, fresh ? Number(window.rows[0].attempts) + 1 : 1, fresh ? window.rows[0].window_start : now]);
      }
      const records = await client.query<Record<string, unknown>>("SELECT * FROM app.institution_operators WHERE operator_id=$1 AND account_id=$2 AND institution_id=$3 AND status='ACTIVE' FOR UPDATE", [input.operatorId, account.accountId, account.institutionId]);
      const row = records.rows[0];
      if (!row) { await deriveVerifier(input.pin, "0".repeat(32)); return { error: "OPERATOR_VERIFICATION_FAILED" }; }
      if (row.locked_until && new Date(String(row.locked_until)) > now) return { error: "OPERATOR_PIN_LOCKED" };
      const profile: OperatorProfile = { operatorId: String(row.operator_id), roleId: String(row.role_id) as OperatorProfile["roleId"], capabilityProfile: String(row.capability_profile) as OperatorProfile["capabilityProfile"], version: Number(row.version) };
      const accepted = await verifyPassword(input.pin, { saltHex: String(row.pin_salt), verifierHex: String(row.pin_verifier) } as Parameters<typeof verifyPassword>[1]);
      if (!accepted) {
        const failed = row.locked_until ? 1 : Number(row.failed_attempts) + 1;
        await client.query("UPDATE app.institution_operators SET failed_attempts=$2,locked_until=$3 WHERE operator_id=$1", [input.operatorId, failed, failed >= 5 ? new Date(now.getTime() + 900_000) : null]);
        return { error: failed >= 5 ? "OPERATOR_PIN_LOCKED" : "OPERATOR_VERIFICATION_FAILED" };
      }
      if (!allowedOperatorAction(account, profile, input.action)) return { error: "AUTH_SCOPE_FORBIDDEN" };
      await client.query("UPDATE app.institution_operators SET failed_attempts=0,locked_until=NULL WHERE operator_id=$1", [input.operatorId]);
      const collision=await client.query("SELECT 1 FROM app.operator_verifications WHERE account_id=$1 AND operator_id=$2 AND action=$3 AND idempotency_key=$4 AND payload_sha256<>$5 LIMIT 1",[account.accountId,input.operatorId,input.action,input.idempotencyKey,sha256(input.payload)]);
      if(collision.rows.length)return {error:"OPERATOR_BINDING_CONFLICT"};
      const verificationId = `VFY_${randomBytes(20).toString("hex").toUpperCase()}`;
      const expiresAt = new Date(now.getTime() + 120_000);
      await client.query("INSERT INTO app.operator_verifications(verification_id,account_id,session_id,operator_id,operator_version,institution_id,action,payload_sha256,idempotency_key,issued_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [verificationId, account.accountId, claims.sessionId, input.operatorId, profile.version, account.institutionId, input.action, sha256(input.payload), input.idempotencyKey, now, expiresAt]);
      return { verificationId, expiresAt: expiresAt.toISOString(), operatorId: input.operatorId, action: input.action };
    });
    if ("error" in result) throw new ApiFailure(result.error === "AUTH_SESSION_REVOKED" ? 401 : result.error === "AUTH_SCOPE_FORBIDDEN" ? 403 : result.error === "OPERATOR_BINDING_CONFLICT" ? 409 : 429, result.error!, "Operator verification was not accepted.");
    return { ...result, classification: "SIMULATION_ONLY" };
  }
  async consume(account: WebPrincipal, claims: SessionClaims, verificationId: unknown, action: string, payload: unknown, idempotencyKey: unknown, now: Date): Promise<WebPrincipal> {
    if (typeof verificationId !== "string" || !/^VFY_[0-9A-F]{40}$/.test(verificationId)) throw new ApiFailure(403, "OPERATOR_VERIFICATION_REQUIRED", "A bound operator verification is required.");
    return identityTransaction(this.pool, async client => {
      const result = await client.query<Record<string, unknown>>(`SELECT v.*,o.role_id,o.capability_profile,o.version AS current_version,o.status AS operator_status FROM app.operator_verifications v JOIN app.institution_operators o ON o.operator_id=v.operator_id WHERE v.verification_id=$1 FOR UPDATE OF v`, [verificationId]);
      const row = result.rows[0];
      if (!row || row.account_id !== account.accountId || row.session_id !== claims.sessionId || row.institution_id !== account.institutionId || row.action !== action || row.payload_sha256 !== sha256(payload) || row.idempotency_key !== idempotencyKey || row.revoked_at || row.operator_status !== "ACTIVE" || Number(row.operator_version) !== Number(row.current_version)) throw new ApiFailure(403, "OPERATOR_VERIFICATION_INVALID", "Operator verification does not authorize this command.");
      if (!row.consumed_at && new Date(String(row.expires_at)) <= now) throw new ApiFailure(403, "OPERATOR_VERIFICATION_EXPIRED", "Operator verification has expired.");
      const profile: OperatorProfile = { operatorId: String(row.operator_id), roleId: String(row.role_id) as OperatorProfile["roleId"], capabilityProfile: String(row.capability_profile) as OperatorProfile["capabilityProfile"], version: Number(row.current_version) };
      if (!allowedOperatorAction(account, profile, action)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Operator capability is not permitted.");
      await client.query("UPDATE app.operator_verifications SET consumed_at=COALESCE(consumed_at,$2) WHERE verification_id=$1", [verificationId, now]);
      return {...operatorPrincipal(account, profile),operatorVersion:profile.version,verificationSessionId:claims.sessionId};
    });
  }
}
