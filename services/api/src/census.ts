export const V2_BLOOD_TYPES = ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"] as const;
import { createHash } from "node:crypto";

export const V2_COMPONENT_TYPES = ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS"] as const;
export const V2_1_COMPONENT_TYPES = [...V2_COMPONENT_TYPES, "CRYOPRECIPITATE"] as const;
export type V2BloodType = typeof V2_BLOOD_TYPES[number];
export type V2ComponentType = typeof V2_1_COMPONENT_TYPES[number];

export interface CensusInventoryRow { componentType: V2ComponentType; bloodType: V2BloodType; inventoryStatus: string; count: number; forecastEligibleCount?: number; }
export interface CensusBloodTypeCount { bloodType: V2BloodType; availableCount: number; reservedCount: number; forecastEligibleAvailableCount: number; reportableCount: number; }
export interface CensusGroup { componentType: V2ComponentType; bloodTypes: CensusBloodTypeCount[]; }
export interface CensusSnapshot { snapshotId: string; scheduledFor: string; capturedAt: string; timezone: "Asia/Manila"; reportPolicyVersion: string; sourceProjectionDigest: string; groups: CensusGroup[]; classification: "SIMULATION_ONLY"; }

export function buildCensusSnapshot(input: { snapshotId: string; scheduledFor: string; capturedAt: string; reportPolicyVersion: string; rows: readonly CensusInventoryRow[]; bloodTypeOrder?: readonly V2BloodType[]; componentTypes?: readonly V2ComponentType[]; sourceProjectionDigest?: string }): CensusSnapshot {
  const order = input.bloodTypeOrder ?? V2_BLOOD_TYPES;
  if (order.length !== V2_BLOOD_TYPES.length || new Set(order).size !== V2_BLOOD_TYPES.length || order.some((value) => !V2_BLOOD_TYPES.includes(value))) throw new Error("REPORT_POLICY_BLOOD_ORDER_INVALID");
  const componentTypes = input.componentTypes ?? V2_COMPONENT_TYPES;
  const groups = componentTypes.map((componentType) => ({ componentType, bloodTypes: order.map((bloodType) => {
    const matching = input.rows.filter((row) => row.componentType === componentType && row.bloodType === bloodType);
    const availableCount = matching.filter((row) => row.inventoryStatus === "AVAILABLE").reduce((sum, row) => sum + row.count, 0);
    const reservedCount = matching.filter((row) => row.inventoryStatus === "RESERVED").reduce((sum, row) => sum + row.count, 0);
    const forecastEligibleAvailableCount = matching.filter((row) => row.inventoryStatus === "AVAILABLE").reduce((sum, row) => sum + (row.forecastEligibleCount ?? row.count), 0);
    return { bloodType, availableCount, reservedCount, forecastEligibleAvailableCount, reportableCount: availableCount + reservedCount };
  }) }));
  const canonical = { snapshotId: input.snapshotId, scheduledFor: input.scheduledFor, timezone: "Asia/Manila", reportPolicyVersion: input.reportPolicyVersion, groups };
  const sourceProjectionDigest = input.sourceProjectionDigest ?? createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
  return { snapshotId: input.snapshotId, scheduledFor: input.scheduledFor, capturedAt: input.capturedAt, timezone: "Asia/Manila", reportPolicyVersion: input.reportPolicyVersion, sourceProjectionDigest, groups, classification: "SIMULATION_ONLY" };
}

function spreadsheetSafe(value: string): string { return /^[=+\-@]/.test(value) ? `'${value}` : value; }

export function censusTsv(snapshot: CensusSnapshot, componentType: V2ComponentType): string {
  const group = snapshot.groups.find((item) => item.componentType === componentType); if (!group) throw new Error("REPORT_COMPONENT_NOT_FOUND");
  const header = ["component_type", ...group.bloodTypes.map((item) => item.bloodType)];
  const values = [componentType, ...group.bloodTypes.map((item) => String(item.reportableCount))];
  return `${header.map(spreadsheetSafe).join("\t")}\r\n${values.map(spreadsheetSafe).join("\t")}\r\n`;
}

export function censusPolicyEnabled(order: readonly V2BloodType[] | undefined): boolean { return Array.isArray(order) && order.length === V2_BLOOD_TYPES.length && new Set(order).size === V2_BLOOD_TYPES.length && order.every((value) => V2_BLOOD_TYPES.includes(value)); }
