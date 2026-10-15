import policy from "./policy/synthetic-stock-classification-v1.json";
import type { V2Component } from "../../services/api/v2";

export const stockClassificationPolicy = policy;
export type StockBand = "critical" | "low" | "adequate" | "surplus";
export function stockThresholds(bloodType: string, componentType: string) {
  return policy.series.find(row => row.bloodType === bloodType && row.componentType === componentType);
}
// FR-04: project-approved demonstration bands, never a redistribution authorization.
export function classifyStock(bloodType: string, componentType: string, count: number | null): StockBand | null {
  const limits = stockThresholds(bloodType, componentType);
  if (!limits || count === null || !Number.isSafeInteger(count) || count < 0) return null;
  return count <= limits.criticalMax ? "critical" : count <= limits.lowMax ? "low" : count <= limits.adequateMax ? "adequate" : "surplus";
}
export function eligibleStockCounts(components: V2Component[], institutionId: string, fetchedAt: number, now: number): Map<string, number> | null {
  if (!institutionId || !Number.isFinite(now) || !Number.isFinite(fetchedAt) || now < fetchedAt || now - fetchedAt > policy.maxReadAgeMs) return null;
  const ids = new Set<string>(), counts = new Map<string, number>();
  for (const row of components) {
    if (row.institutionId !== institutionId || ids.has(row.componentId) || !Number.isFinite(Date.parse(row.expiresAt))) return null;
    ids.add(row.componentId);
    if (row.inventoryStatus === "AVAILABLE" && row.expiryState === "CURRENT" && row.reservationId === null && Date.parse(row.expiresAt) > now) {
      const key = row.bloodType + ":" + row.componentType;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}
