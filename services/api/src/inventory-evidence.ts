/** FR-14 / FR-12 / BR-ALG-07: permission-scoped, read-only synthetic stock evidence. */
import { V2_BLOOD_TYPES, V2_1_COMPONENT_TYPES } from "./census.js";
import { INTERNAL_ML_SNAPSHOT_POLICY_VERSION, INTERNAL_ML_SNAPSHOT_SCHEMA_VERSION, type MlInventorySnapshot } from "./census-worker.js";

export const INVENTORY_EVIDENCE_SCHEMA = "BLOODLEDGER_INVENTORY_EVIDENCE_V1" as const;
export interface MlInventoryEvidenceReader {
  latest(institutionId: string, before: Date): Promise<MlInventorySnapshot | null>;
}
export interface InventoryEvidence {
  schemaVersion: typeof INVENTORY_EVIDENCE_SCHEMA;
  institutionId: string;
  businessDate: string;
  evaluatedAt: string;
  evaluationDate: string;
  status: "CURRENT" | "STALE" | "UNAVAILABLE";
  unavailableReason: string | null;
  snapshot: (MlInventorySnapshot & { coverage: "COMPLETE"; expectedSeries: 40; persistedSeries: 40 }) | null;
  classification: "SIMULATION_ONLY";
  recommendationEligibility: "DISABLED_UNAPPROVED_POLICY";
}
export function manilaEvidenceDate(time: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(time);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}
export function validEvidenceDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validatePersistedMlCounts(rows: readonly Record<string, unknown>[]): void {
  const keys = new Set<string>();
  if (rows.length !== 40) throw new Error("ML_SNAPSHOT_COVERAGE_INVALID");
  for (const row of rows) {
    const key = `${row.component_type}:${row.blood_type}`;
    const counts = [row.available_count, row.reserved_count, row.forecast_eligible_available_count, row.reportable_count];
    if (!V2_1_COMPONENT_TYPES.includes(row.component_type as typeof V2_1_COMPONENT_TYPES[number]) ||
        !V2_BLOOD_TYPES.includes(row.blood_type as typeof V2_BLOOD_TYPES[number]) || keys.has(key) ||
        counts.some(value => typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) ||
        Number(row.forecast_eligible_available_count) > Number(row.available_count) ||
        Number(row.reportable_count) !== Number(row.available_count) + Number(row.reserved_count)) throw new Error("ML_SNAPSHOT_COUNTS_INVALID");
    keys.add(key);
  }
}
export async function readInventoryEvidence(reader: MlInventoryEvidenceReader, institutionId: string, businessDate: string, now: Date): Promise<InventoryEvidence> {
  const envelope: InventoryEvidence = { schemaVersion: INVENTORY_EVIDENCE_SCHEMA, institutionId, businessDate, evaluatedAt: now.toISOString(), evaluationDate: manilaEvidenceDate(now), status: "UNAVAILABLE", unavailableReason: "ML_SNAPSHOT_UNAVAILABLE", snapshot: null, classification: "SIMULATION_ONLY", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY" };
  const before = new Date(`${businessDate}T00:00:00.000+08:00`);
  before.setUTCDate(before.getUTCDate() + 1);
  let snapshot: MlInventorySnapshot | null;
  try { snapshot = await reader.latest(institutionId, before); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("ML_SNAPSHOT_")) return { ...envelope, unavailableReason: "ML_SNAPSHOT_INVALID" };
    throw error;
  }
  if (!snapshot) return envelope;
  const captured = new Date(snapshot.capturedAt);
  const scheduled = new Date(snapshot.scheduledFor);
  if (!Number.isFinite(captured.getTime()) || !Number.isFinite(scheduled.getTime()) ||
      captured.toISOString() !== snapshot.capturedAt || scheduled.toISOString() !== snapshot.scheduledFor ||
      captured >= before || scheduled > captured || snapshot.institutionId !== institutionId ||
      snapshot.snapshotKind !== "INTERNAL_ML" || snapshot.schemaVersion !== INTERNAL_ML_SNAPSHOT_SCHEMA_VERSION ||
      snapshot.reportPolicyVersion !== INTERNAL_ML_SNAPSHOT_POLICY_VERSION || snapshot.timezone !== "Asia/Manila" ||
      snapshot.classification !== "SIMULATION_ONLY" || !Number.isSafeInteger(snapshot.projectionWatermark) || snapshot.projectionWatermark < 0) return { ...envelope, unavailableReason: "ML_SNAPSHOT_INVALID" };
  if (captured > now) return { ...envelope, unavailableReason: "ML_SNAPSHOT_FUTURE_CAPTURED" };
  return { ...envelope, status: manilaEvidenceDate(captured) === envelope.evaluationDate && businessDate === envelope.evaluationDate ? "CURRENT" : "STALE", unavailableReason: null, snapshot: { ...snapshot, coverage: "COMPLETE", expectedSeries: 40, persistedSeries: 40 } };
}
