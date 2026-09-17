import { createHash } from "node:crypto";
import { fail } from "./errors.js";
import { sha256 } from "./hash.js";
import { INTERVIEW_V2_1_COMPONENT_TYPES, INTERVIEW_V2_1_POLICY_VERSION, INTERVIEW_V2_BLOOD_TYPES, INTERVIEW_V2_CLASSIFICATION, INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY, type InterviewV2_1ComponentType, type InterviewV2BloodType, type SourceSurplusEvidenceV2_1, validateSourceSurplusEvidenceV2_1 } from "./v2-contracts.js";

export const SYNTHETIC_OPTIMIZATION_V2_1 = { policyVersion: INTERVIEW_V2_1_POLICY_VERSION, horizonDays: 1, safetyAllowance: 2, minimumReserve: 10, rounding: "FLOOR", eligibleStock: "AVAILABLE_COMMITTED_ONLY", classification: INTERVIEW_V2_CLASSIFICATION, recommendationEligibility: INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY } as const;
export const SYNTHETIC_OPTIMIZATION_V2_1_CONFIGURATION_SHA256 = sha256(SYNTHETIC_OPTIMIZATION_V2_1);

export interface CensusV21BloodTypeCount { bloodType: InterviewV2BloodType; availableCount: number; reservedCount: number; forecastEligibleAvailableCount: number; reportableCount: number; }
export interface CensusV21Group { componentType: InterviewV2_1ComponentType; bloodTypes: CensusV21BloodTypeCount[]; }
export interface CensusV21Snapshot { snapshotId: string; institutionId: string; scheduledFor: string; capturedAt?: string; timezone: "Asia/Manila"; reportPolicyVersion: string; sourceProjectionDigest: string; groups: CensusV21Group[]; classification: typeof INTERVIEW_V2_CLASSIFICATION; }
export interface ForecastV4Evidence { bloodType: InterviewV2BloodType; componentType: InterviewV2_1ComponentType; pointForecast: number; forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE"; asOf: string; horizonDate: string; datasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1"; forecastRunId: string; modelVersion: string; }

function strictUtc(value: string): number {
  const parsed = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) fail("COORD_V2_1_FRESHNESS_INVALID");
  return parsed;
}

function manilaDate(value: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function validateForecastFreshness(input: { evaluationTime: string; asOf: string; horizonDate: string }): void {
  const evaluationMs = strictUtc(input.evaluationTime);
  const asOfMs = strictUtc(input.asOf);
  if (asOfMs > evaluationMs || !/^\d{4}-\d{2}-\d{2}$/.test(input.horizonDate) || !Number.isFinite(Date.parse(`${input.horizonDate}T00:00:00.000Z`)) || input.horizonDate !== nextDate(manilaDate(evaluationMs))) fail("COORD_V2_1_FRESHNESS_INVALID");
}

export function censusProjectionDigest(snapshot: Omit<CensusV21Snapshot, "sourceProjectionDigest" | "classification">): string {
  const canonical = { snapshotId: snapshot.snapshotId, scheduledFor: snapshot.scheduledFor, timezone: snapshot.timezone, reportPolicyVersion: snapshot.reportPolicyVersion, groups: snapshot.groups };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export function produceSourceSurplusEvidenceV2_1(input: { sourceInstitutionId: string; evaluationTime: string; snapshot: CensusV21Snapshot; forecast: ForecastV4Evidence }): SourceSurplusEvidenceV2_1 {
  validateForecastFreshness({ evaluationTime: input.evaluationTime, asOf: input.forecast.asOf, horizonDate: input.forecast.horizonDate });
  const evaluationMs = strictUtc(input.evaluationTime);
  const scheduledMs = strictUtc(input.snapshot.scheduledFor);
  if (scheduledMs > evaluationMs || manilaDate(scheduledMs) !== manilaDate(evaluationMs) || (input.snapshot.capturedAt !== undefined && strictUtc(input.snapshot.capturedAt) > evaluationMs) || input.snapshot.timezone !== "Asia/Manila") fail("COORD_V2_1_FRESHNESS_INVALID");
  if (input.snapshot.institutionId !== input.sourceInstitutionId || input.snapshot.classification !== INTERVIEW_V2_CLASSIFICATION || input.snapshot.sourceProjectionDigest !== censusProjectionDigest(input.snapshot) || !/^INST_[A-Z0-9_-]{1,59}$/.test(input.sourceInstitutionId) || !INTERVIEW_V2_BLOOD_TYPES.includes(input.forecast.bloodType) || !INTERVIEW_V2_1_COMPONENT_TYPES.includes(input.forecast.componentType) || input.forecast.forecastStatus !== "AVAILABLE" || !Number.isFinite(input.forecast.pointForecast) || input.forecast.pointForecast < 0) fail("COORD_V2_1_SOURCE_PROJECTION_MISMATCH");
  const group = input.snapshot.groups.find((candidate) => candidate.componentType === input.forecast.componentType);
  const count = group?.bloodTypes.find((candidate) => candidate.bloodType === input.forecast.bloodType);
  if (!count) fail("COORD_V2_1_SOURCE_SERIES_UNAVAILABLE");
  const surplusQuantity = Math.max(0, Math.floor(count.forecastEligibleAvailableCount - input.forecast.pointForecast - SYNTHETIC_OPTIMIZATION_V2_1.safetyAllowance - SYNTHETIC_OPTIMIZATION_V2_1.minimumReserve));
  const identity = sha256({ sourceInstitutionId: input.sourceInstitutionId, snapshotId: input.snapshot.snapshotId, projectionDigest: input.snapshot.sourceProjectionDigest, forecast: input.forecast, configurationSha256: SYNTHETIC_OPTIMIZATION_V2_1_CONFIGURATION_SHA256, surplusQuantity });
  const evidence: SourceSurplusEvidenceV2_1 = { evidenceId: `SURP_${identity.slice(0, 40).toUpperCase()}`, sourceInstitutionId: input.sourceInstitutionId, bloodType: input.forecast.bloodType, componentType: input.forecast.componentType, surplusQuantity, asOf: input.forecast.asOf, horizonDate: input.forecast.horizonDate, forecastStatus: "AVAILABLE", datasetVersion: input.forecast.datasetVersion, forecastRunId: input.forecast.forecastRunId, modelVersion: input.forecast.modelVersion, optimizationPolicyVersion: INTERVIEW_V2_1_POLICY_VERSION, configurationSha256: SYNTHETIC_OPTIMIZATION_V2_1_CONFIGURATION_SHA256, inventorySnapshotId: input.snapshot.snapshotId, sourceProjectionDigest: input.snapshot.sourceProjectionDigest, classification: INTERVIEW_V2_CLASSIFICATION, recommendationEligibility: INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY };
  try { validateSourceSurplusEvidenceV2_1(evidence); } catch { fail("COORD_V2_1_SOURCE_SURPLUS_INVALID"); }
  return evidence;
}

export interface TrustedCensusSnapshotReader {
  get(snapshotId: string, institutionId: string): Promise<CensusV21Snapshot | null>;
}

export async function produceSourceSurplusEvidenceV2_1FromStore(input: { sourceInstitutionId: string; evaluationTime: string; inventorySnapshotId: string; sourceProjectionDigest: string; snapshotReader: TrustedCensusSnapshotReader; forecast: ForecastV4Evidence }): Promise<SourceSurplusEvidenceV2_1> {
  if (!/^CENSUS_[A-Z0-9_-]{1,56}$/.test(input.inventorySnapshotId) || !/^[0-9a-f]{64}$/.test(input.sourceProjectionDigest)) fail("COORD_V2_1_TRUSTED_SNAPSHOT_INVALID");
  const snapshot = await input.snapshotReader.get(input.inventorySnapshotId, input.sourceInstitutionId);
  if (!snapshot || snapshot.snapshotId !== input.inventorySnapshotId || snapshot.institutionId !== input.sourceInstitutionId || snapshot.sourceProjectionDigest !== input.sourceProjectionDigest) fail("COORD_V2_1_TRUSTED_SNAPSHOT_MISMATCH");
  return produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: input.sourceInstitutionId, evaluationTime: input.evaluationTime, snapshot, forecast: input.forecast });
}
