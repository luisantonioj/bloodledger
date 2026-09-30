import { requestJson } from "./client";
export const INVENTORY_EVIDENCE_SCHEMA = "BLOODLEDGER_INVENTORY_EVIDENCE_V1" as const;
export const INVENTORY_COMPONENTS = ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS", "CRYOPRECIPITATE"] as const;
export const INVENTORY_BLOOD_TYPES = ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"] as const;
export interface InventoryCount { bloodType: string; availableCount: number; reservedCount: number; forecastEligibleAvailableCount: number; reportableCount: number; }
export interface InventorySnapshot { snapshotId: string; institutionId: string; capturedAt: string; scheduledFor: string; schemaVersion: string; reportPolicyVersion: string; sourceProjectionDigest: string; projectionWatermark: number; coverage: "COMPLETE"; groups: { componentType: string; bloodTypes: InventoryCount[] }[]; }
export interface InventoryEvidence { schemaVersion: typeof INVENTORY_EVIDENCE_SCHEMA; institutionId: string; businessDate: string; evaluatedAt: string; evaluationDate: string; status: "CURRENT" | "STALE" | "UNAVAILABLE"; unavailableReason: string | null; snapshot: InventorySnapshot | null; }
function invalid(): never { throw new Error("INVENTORY_EVIDENCE_INVALID"); }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(); return value as Record<string, unknown>; }
function date(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
function utc(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
export function parseInventoryEvidence(value: unknown, businessDate: string, institutionId: string): InventoryEvidence {
  const body = object(value);
  if (body.schemaVersion !== INVENTORY_EVIDENCE_SCHEMA || body.institutionId !== institutionId || body.businessDate !== businessDate || !date(body.businessDate) || !date(body.evaluationDate) || !utc(body.evaluatedAt) || body.classification !== "SIMULATION_ONLY" || body.recommendationEligibility !== "DISABLED_UNAPPROVED_POLICY" || !["CURRENT", "STALE", "UNAVAILABLE"].includes(String(body.status))) return invalid();
  const evaluationDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(body.evaluatedAt));
  if (body.evaluationDate !== evaluationDate) return invalid();
  if (body.status === "UNAVAILABLE") {
    if (body.snapshot !== null || typeof body.unavailableReason !== "string" || !/^ML_SNAPSHOT_[A-Z_]+$/.test(body.unavailableReason)) return invalid();
    return body as unknown as InventoryEvidence;
  }
  if (body.unavailableReason !== null) return invalid();
  const snapshot = object(body.snapshot);
  if (snapshot.institutionId !== institutionId || snapshot.snapshotKind !== "INTERNAL_ML" || snapshot.schemaVersion !== "BLOODLEDGER_ML_INVENTORY_SNAPSHOT_V1" || snapshot.reportPolicyVersion !== "INTERVIEW_ML_INVENTORY_SNAPSHOT_V1" || snapshot.timezone !== "Asia/Manila" || snapshot.classification !== "SIMULATION_ONLY" || snapshot.coverage !== "COMPLETE" || snapshot.expectedSeries !== 40 || snapshot.persistedSeries !== 40 || typeof snapshot.snapshotId !== "string" || !/^CENSUS_[A-Z0-9_-]{1,56}$/.test(snapshot.snapshotId) || typeof snapshot.sourceProjectionDigest !== "string" || !/^[0-9a-f]{64}$/.test(snapshot.sourceProjectionDigest) || !Number.isSafeInteger(snapshot.projectionWatermark) || Number(snapshot.projectionWatermark) < 0 || !utc(snapshot.capturedAt) || !utc(snapshot.scheduledFor) || snapshot.scheduledFor > snapshot.capturedAt || snapshot.capturedAt > body.evaluatedAt || !Array.isArray(snapshot.groups) || snapshot.groups.length !== 5) return invalid();
  const componentKeys = new Set<string>();
  for (const value of snapshot.groups) {
    const group = object(value);
    if (!INVENTORY_COMPONENTS.includes(group.componentType as typeof INVENTORY_COMPONENTS[number]) || componentKeys.has(String(group.componentType)) || !Array.isArray(group.bloodTypes) || group.bloodTypes.length !== 8) return invalid();
    componentKeys.add(String(group.componentType));
    const bloodKeys = new Set<string>();
    for (const value of group.bloodTypes) {
      const row = object(value);
      if (!INVENTORY_BLOOD_TYPES.includes(row.bloodType as typeof INVENTORY_BLOOD_TYPES[number]) || bloodKeys.has(String(row.bloodType)) || [row.availableCount, row.reservedCount, row.forecastEligibleAvailableCount, row.reportableCount].some(value => !Number.isSafeInteger(value) || Number(value) < 0) || Number(row.forecastEligibleAvailableCount) > Number(row.availableCount) || row.reportableCount !== Number(row.availableCount) + Number(row.reservedCount)) return invalid();
      bloodKeys.add(String(row.bloodType));
    }
  }
  const capturedDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(snapshot.capturedAt));
  if (body.status !== (capturedDate === body.evaluationDate && businessDate === body.evaluationDate ? "CURRENT" : "STALE") || capturedDate > businessDate) return invalid();
  return body as unknown as InventoryEvidence;
}
export async function readInventoryEvidence(businessDate: string, institutionId: string): Promise<InventoryEvidence> {
  return parseInventoryEvidence(await requestJson<unknown>("/api/v2/analytics/inventory-evidence?businessDate=" + encodeURIComponent(businessDate)), businessDate, institutionId);
}
