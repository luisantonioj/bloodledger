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

export interface StockSegment {
  band: StockBand | "unknown";
  start: number;
  end: number;
  range: string;
  explanation: string;
}
// Cumulative positions share endpoints geometrically; integer labels never overlap.
export function stockSegments(bloodType: string, componentType: string, confirmed: number, eligible: number | null): StockSegment[] {
  if (!Number.isSafeInteger(confirmed) || confirmed <= 0) return [];
  const limits = stockThresholds(bloodType, componentType);
  if (!limits || eligible === null || !Number.isSafeInteger(eligible) || eligible < 0) return [{band:"unknown",start:0,end:confirmed,range:"Unavailable",explanation:"Current eligible stock could not be verified for this component."}];
  const count = Math.min(confirmed, eligible);
  const definitions: StockSegment[] = [
    {band:"critical",start:0,end:limits.criticalMax,range:`0–${limits.criticalMax}`,explanation:"Lowest stock range in the project policy."},
    {band:"low",start:limits.criticalMax,end:limits.lowMax,range:`${limits.criticalMax+1}–${limits.lowMax}`,explanation:"Below the project's adequate stock range."},
    {band:"adequate",start:limits.lowMax,end:limits.adequateMax,range:`${limits.lowMax+1}–${limits.adequateMax}`,explanation:"Within the project's adequate stock range."},
    {band:"surplus",start:limits.adequateMax,end:count,range:`${limits.adequateMax+1}+`,explanation:"Above the project stock band; not transfer approval."},
  ];
  const segments = definitions.filter(row=>count>row.start).map(row=>({...row,end:Math.min(count,row.end)})).filter(row=>row.end>row.start);
  if (confirmed>count) segments.push({band:"unknown",start:count,end:confirmed,range:"Not eligible",explanation:"Confirmed units outside current eligible available stock; excluded from threshold colors."});
  return segments;
}
