import {V2_COMPONENT_TYPES,V2_BLOOD_TYPES} from "../../services/api/v2";
import type {CensusSnapshot} from "../../services/api/census-index";
export type StockGroup = { componentType: string; bloodTypes: { bloodType: string; availableCount: number; reservedCount: number; reportableCount: number }[] };
// FR-11/12: a captured census is not evidence of verification or regulatory approval.
export function parseComplianceStock(value: unknown, selected: CensusSnapshot): StockGroup[] {
  const row = value as Record<string, unknown> | null;
  if (!row || row.classification !== "SIMULATION_ONLY" || row.snapshotId !== selected.snapshotId || row.scheduledFor !== selected.scheduledFor || row.capturedAt !== selected.capturedAt || row.reportPolicyVersion !== selected.reportPolicyVersion || row.timezone !== "Asia/Manila" || !Array.isArray(row.groups) || !row.groups.length) throw Error("The selected report’s stock detail is unavailable.");
  const seen = new Set<string>();
  for (const group of row.groups as StockGroup[]) {
    if (!group || !V2_COMPONENT_TYPES.includes(group.componentType as typeof V2_COMPONENT_TYPES[number]) || seen.has(group.componentType) || !Array.isArray(group.bloodTypes) || group.bloodTypes.length !== 8 || new Set(group.bloodTypes.map(item => item.bloodType)).size !== 8) throw Error("The report’s component coverage is incomplete.");
    seen.add(group.componentType);
    for (const item of group.bloodTypes) {
      if (!V2_BLOOD_TYPES.includes(item.bloodType as typeof V2_BLOOD_TYPES[number]) || ![item.availableCount,item.reservedCount,item.reportableCount].every(count => Number.isSafeInteger(count) && count >= 0) || item.reportableCount !== item.availableCount + item.reservedCount) throw Error("The report’s stock counts are inconsistent.");
    }
  }
  return row.groups as StockGroup[];
}
