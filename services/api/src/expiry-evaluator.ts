// TC-E05 remediation: scheduled off-chain expiry evaluation (ARCHITECTURE: scheduled expiry evaluation runs off-chain).
// The worker queues EVALUATE_COMPONENT_EXPIRY with server time as USR_SERVICE_EXPIRY (PA-TC-03, Accepted 2026-10-19); the chaincode
// still validates the printed label expiry, so nothing expires early. Only AVAILABLE stock is evaluated, matching the
// staff route: reserved stock must be cancelled first. One idempotency key per component and printed expiry.
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { V2CommandStore } from "./v2-command.js";

export const EXPIRY_SERVICE_ACTOR_ID = "USR_SERVICE_EXPIRY";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();

export interface ExpiryCandidate { componentId: string; institutionId: string; expiresAt: string; ledgerVersion: number; policyVersion: string }

export function expiryCommand(candidate: ExpiryCandidate, now: Date) {
  const idempotencyKey = `IDEM_EXPIRY_${hash(`${candidate.componentId}|${candidate.expiresAt}`).slice(0, 40)}`;
  const evaluationTime = now.toISOString();
  return {
    commandId: `CMD_${createHash("sha256").update(idempotencyKey, "utf8").digest("hex").slice(0, 40)}`,
    idempotencyKey, resourceType: "COMPONENT" as const, resourceId: candidate.componentId, operation: "EVALUATE_COMPONENT_EXPIRY",
    payload: { componentId: candidate.componentId, expectedVersion: candidate.ledgerVersion, evaluationTime, eventTime: evaluationTime, actorUserId: EXPIRY_SERVICE_ACTOR_ID, correlationId: `CORR_${hash(`expiry|${idempotencyKey}`).slice(0, 32)}`, policyVersion: candidate.policyVersion },
    correlationId: `CORR_${hash(`expiry|${idempotencyKey}`).slice(0, 32)}`, actorUserId: EXPIRY_SERVICE_ACTOR_ID, actorInstitutionId: candidate.institutionId, acceptedAt: evaluationTime,
  };
}

export class ScheduledExpiryEvaluator {
  private nextRun = 0;
  constructor(private readonly pool: Pool, private readonly store: Pick<V2CommandStore, "enqueue" | "get">, private readonly intervalMs = 60_000, private readonly batch = 20) {}

  async actorRegistered(): Promise<boolean> {
    return ((await this.pool.query("SELECT 1 FROM app.application_users WHERE user_id=$1", [EXPIRY_SERVICE_ACTOR_ID])).rowCount ?? 0) > 0;
  }

  async candidates(now: Date): Promise<ExpiryCandidate[]> {
    // Policy follows the component's own registration so the ledger asset and the command agree.
    const rows = await this.pool.query<Record<string, unknown>>(`SELECT c.component_id,c.institution_id,c.expires_at,c.ledger_version,
        COALESCE((SELECT k.payload->>'policyVersion' FROM app.v2_commands k WHERE k.resource_id=c.component_id AND k.operation IN ('REGISTER_INBOUND_COMPONENT','REGISTER_COMPONENT') AND k.status='COMMITTED' ORDER BY k.accepted_at LIMIT 1),'SYNTHETIC_INSTITUTION_CORE_V1') AS policy_version
      FROM app.v2_components c
      WHERE c.inventory_status='AVAILABLE' AND c.expires_at<=$1
        AND NOT EXISTS (SELECT 1 FROM app.v2_commands p WHERE p.resource_id=c.component_id AND p.operation='EVALUATE_COMPONENT_EXPIRY' AND p.status NOT IN ('COMMITTED','FAILED','CONFLICT'))
      ORDER BY c.expires_at,c.component_id LIMIT $2`, [now, this.batch]);
    return rows.rows.map(row => ({ componentId: String(row.component_id), institutionId: String(row.institution_id), expiresAt: new Date(String(row.expires_at)).toISOString(), ledgerVersion: Number(row.ledger_version), policyVersion: String(row.policy_version) }));
  }

  /** Returns the number of commands newly queued; a component whose key already exists is skipped. */
  async runDue(now: Date): Promise<number> {
    if (now.getTime() < this.nextRun) return 0;
    this.nextRun = now.getTime() + this.intervalMs;
    if (!(await this.actorRegistered())) return 0;
    let queued = 0;
    for (const candidate of await this.candidates(now)) {
      const command = expiryCommand(candidate, now);
      // The payload carries the evaluation time, so an existing key is left as recorded rather than re-sent.
      if (await this.store.get(command.commandId, command.actorInstitutionId, command.actorUserId)) continue;
      if (!(await this.store.enqueue(command)).replayed) queued++;
    }
    return queued;
  }
}
