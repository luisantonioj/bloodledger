import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { ApiFailure } from "./errors.js";
import { donationLookupHmac, type DonationKeyring } from "./donation-crypto.js";
import { isoTimestamp } from "./time.js";
import type { WebPrincipal } from "./session.js";
import { INTERVIEW_V2_1_COMPONENT_TYPES } from "./v2-contracts.js";

// ADR-049 INBOUND_RECEIPT_LABEL_VERIFICATION_V1: before receipt, the destination scans every in-transit unit. Each
// scanned Donation No. and OCR-read component must match one reservation member exactly, so one label can no longer
// receive a whole reservation (finding F2). The server issues RCV_ evidence that `receive` then references. Only
// keyed-lookup digests and component IDs are stored; no stock is registered and nothing is written to the ledger.
export const RECEIPT_VERIFICATION_POLICY_VERSION = "INBOUND_RECEIPT_LABEL_VERIFICATION_V1";
export const RECEIPT_EVIDENCE_ID_PATTERN = /^RCV_[A-F0-9]{40}$/;
const MAX_LABELS = 50;
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

export interface ReceiptLabel { donationNumber: string; componentType: string }
export interface ReceiptInput { expectedVersion: number; correlationId: string; scannedLabels: ReceiptLabel[] }
export interface ReceiptEvidence { evidenceId: string; evidenceDigest: string; reservationId: string; reservationVersion: number; institutionId: string }

export function parseReceiptInput(value: unknown): ReceiptInput {
  const invalid = (message = "Receipt verification input is invalid.") => new ApiFailure(400, "RECEIPT_VERIFICATION_INPUT_INVALID", message);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const body = value as Record<string, unknown>;
  if (Object.keys(body).sort().join(",") !== "correlationId,expectedVersion,scannedLabels") throw invalid();
  if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) throw invalid();
  if (typeof body.correlationId !== "string" || !/^CORR_[0-9A-F]{32}$/.test(body.correlationId)) throw invalid();
  if (!Array.isArray(body.scannedLabels) || body.scannedLabels.length < 1 || body.scannedLabels.length > MAX_LABELS) throw invalid();
  const scannedLabels = body.scannedLabels.map((entry): ReceiptLabel => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).sort().join(",") !== "componentType,donationNumber") throw invalid();
    const { donationNumber, componentType } = entry as Record<string, unknown>;
    if (typeof donationNumber !== "string") throw invalid();
    // A label whose component was not read is rejected; it is never matched on its Donation No. alone.
    if (typeof componentType !== "string" || !(INTERVIEW_V2_1_COMPONENT_TYPES as readonly string[]).includes(componentType)) throw invalid("Each scanned label needs its OCR-read component.");
    return { donationNumber, componentType };
  });
  const identities = scannedLabels.map((label) => `${label.donationNumber}|${label.componentType}`);
  if (new Set(identities).size !== identities.length) throw new ApiFailure(400, "RECEIPT_LABEL_DUPLICATE", "Each unit label may be scanned once.");
  return { expectedVersion: Number(body.expectedVersion), correlationId: body.correlationId, scannedLabels };
}

// The matching identity is the keyed Donation No. lookup plus the component.
export const receiptIdentity = (lookupHmac: string, componentType: string) => `${lookupHmac}|${componentType}`;

// Exact set comparison; only counts are reported so a mismatch never discloses another unit's label.
export function compareReceiptLabels(memberIdentities: Map<string, string>, scannedIdentities: string[]) {
  const members = new Set(memberIdentities.values());
  const matched = scannedIdentities.filter((identity) => members.has(identity));
  return { expectedUnits: memberIdentities.size, matchedUnits: matched.length, unmatchedLabels: scannedIdentities.length - matched.length, missingUnits: memberIdentities.size - matched.length };
}

export class PostgresReceiptVerification {
  constructor(private readonly pool: Pool, private readonly keyring: DonationKeyring | undefined) {}

  async verify(principal: WebPrincipal, reservationId: string, value: unknown, idempotencyKey: string, now: Date) {
    if (!["ROLE-01", "ROLE-02", "ROLE-03"].includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Receipt verification requires a hospital receiving role.");
    if (!/^RES_[A-Z0-9_-]{1,56}$/.test(reservationId)) throw new ApiFailure(400, "V2_RESERVATION_ID_INVALID", "Reservation ID is invalid.");
    if (!/^IDEM_[A-Z0-9_-]{1,59}$/.test(idempotencyKey)) throw new ApiFailure(400, "INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key header is required.");
    const input = parseReceiptInput(value);
    if (!this.keyring) throw new ApiFailure(503, "V2_KEYS_UNAVAILABLE", "Donation lookup keys are not available.");
    let scanned: string[];
    try { scanned = input.scannedLabels.map((label) => receiptIdentity(donationLookupHmac(label.donationNumber, this.keyring!), label.componentType)); }
    catch { throw new ApiFailure(400, "RECEIPT_VERIFICATION_INPUT_INVALID", "A scanned label is not a valid Donation No."); }
    const requestSha256 = sha({ policyVersion: RECEIPT_VERIFICATION_POLICY_VERSION, reservationId, expectedVersion: input.expectedVersion, labels: [...scanned].sort() });
    const evidenceId = `RCV_${createHash("sha256").update(`${principal.userId}|${idempotencyKey}`, "utf8").digest("hex").slice(0, 40).toUpperCase()}`;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`receipt:${principal.userId}:${idempotencyKey}`]);
      const prior = await client.query<Record<string, unknown>>("SELECT * FROM app.v2_receipt_verifications WHERE verified_by=$1 AND idempotency_key=$2", [principal.userId, idempotencyKey]);
      if (prior.rows[0]) {
        await client.query("COMMIT");
        if (prior.rows[0].request_sha256 !== requestSha256) throw new ApiFailure(409, "RECEIPT_VERIFICATION_IDEMPOTENCY_CONFLICT", "This request key was used for a different verification.");
        return present(prior.rows[0], true);
      }
      const reservation = await client.query<Record<string, unknown>>("SELECT r.reservation_id,r.purpose,r.status,r.version,t.destination_institution_id FROM app.v2_reservations r LEFT JOIN app.v2_transfer_requests t ON t.transfer_id=r.transfer_id WHERE r.reservation_id=$1 FOR SHARE OF r", [reservationId]);
      const row = reservation.rows[0];
      // Only the destination institution verifies its incoming units; others, including the source, see not found.
      if (!row || row.destination_institution_id !== principal.institutionId) throw new ApiFailure(404, "V2_RESERVATION_NOT_FOUND", "The reservation was not found in the authorized scope.");
      if (Number(row.version) !== input.expectedVersion) throw new ApiFailure(409, "RESERVATION_VERSION_CONFLICT", "The reservation changed; refresh before verifying.");
      if (row.purpose !== "TRANSFER" || row.status !== "IN_TRANSIT") throw new ApiFailure(409, "RESERVATION_TRANSITION_INVALID", "Only an in-transit transfer can be verified for receipt.");
      const members = await client.query<Record<string, unknown>>("SELECT component_id,donation_number_lookup_hmac,component_type FROM app.v2_components WHERE reservation_id=$1 AND inventory_status='IN_TRANSIT' ORDER BY component_id", [reservationId]);
      if (members.rows.length === 0) throw new ApiFailure(409, "RESERVATION_TRANSITION_INVALID", "The reservation has no in-transit units to verify.");
      const memberIdentities = new Map(members.rows.map((member) => [String(member.component_id), receiptIdentity(String(member.donation_number_lookup_hmac), String(member.component_type))]));
      const comparison = compareReceiptLabels(memberIdentities, scanned);
      if (comparison.matchedUnits !== comparison.expectedUnits || comparison.unmatchedLabels !== 0) {
        throw new ApiFailure(409, "RECEIPT_LABELS_MISMATCH", `Scanned labels do not match the in-transit units: ${comparison.matchedUnits} of ${comparison.expectedUnits} matched, ${comparison.unmatchedLabels} unmatched, ${comparison.missingUnits} missing.`);
      }
      const componentIds = [...memberIdentities.keys()].sort();
      const evidenceDigest = sha({ policy: RECEIPT_VERIFICATION_POLICY_VERSION, evidenceId, reservationId, reservationVersion: input.expectedVersion, componentIds, verifiedBy: principal.userId, institutionId: principal.institutionId, verifiedAt: now.toISOString() });
      const inserted = await client.query<Record<string, unknown>>("INSERT INTO app.v2_receipt_verifications(evidence_id,reservation_id,reservation_version,institution_id,component_ids,request_sha256,evidence_digest,verified_by,verified_at,idempotency_key,correlation_id,policy_version,classification) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'SIMULATION_ONLY') RETURNING *",
        [evidenceId, reservationId, input.expectedVersion, principal.institutionId, JSON.stringify(componentIds), requestSha256, evidenceDigest, principal.userId, now, idempotencyKey, input.correlationId, RECEIPT_VERIFICATION_POLICY_VERSION]);
      await client.query("COMMIT");
      return present(inserted.rows[0], false);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async findEvidence(evidenceId: string): Promise<ReceiptEvidence | null> {
    const result = await this.pool.query<Record<string, unknown>>("SELECT evidence_id,evidence_digest,reservation_id,reservation_version,institution_id FROM app.v2_receipt_verifications WHERE evidence_id=$1", [evidenceId]);
    const row = result.rows[0];
    return row ? { evidenceId: String(row.evidence_id), evidenceDigest: String(row.evidence_digest), reservationId: String(row.reservation_id), reservationVersion: Number(row.reservation_version), institutionId: String(row.institution_id) } : null;
  }
}

// Evidence binds to one reservation, its version at verification, and the receiving institution.
export function assertReceiptEvidence(evidence: ReceiptEvidence | null, expected: { evidenceDigest: string; reservationId: string; expectedVersion: number; institutionId: string }): void {
  if (!evidence || evidence.evidenceDigest !== expected.evidenceDigest || evidence.reservationId !== expected.reservationId || evidence.reservationVersion !== expected.expectedVersion || evidence.institutionId !== expected.institutionId) {
    throw new ApiFailure(409, "RECEIPT_EVIDENCE_INVALID", "Receipt evidence does not match this reservation version; verify the units again.");
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
    policyVersion: RECEIPT_VERIFICATION_POLICY_VERSION,
    classification: "SIMULATION_ONLY" as const,
  };
}
