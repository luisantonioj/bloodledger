import { createHash } from "node:crypto";

export const HISTORICAL_VERSION = "HISTORICAL_SYNTHETIC_INVENTORY_V1";
export const HISTORICAL_ACTOR = "USR_SYNTH_HISTORICAL_IMPORT";
export const HISTORICAL_BLOOD_TYPES = ["A_POSITIVE", "B_POSITIVE", "O_POSITIVE", "AB_POSITIVE"];
export const HISTORICAL_COMPONENT_TYPES = ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS", "CRYOPRECIPITATE"];
export interface HistoricalCount { bloodType: string; componentType: string; available: number; reserved: number; closing: number; }
export interface HistoricalSource { workbookSha256: string; businessDate: string; counts: HistoricalCount[]; }
export interface HistoricalUnit { componentId: string; seriesKey: string; snapshotStatus: "AVAILABLE" | "RESERVED"; allocationGroupId: string | null; collectedAt: null; expiresAt: null; donationNumber: null; originalReservationPurpose: null; }
export interface HistoricalManifest extends HistoricalSource { version: string; datasetVersion: string; sourceInstitutionId: string; classification: string; provenance: string; snapshotId: string; units: HistoricalUnit[]; manifestSha256: string; }
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}
export function historicalDigest(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
export function makeHistoricalManifest(source: HistoricalSource): HistoricalManifest {
  if (!source || !/^[0-9a-f]{64}$/.test(source.workbookSha256) || !/^202[3-6]-\d{2}-\d{2}$/.test(source.businessDate) || new Date(`${source.businessDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== source.businessDate || !Array.isArray(source.counts)) throw new Error("HISTORICAL_SOURCE_INVALID");
  const expected = HISTORICAL_BLOOD_TYPES.flatMap(b => HISTORICAL_COMPONENT_TYPES.map(c => `${b}/${c}`)).sort();
  const counts = source.counts.map(row => {
    if (!row || Object.keys(row).sort().join(",") !== "available,bloodType,closing,componentType,reserved" || ![row.available, row.reserved, row.closing].every(v => Number.isSafeInteger(v) && v >= 0 && v <= 100_000) || row.available + row.reserved !== row.closing) throw new Error("HISTORICAL_COUNTS_INVALID");
    return { bloodType: row.bloodType, componentType: row.componentType, available: row.available, reserved: row.reserved, closing: row.closing };
  }).sort((a,b) => `${a.bloodType}/${a.componentType}` < `${b.bloodType}/${b.componentType}` ? -1 : 1);
  if (counts.length !== 20 || counts.map(c => `${c.bloodType}/${c.componentType}`).join(",") !== expected.join(",") || counts.reduce((n,c) => n+c.closing,0) > 2_000) throw new Error("HISTORICAL_SERIES_INVALID");
  const core = { version: HISTORICAL_VERSION, datasetVersion: "SYNTHETIC_FORECAST_V5_RESEARCH_V1", sourceInstitutionId: "SIM_INSTITUTION_01", classification: "SIMULATION_ONLY", provenance: "CONSTRUCTED_AGGREGATE_REPRESENTATION", workbookSha256: source.workbookSha256, businessDate: source.businessDate, counts };
  const seed = historicalDigest(core), snapshotId = `HSNAP_${seed.slice(0,40).toUpperCase()}`;
  const units = counts.flatMap(row => Array.from({ length: row.closing }, (_,i): HistoricalUnit => {
    const seriesKey = `${row.bloodType}/${row.componentType}`;
    const reserved = i >= row.available;
    return { componentId: `HCOMP_${historicalDigest({seed,seriesKey,index:i}).slice(0,40).toUpperCase()}`, seriesKey, snapshotStatus: reserved ? "RESERVED" : "AVAILABLE", allocationGroupId: reserved ? `HALLOC_${historicalDigest({seed,seriesKey}).slice(0,40).toUpperCase()}` : null, collectedAt: null, expiresAt: null, donationNumber: null, originalReservationPurpose: null };
  }));
  const manifest = { ...core, snapshotId, units };
  return { ...manifest, manifestSha256: historicalDigest(manifest) };
}
export function validateHistoricalManifest(value: unknown): HistoricalManifest {
  const rebuilt = makeHistoricalManifest(value as HistoricalSource);
  if (canonical(rebuilt) !== canonical(value)) throw new Error("HISTORICAL_MANIFEST_INVALID");
  return rebuilt;
}
