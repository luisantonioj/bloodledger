export const V2_BLOOD_TYPES = ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"] as const;
export const V2_COMPONENT_TYPES = ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS"] as const;
export type V2BloodType = typeof V2_BLOOD_TYPES[number];
export type V2ComponentType = typeof V2_COMPONENT_TYPES[number];

export interface CensusInventoryRow { componentType: V2ComponentType; bloodType: V2BloodType; inventoryStatus: string; count: number; }
export interface CensusBloodTypeCount { bloodType: V2BloodType; availableCount: number; reservedCount: number; reportableCount: number; }
export interface CensusGroup { componentType: V2ComponentType; bloodTypes: CensusBloodTypeCount[]; }
export interface CensusSnapshot { snapshotId: string; scheduledFor: string; capturedAt: string; timezone: "Asia/Manila"; reportPolicyVersion: string; groups: CensusGroup[]; classification: "SIMULATION_ONLY"; }

export function buildCensusSnapshot(input: { snapshotId: string; scheduledFor: string; capturedAt: string; reportPolicyVersion: string; rows: readonly CensusInventoryRow[]; bloodTypeOrder?: readonly V2BloodType[] }): CensusSnapshot {
  const order = input.bloodTypeOrder ?? V2_BLOOD_TYPES;
  if (order.length !== V2_BLOOD_TYPES.length || new Set(order).size !== V2_BLOOD_TYPES.length || order.some((value) => !V2_BLOOD_TYPES.includes(value))) throw new Error("REPORT_POLICY_BLOOD_ORDER_INVALID");
  const groups = V2_COMPONENT_TYPES.map((componentType) => ({ componentType, bloodTypes: order.map((bloodType) => {
    const matching = input.rows.filter((row) => row.componentType === componentType && row.bloodType === bloodType);
    const availableCount = matching.filter((row) => row.inventoryStatus === "AVAILABLE").reduce((sum, row) => sum + row.count, 0);
    const reservedCount = matching.filter((row) => row.inventoryStatus === "RESERVED").reduce((sum, row) => sum + row.count, 0);
    return { bloodType, availableCount, reservedCount, reportableCount: availableCount + reservedCount };
  }) }));
  return { snapshotId: input.snapshotId, scheduledFor: input.scheduledFor, capturedAt: input.capturedAt, timezone: "Asia/Manila", reportPolicyVersion: input.reportPolicyVersion, groups, classification: "SIMULATION_ONLY" };
}

function spreadsheetSafe(value: string): string { return /^[=+\-@]/.test(value) ? `'${value}` : value; }

export function censusTsv(snapshot: CensusSnapshot, componentType: V2ComponentType): string {
  const group = snapshot.groups.find((item) => item.componentType === componentType); if (!group) throw new Error("REPORT_COMPONENT_NOT_FOUND");
  const header = ["component_type", ...group.bloodTypes.map((item) => item.bloodType)];
  const values = [componentType, ...group.bloodTypes.map((item) => String(item.reportableCount))];
  return `${header.map(spreadsheetSafe).join("\t")}\r\n${values.map(spreadsheetSafe).join("\t")}\r\n`;
}

export function censusPolicyEnabled(order: readonly V2BloodType[] | undefined): boolean { return Array.isArray(order) && order.length === V2_BLOOD_TYPES.length && new Set(order).size === V2_BLOOD_TYPES.length && order.every((value) => V2_BLOOD_TYPES.includes(value)); }
