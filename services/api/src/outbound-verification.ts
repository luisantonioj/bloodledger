import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { ApiFailure } from "./errors.js";
import { donationLookupHmac, type DonationKeyring } from "./donation-crypto.js";
import { isoTimestamp } from "./time.js";
import type { WebPrincipal } from "./session.js";
import { INTERVIEW_V2_1_COMPONENT_TYPES } from "./v2-contracts.js";

// ADR-047 OUTBOUND_LABEL_VERIFICATION_V1 (V2 below): an outbound scan proves each reserved unit's printed label before
// preparation. The server matches scanned Donation No. values to the reservation members by keyed lookup and
// issues EVD_ evidence for the existing PREPARE_RESERVATION command. No label value is stored or returned.
export const OUTBOUND_VERIFICATION_POLICY_VERSION = "OUTBOUND_LABEL_VERIFICATION_V1";
// J2: components of one donation share a Donation No., so V1 cannot tell a sibling bag from the reserved unit
// (finding F1). V2 pairs every scanned Donation No. with its OCR-read component; V1 bodies and results are frozen.
export const OUTBOUND_VERIFICATION_POLICY_VERSION_V2 = "OUTBOUND_LABEL_VERIFICATION_V2";
export type OutboundPolicyVersion = typeof OUTBOUND_VERIFICATION_POLICY_VERSION | typeof OUTBOUND_VERIFICATION_POLICY_VERSION_V2;
const MAX_LABELS = 50;
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

export interface ScannedLabel { donationNumber: string; componentType?: string }
export interface OutboundInput { policyVersion: OutboundPolicyVersion; expectedVersion: number; correlationId: string; scannedLabels: ScannedLabel[] }

export function parseOutboundInput(value: unknown): OutboundInput {
  const invalid = (message = "Outbound verification input is invalid.") => new ApiFailure(400, "OUTBOUND_VERIFICATION_INPUT_INVALID", message);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const body = value as Record<string, unknown>;
  // A body without policyVersion is the frozen V1 shape; V2 must name itself.
  const v2 = Object.hasOwn(body, "policyVersion");
  if (Object.keys(body).sort().join(",") !== (v2 ? "correlationId,expectedVersion,policyVersion,scannedLabels" : "correlationId,expectedVersion,scannedLabels")) throw invalid();
  if (v2 && body.policyVersion !== OUTBOUND_VERIFICATION_POLICY_VERSION_V2) throw invalid();
  if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) throw invalid();
  if (typeof body.correlationId !== "string" || !/^CORR_[0-9A-F]{32}$/.test(body.correlationId)) throw invalid();
  if (!Array.isArray(body.scannedLabels) || body.scannedLabels.length < 1 || body.scannedLabels.length > MAX_LABELS) throw invalid();
  const scannedLabels = body.scannedLabels.map((entry): ScannedLabel => {
    if (!v2) {
      if (typeof entry !== "string") throw invalid();
      return { donationNumber: entry };
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).sort().join(",") !== "componentType,donationNumber") throw invalid();
    const { donationNumber, componentType } = entry as Record<string, unknown>;
    if (typeof donationNumber !== "string") throw invalid();
    // A label whose component was not read is rejected; it is never matched on its Donation No. alone.
    if (typeof componentType !== "string" || !(INTERVIEW_V2_1_COMPONENT_TYPES as readonly string[]).includes(componentType)) throw invalid("Each scanned label needs its OCR-read component.");
    return { donationNumber, componentType };
  });
  const identities = scannedLabels.map((label) => `${label.donationNumber}|${label.componentType ?? ""}`);
  if (new Set(identities).size !== identities.length) throw new ApiFailure(400, "OUTBOUND_LABEL_DUPLICATE", "Each unit label may be scanned once.");
  return { policyVersion: v2 ? OUTBOUND_VERIFICATION_POLICY_VERSION_V2 : OUTBOUND_VERIFICATION_POLICY_VERSION, expectedVersion: Number(body.expectedVersion), correlationId: body.correlationId, scannedLabels };
}

// The matching identity: the keyed Donation No. lookup, plus the component under V2.
export function labelIdentity(policyVersion: OutboundPolicyVersion, lookupHmac: string, componentType?: string): string {
  return policyVersion === OUTBOUND_VERIFICATION_POLICY_VERSION ? lookupHmac : `${lookupHmac}|${componentType}`;
}

// V1 keeps its original digest so evidence issued before V2 still replays.
export function outboundRequestSha256(input: Pick<OutboundInput, "policyVersion" | "expectedVersion">, reservationId: string, scannedIdentities: readonly string[]): string {
  const labels = [...scannedIdentities].sort();
  return input.policyVersion === OUTBOUND_VERIFICATION_POLICY_VERSION
    ? sha({ reservationId, expectedVersion: input.expectedVersion, labels })
    : sha({ policyVersion: input.policyVersion, reservationId, expectedVersion: input.expectedVersion, labels });
}

// Exact set comparison; only counts are reported so a mismatch never discloses another unit's label.
export function compareLabels(memberIdentities: Map<string, string>, scannedIdentities: string[]) {
  const byIdentity = new Map([...memberIdentities].map(([componentId, identity]) => [identity, componentId]));
  const matched = scannedIdentities.filter((identity) => byIdentity.has(identity));
  return { expectedUnits: memberIdentities.size, matchedUnits: matched.length, unmatchedLabels: scannedIdentities.length - matched.length, missingUnits: memberIdentities.size - matched.length };
}

export class PostgresOutboundVerification {
  constructor(private readonly pool: Pool, private readonly keyring: DonationKeyring | undefined) {}

  async verify(principal: WebPrincipal, reservationId: string, value: unknown, idempotencyKey: string, now: Date) {
    if (!["ROLE-01", "ROLE-02"].includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Outbound verification requires a blood-bank inventory role.");
    if (!/^RES_[A-Z0-9_-]{1,56}$/.test(reservationId)) throw new ApiFailure(400, "V2_RESERVATION_ID_INVALID", "Reservation ID is invalid.");
    if (!/^IDEM_[A-Z0-9_-]{1,59}$/.test(idempotencyKey)) throw new ApiFailure(400, "INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key header is required.");
    const input = parseOutboundInput(value);
    if (!this.keyring) throw new ApiFailure(503, "V2_KEYS_UNAVAILABLE", "Donation lookup keys are not available.");
    let scanned: string[];
    try { scanned = input.scannedLabels.map((label) => labelIdentity(input.policyVersion, donationLookupHmac(label.donationNumber, this.keyring!), label.componentType)); }
    catch { throw new ApiFailure(400, "OUTBOUND_VERIFICATION_INPUT_INVALID", "A scanned label is not a valid Donation No."); }
    const requestSha256 = outboundRequestSha256(input, reservationId, scanned);
    const evidenceId = `EVD_${createHash("sha256").update(`${principal.userId}|${idempotencyKey}`, "utf8").digest("hex").slice(0, 40).toUpperCase()}`;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`outbound:${principal.userId}:${idempotencyKey}`]);
      const prior = await client.query<Record<string, unknown>>("SELECT * FROM app.v2_outbound_verifications WHERE verified_by=$1 AND idempotency_key=$2", [principal.userId, idempotencyKey]);
      if (prior.rows[0]) {
        await client.query("COMMIT");
        if (prior.rows[0].request_sha256 !== requestSha256) throw new ApiFailure(409, "OUTBOUND_VERIFICATION_IDEMPOTENCY_CONFLICT", "This request key was used for a different verification.");
        return present(prior.rows[0], true);
      }
      const reservation = await client.query<Record<string, unknown>>("SELECT reservation_id,status,version,institution_id,prepared_evidence_digest FROM app.v2_reservations WHERE reservation_id=$1 FOR SHARE", [reservationId]);
      const row = reservation.rows[0];
      // Only the source custody institution verifies its own outbound units; others see not found.
      if (!row || row.institution_id !== principal.institutionId) throw new ApiFailure(404, "V2_RESERVATION_NOT_FOUND", "The reservation was not found in the authorized scope.");
      if (Number(row.version) !== input.expectedVersion) throw new ApiFailure(409, "RESERVATION_VERSION_CONFLICT", "The reservation changed; refresh before verifying.");
      if (row.status !== "ACTIVE" || row.prepared_evidence_digest != null) throw new ApiFailure(409, "RESERVATION_TRANSITION_INVALID", "Only an unprepared active reservation can be verified.");
      const members = await client.query<Record<string, unknown>>("SELECT component_id,donation_number_lookup_hmac,component_type FROM app.v2_components WHERE reservation_id=$1 AND institution_id=$2 AND inventory_status='RESERVED' ORDER BY component_id", [reservationId, principal.institutionId]);
      if (members.rows.length === 0) throw new ApiFailure(409, "RESERVATION_TRANSITION_INVALID", "The reservation has no reserved units to verify.");
      const memberIdentities = new Map(members.rows.map((member) => [String(member.component_id), labelIdentity(input.policyVersion, String(member.donation_number_lookup_hmac), String(member.component_type))]));
      const comparison = compareLabels(memberIdentities, scanned);
      if (comparison.matchedUnits !== comparison.expectedUnits || comparison.unmatchedLabels !== 0) {
        throw new ApiFailure(409, "OUTBOUND_LABELS_MISMATCH", `Scanned labels do not match the reserved units: ${comparison.matchedUnits} of ${comparison.expectedUnits} matched, ${comparison.unmatchedLabels} unmatched, ${comparison.missingUnits} missing.`);
      }
      const componentIds = [...memberIdentities.keys()].sort();
      const evidenceDigest = sha({ policy: input.policyVersion, evidenceId, reservationId, reservationVersion: input.expectedVersion, componentIds, verifiedBy: principal.userId, verifiedAt: now.toISOString() });
      const inserted = await client.query<Record<string, unknown>>("INSERT INTO app.v2_outbound_verifications(evidence_id,reservation_id,reservation_version,institution_id,component_ids,request_sha256,evidence_digest,verified_by,verified_at,idempotency_key,correlation_id,policy_version,classification) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'SIMULATION_ONLY') RETURNING *",
        [evidenceId, reservationId, input.expectedVersion, principal.institutionId, JSON.stringify(componentIds), requestSha256, evidenceDigest, principal.userId, now, idempotencyKey, input.correlationId, input.policyVersion]);
      await client.query("COMMIT");
      return present(inserted.rows[0], false);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
}

function present(row: Record<string, unknown>, replayed: boolean) {
  const componentIds = Array.isArray(row.component_ids) ? row.component_ids.map(String) : JSON.parse(String(row.component_ids)) as string[];
  return {
    evidenceId: String(row.evidence_id),
    evidenceDigest: String(row.evidence_digest),
    reservationId: String(row.reservation_id),
    reservationVersion: Number(row.reservation_version),
    componentIds,
    matchedUnits: componentIds.length,
    verifiedAt: isoTimestamp(row.verified_at),
    replayed,
    ledger: { status: "NOT_APPLICABLE" as const },
    policyVersion: String(row.policy_version) as OutboundPolicyVersion,
    classification: "SIMULATION_ONLY" as const,
  };
}
