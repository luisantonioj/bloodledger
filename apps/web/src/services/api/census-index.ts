import type { Principal } from "../../auth/permissions";
import { requestJson } from "./client";
export const CENSUS_ORDER = ["O_POSITIVE", "A_POSITIVE", "B_POSITIVE", "AB_POSITIVE", "O_NEGATIVE", "A_NEGATIVE", "B_NEGATIVE", "AB_NEGATIVE"] as const;
export interface CensusSnapshot { snapshotId: string; institutionId: string; scheduledFor: string; capturedAt: string; reportPolicyVersion: string; triggerType: string }
export interface CensusIndex { scope: string; snapshots: CensusSnapshot[]; nextCursor: string | null; displayBloodTypeOrder: readonly string[]; displayPolicyVersion: string; reportAvailability: string }
export function parseCensusIndex(value: unknown, principal: Principal): CensusIndex {
  const row = value as Record<string, unknown> | null;
  const invalid = () => new Error("Census discovery is incomplete or outside the authorized scope.");
  const scope = principal.roleId === "ROLE-04" ? "REGULATORY_AGGREGATE" : "INSTITUTION";
  if (!row || row.scope !== scope || row.classification !== "SIMULATION_ONLY" || row.displayPolicyVersion !== "DOH_CENSUS_COLUMN_ORDER_V1" ||
      JSON.stringify(row.displayBloodTypeOrder) !== JSON.stringify(CENSUS_ORDER) || row.totalColumn !== "CALCULATED" ||
      typeof row.exportAvailable !== "boolean" || row.reportAvailability !== (row.exportAvailable ? "EXPORT_AVAILABLE" : "EXPORT_DISABLED_PENDING_FORMAT") ||
      !Array.isArray(row.snapshots) || (row.nextCursor !== null && (typeof row.nextCursor !== "string" || !/^CENSUS_[A-Z0-9_-]{1,56}$/.test(row.nextCursor)))) throw invalid();
  const snapshots = row.snapshots.map((item: unknown) => {
    const snapshot = item as Record<string, unknown> | null;
    if (!snapshot || snapshot.classification !== "SIMULATION_ONLY" || !["snapshotId", "institutionId", "scheduledFor", "capturedAt", "reportPolicyVersion", "triggerType"].every(key => typeof snapshot[key] === "string" && snapshot[key]) ||
        !/^CENSUS_[A-Z0-9_-]{1,56}$/.test(String(snapshot.snapshotId)) || !Number.isFinite(Date.parse(String(snapshot.scheduledFor))) || !Number.isFinite(Date.parse(String(snapshot.capturedAt))) ||
        (scope === "INSTITUTION" && snapshot.institutionId !== principal.institutionId)) throw invalid();
    return snapshot as unknown as CensusSnapshot;
  });
  if (new Set(snapshots.map(snapshot => snapshot.snapshotId)).size !== snapshots.length) throw invalid();
  return {scope, snapshots, nextCursor:row.nextCursor as string | null, displayBloodTypeOrder:CENSUS_ORDER, displayPolicyVersion:row.displayPolicyVersion, reportAvailability:row.reportAvailability as string};
}
export async function readCensusIndex(principal: Principal, signal: AbortSignal, cursor?: string): Promise<CensusIndex> {
  if (cursor && !/^CENSUS_[A-Z0-9_-]{1,56}$/.test(cursor)) throw new Error("Census cursor is invalid.");
  return parseCensusIndex(await requestJson("/api/v2/reports/doh-census?limit=20" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), {signal}, "Census snapshots are unavailable."), principal);
}
