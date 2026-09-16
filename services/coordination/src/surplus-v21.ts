import { createHash } from "node:crypto";
import { fail } from "./errors.js";
import { sha256 } from "./hash.js";
import { INTERVIEW_V2_1_COMPONENT_TYPES, INTERVIEW_V2_1_POLICY_VERSION, INTERVIEW_V2_BLOOD_TYPES, INTERVIEW_V2_CLASSIFICATION, INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY, type InterviewV2_1ComponentType, type InterviewV2BloodType, type SourceSurplusEvidenceV2_1, validateSourceSurplusEvidenceV2_1 } from "./v2-contracts.js";

export const SYNTHETIC_OPTIMIZATION_V2_1 = { horizonDays: 1, safetyAllowance: 2, minimumReserve: 10, rounding: "FLOOR", eligibleStock: "AVAILABLE_COMMITTED_ONLY", classification: INTERVIEW_V2_CLASSIFICATION, recommendationEligibility: INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY } as const;

export interface CensusV21BloodTypeCount { bloodType: InterviewV2BloodType; availableCount: number; reservedCount: number; forecastEligibleAvailableCount: number; reportableCount: number; }
export interface CensusV21Group { componentType: InterviewV2_1ComponentType; bloodTypes: CensusV21BloodTypeCount[]; }
export interface CensusV21Snapshot { snapshotId: string; scheduledFor: string; timezone: "Asia/Manila"; reportPolicyVersion: string; sourceProjectionDigest: string; groups: CensusV21Group[]; classification: typeof INTERVIEW_V2_CLASSIFICATION; }
export interface ForecastV4Evidence { bloodType: InterviewV2BloodType; componentType: InterviewV2_1ComponentType; pointForecast: number; forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE"; asOf: string; horizonDate: string; modelVersion: string; }

export function censusProjectionDigest(snapshot: Omit<CensusV21Snapshot, "sourceProjectionDigest" | "classification">): string {
  const canonical = { snapshotId: snapshot.snapshotId, scheduledFor: snapshot.scheduledFor, timezone: snapshot.timezone, reportPolicyVersion: snapshot.reportPolicyVersion, groups: snapshot.groups };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export function produceSourceSurplusEvidenceV2_1(input: { sourceInstitutionId: string; evaluationTime: string; snapshot: CensusV21Snapshot; forecast: ForecastV4Evidence }): SourceSurplusEvidenceV2_1 {
  const evaluationMs = Date.parse(input.evaluationTime);
  const asOfMs = Date.parse(input.forecast.asOf);
  const horizonMs = Date.parse(`${input.forecast.horizonDate}T00:00:00.000Z`);
  if (!Number.isFinite(evaluationMs) || new Date(evaluationMs).toISOString() !== input.evaluationTime || !Number.isFinite(asOfMs) || new Date(asOfMs).toISOString() !== input.forecast.asOf || asOfMs > evaluationMs || !Number.isFinite(horizonMs) || new Date(horizonMs).toISOString().slice(0, 10) !== input.forecast.horizonDate || horizonMs < Date.parse(`${input.evaluationTime.slice(0, 10)}T00:00:00.000Z`)) fail("COORD_V2_1_FRESHNESS_INVALID");
  if (input.snapshot.classification !== INTERVIEW_V2_CLASSIFICATION || input.snapshot.sourceProjectionDigest !== censusProjectionDigest(input.snapshot) || !INTERVIEW_V2_BLOOD_TYPES.includes(input.forecast.bloodType) || !INTERVIEW_V2_1_COMPONENT_TYPES.includes(input.forecast.componentType) || input.forecast.forecastStatus !== "AVAILABLE" || !Number.isFinite(input.forecast.pointForecast) || input.forecast.pointForecast < 0) fail("COORD_V2_1_SOURCE_PROJECTION_MISMATCH");
  const group = input.snapshot.groups.find((candidate) => candidate.componentType === input.forecast.componentType);
  const count = group?.bloodTypes.find((candidate) => candidate.bloodType === input.forecast.bloodType);
  if (!count) fail("COORD_V2_1_SOURCE_SERIES_UNAVAILABLE");
  const surplusQuantity = Math.max(0, Math.floor(count.forecastEligibleAvailableCount - input.forecast.pointForecast - SYNTHETIC_OPTIMIZATION_V2_1.safetyAllowance - SYNTHETIC_OPTIMIZATION_V2_1.minimumReserve));
  const identity = sha256({ sourceInstitutionId: input.sourceInstitutionId, snapshotId: input.snapshot.snapshotId, projectionDigest: input.snapshot.sourceProjectionDigest, forecast: input.forecast, surplusQuantity });
  const evidence: SourceSurplusEvidenceV2_1 = { evidenceId: `SURP_${identity.slice(0, 40).toUpperCase()}`, sourceInstitutionId: input.sourceInstitutionId, bloodType: input.forecast.bloodType, componentType: input.forecast.componentType, surplusQuantity, asOf: input.forecast.asOf, horizonDate: input.forecast.horizonDate, forecastStatus: "AVAILABLE", modelVersion: input.forecast.modelVersion, inventorySnapshotId: input.snapshot.snapshotId, sourceProjectionDigest: input.snapshot.sourceProjectionDigest, classification: INTERVIEW_V2_CLASSIFICATION, recommendationEligibility: INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY };
  try { validateSourceSurplusEvidenceV2_1(evidence); } catch { fail("COORD_V2_1_SOURCE_SURPLUS_INVALID"); }
  return evidence;
}
