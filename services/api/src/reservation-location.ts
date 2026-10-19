// TC-T04/TC-G01/TC-G03 remediation: V2 reservation checkpoint location (SYNTHETIC_LOCATION_V2, Proposed).
// Exact points stay off-chain and are purged after delete_after; the ledger receives only the summary below.
import type { Pool } from "pg";
import { ApiFailure } from "./errors.js";
import { sha256 } from "./hash.js";
import { captureSyntheticLocationEvidence, type LocationEvidence } from "./location-evidence.js";

export const RESERVATION_LOCATION_POLICY = "SYNTHETIC_LOCATION_V2" as const;
const FALLBACK_REASONS = ["DEVICE_UNAVAILABLE", "PERMISSION_DENIED", "SIGNAL_UNAVAILABLE"];
const LOCATION_KEYS = ["accuracyMetres", "capturedAt", "fallbackReason", "latitude", "longitude", "source"];

export type ReservationLocation = LocationEvidence<"DISPATCH" | "RECEIPT", typeof RESERVATION_LOCATION_POLICY>;
export type LocationSummary = Pick<ReservationLocation, "evidenceId" | "evidenceDigest" | "phase" | "capturedAt" | "source" | "facilityMatched" | "fallback" | "policyVersion">;

function invalid(): never { throw new ApiFailure(400, "INVALID_LOCATION_EVIDENCE", "Checkpoint location evidence is invalid."); }
const utc = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;

/** Validates the browser/device checkpoint input and derives the deterministic evidence ID from the command idempotency key. */
export function captureReservationLocation(value: unknown, input: { institutionId: string; reservationId: string; phase: "DISPATCH" | "RECEIPT"; idempotencyKey: string; eventTime: string }): ReservationLocation {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const location = value as Record<string, unknown>, keys = Object.keys(location).sort();
  if (keys.length !== LOCATION_KEYS.length || keys.some((key, index) => key !== LOCATION_KEYS[index])) invalid();
  if (typeof location.latitude !== "number" || typeof location.longitude !== "number" || typeof location.accuracyMetres !== "number") invalid();
  if (location.source !== "DEVICE" && location.source !== "FACILITY_FALLBACK") invalid();
  if (!(location.fallbackReason === null || FALLBACK_REASONS.includes(String(location.fallbackReason)))) invalid();
  if (!utc(location.capturedAt) || Date.parse(String(location.capturedAt)) > Date.parse(input.eventTime)) invalid();
  const evidenceId = "LOC_" + sha256({ reservationId: input.reservationId, idempotencyKey: input.idempotencyKey, phase: input.phase }).slice(0, 40).toUpperCase();
  return captureSyntheticLocationEvidence({ institutionId: input.institutionId, phase: input.phase, latitude: location.latitude, longitude: location.longitude, accuracyMetres: location.accuracyMetres, source: location.source, fallbackReason: location.fallbackReason as ReservationLocation["fallbackReason"], capturedAt: String(location.capturedAt) }, evidenceId, RESERVATION_LOCATION_POLICY);
}

export function locationSummary(evidence: ReservationLocation): LocationSummary {
  const { evidenceId, evidenceDigest, phase, capturedAt, source, facilityMatched, fallback, policyVersion } = evidence;
  return { evidenceId, evidenceDigest, phase, capturedAt, source, facilityMatched, fallback, policyVersion };
}

export interface ReservationLocationView {
  evidenceId: string; phase: "DISPATCH" | "RECEIPT"; institutionId: string; capturedAt: string; accuracyMetres: number;
  source: "DEVICE" | "FACILITY_FALLBACK"; fallbackReason: string | null; facilityMatched: boolean; evidenceDigest: string;
  coordinates: { latitude: number; longitude: number } | null; deleteAfter: string;
}

export interface ReservationLocationStore {
  record(reservationId: string, evidence: ReservationLocation): Promise<void>;
  list(reservationId: string): Promise<Array<ReservationLocationView & { coordinates: { latitude: number; longitude: number } }>>;
  purgeExpired(now: Date): Promise<number>;
}

export class PostgresReservationLocation implements ReservationLocationStore {
  constructor(private readonly pool: Pool) {}
  async record(reservationId: string, evidence: ReservationLocation): Promise<void> {
    // The evidence ID derives from the idempotency key, so a retried command records nothing new.
    await this.pool.query(`INSERT INTO app.v2_location_evidence(evidence_id,reservation_id,phase,institution_id,latitude,longitude,accuracy_metres,source,fallback_reason,facility_matched,captured_at,evidence_digest,policy_version,delete_after)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(evidence_id) DO NOTHING`,
      [evidence.evidenceId, reservationId, evidence.phase, evidence.institutionId, evidence.latitude, evidence.longitude, evidence.accuracyMetres, evidence.source, evidence.fallbackReason, evidence.facilityMatched, evidence.capturedAt, evidence.evidenceDigest, evidence.policyVersion, evidence.deleteAfter]);
  }
  async list(reservationId: string) {
    const rows = await this.pool.query<Record<string, unknown>>("SELECT * FROM app.v2_location_evidence WHERE reservation_id=$1 AND delete_after>now() ORDER BY captured_at,evidence_id", [reservationId]);
    return rows.rows.map(row => ({ evidenceId: String(row.evidence_id), phase: row.phase as "DISPATCH" | "RECEIPT", institutionId: String(row.institution_id), capturedAt: new Date(String(row.captured_at)).toISOString(), accuracyMetres: Number(row.accuracy_metres), source: row.source as "DEVICE" | "FACILITY_FALLBACK", fallbackReason: row.fallback_reason == null ? null : String(row.fallback_reason), facilityMatched: Boolean(row.facility_matched), evidenceDigest: String(row.evidence_digest), coordinates: { latitude: Number(row.latitude), longitude: Number(row.longitude) }, deleteAfter: new Date(String(row.delete_after)).toISOString() }));
  }
  async purgeExpired(now: Date): Promise<number> {
    return (await this.pool.query("DELETE FROM app.v2_location_evidence WHERE delete_after<=$1", [now])).rowCount ?? 0;
  }
}

/** Coordinates are shown only to the institution that captured the checkpoint; the other party sees the summary. */
export function scopeLocationView(rows: ReservationLocationView[], viewerInstitutionId: string): ReservationLocationView[] {
  return rows.map(row => row.institutionId === viewerInstitutionId ? row : { ...row, coordinates: null });
}
