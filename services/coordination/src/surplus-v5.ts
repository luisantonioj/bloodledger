/** FR-14 / BR-ALG-07: V5 demand and committed inventory are independent evidence. */
import { fail } from "./errors.js";
import { sha256 } from "./hash.js";
import { INTERVIEW_V2_1_COMPONENT_TYPES, INTERVIEW_V2_1_POLICY_VERSION, INTERVIEW_V2_BLOOD_TYPES, INTERVIEW_V2_CLASSIFICATION, INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY, type InterviewV2_1ComponentType, type InterviewV2BloodType } from "./v2-contracts.js";
import { censusProjectionDigest, SYNTHETIC_OPTIMIZATION_V2_1, SYNTHETIC_OPTIMIZATION_V2_1_CONFIGURATION_SHA256, type CensusV21Snapshot, type TrustedCensusSnapshotReader } from "./surplus-v21.js";

export const V5_FORECAST_DATASET = "SYNTHETIC_FORECAST_V5_RUNTIME_V1" as const;
export const V5_FORECAST_MODEL = "bloodledger-v5-series-mean-1.0.0" as const;
export const V5_FORECAST_MODEL_SHA256 = "ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86" as const;
export const V5_SURPLUS_SCHEMA = "SOURCE_SURPLUS_EVIDENCE_V5_SIMULATION_V1" as const;

export interface ForecastV5Evidence {
  forecastId: string;
  forecastRunId: string;
  institutionId: string;
  bloodType: InterviewV2BloodType;
  componentType: InterviewV2_1ComponentType;
  originDate: string;
  horizonDate: string;
  pointForecast: number;
  forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE";
  generatedAt: string;
  datasetVersion: typeof V5_FORECAST_DATASET;
  modelVersion: typeof V5_FORECAST_MODEL;
  modelSha256: string;
  payloadSha256: string;
  runStatus: "COMPLETED" | "UNAVAILABLE" | "FAILED";
  classification: typeof INTERVIEW_V2_CLASSIFICATION;
  recommendationEligibility: typeof INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY;
}

export interface TrustedV5ForecastReader {
  get(forecastId: string, institutionId: string): Promise<ForecastV5Evidence | null>;
}

export interface SourceSurplusEvidenceV5 {
  schemaVersion: typeof V5_SURPLUS_SCHEMA;
  evidenceId: string;
  sourceInstitutionId: string;
  bloodType: InterviewV2BloodType;
  componentType: InterviewV2_1ComponentType;
  surplusQuantity: number;
  asOf: string;
  inventoryAsOf: string;
  originDate: string;
  horizonDate: string;
  forecastStatus: "AVAILABLE";
  datasetVersion: typeof V5_FORECAST_DATASET;
  forecastRunId: string;
  forecastId: string;
  modelVersion: typeof V5_FORECAST_MODEL;
  modelSha256: string;
  forecastPayloadSha256: string;
  optimizationPolicyVersion: typeof INTERVIEW_V2_1_POLICY_VERSION;
  configurationSha256: string;
  inventorySnapshotId: string;
  sourceProjectionDigest: string;
  classification: typeof INTERVIEW_V2_CLASSIFICATION;
  recommendationEligibility: typeof INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY;
}

function strictUtc(value: string): number {
  const parsed = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) fail("COORD_V5_TIME_INVALID");
  return parsed;
}

function manilaDate(value: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail("COORD_V5_DATE_INVALID");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function validateSourceSurplusEvidenceV5(value: SourceSurplusEvidenceV5): void {
  if (value.schemaVersion !== V5_SURPLUS_SCHEMA || !/^SURP_[0-9A-F]{40}$/.test(value.evidenceId) ||
      !/^INST_[A-Z0-9_-]{1,59}$/.test(value.sourceInstitutionId) ||
      !INTERVIEW_V2_BLOOD_TYPES.includes(value.bloodType) || !INTERVIEW_V2_1_COMPONENT_TYPES.includes(value.componentType) ||
      !Number.isSafeInteger(value.surplusQuantity) || value.surplusQuantity < 0 ||
      value.datasetVersion !== V5_FORECAST_DATASET || value.modelVersion !== V5_FORECAST_MODEL ||
      value.modelSha256 !== V5_FORECAST_MODEL_SHA256 || !/^[0-9a-f]{64}$/.test(value.forecastPayloadSha256) ||
      !/^RUN_[0-9A-F]{32}$/.test(value.forecastRunId) || !/^FC_[0-9A-F]{40}$/.test(value.forecastId) ||
      value.forecastStatus !== "AVAILABLE" || value.horizonDate !== nextDate(value.originDate) ||
      value.optimizationPolicyVersion !== INTERVIEW_V2_1_POLICY_VERSION ||
      value.configurationSha256 !== SYNTHETIC_OPTIMIZATION_V2_1_CONFIGURATION_SHA256 ||
      !/^CENSUS_[A-Z0-9_-]{1,56}$/.test(value.inventorySnapshotId) || !/^[0-9a-f]{64}$/.test(value.sourceProjectionDigest) ||
      value.classification !== INTERVIEW_V2_CLASSIFICATION || value.recommendationEligibility !== INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY) fail("COORD_V5_SURPLUS_INVALID");
  strictUtc(value.asOf);
  strictUtc(value.inventoryAsOf);
  const expectedId = sha256({
    sourceInstitutionId: value.sourceInstitutionId, forecastId: value.forecastId,
    forecastRunId: value.forecastRunId, forecastPayloadSha256: value.forecastPayloadSha256,
    snapshotId: value.inventorySnapshotId, projectionDigest: value.sourceProjectionDigest,
    configurationSha256: value.configurationSha256, surplusQuantity: value.surplusQuantity,
  });
  if (value.evidenceId !== `SURP_${expectedId.slice(0, 40).toUpperCase()}`) fail("COORD_V5_SURPLUS_INVALID");
}

export async function produceSourceSurplusEvidenceV5FromStore(input: {
  sourceInstitutionId: string;
  evaluationTime: string;
  forecastId: string;
  inventorySnapshotId: string;
  sourceProjectionDigest: string;
  snapshotReader: TrustedCensusSnapshotReader;
  forecastReader: TrustedV5ForecastReader;
}): Promise<SourceSurplusEvidenceV5> {
  const evaluationMs = strictUtc(input.evaluationTime);
  if (!/^INST_[A-Z0-9_-]{1,59}$/.test(input.sourceInstitutionId) ||
      !/^FC_[0-9A-F]{40}$/.test(input.forecastId) ||
      !/^CENSUS_[A-Z0-9_-]{1,56}$/.test(input.inventorySnapshotId) ||
      !/^[0-9a-f]{64}$/.test(input.sourceProjectionDigest)) fail("COORD_V5_INPUT_INVALID");
  const [forecast, snapshot] = await Promise.all([
    input.forecastReader.get(input.forecastId, input.sourceInstitutionId),
    input.snapshotReader.get(input.inventorySnapshotId, input.sourceInstitutionId),
  ]);
  if (!forecast || !snapshot) fail("COORD_V5_EVIDENCE_UNAVAILABLE");
  if (forecast.forecastId !== input.forecastId || forecast.institutionId !== input.sourceInstitutionId ||
      !/^RUN_[0-9A-F]{32}$/.test(forecast.forecastRunId) ||
      forecast.datasetVersion !== V5_FORECAST_DATASET || forecast.modelVersion !== V5_FORECAST_MODEL ||
      forecast.modelSha256 !== V5_FORECAST_MODEL_SHA256 || !/^[0-9a-f]{64}$/.test(forecast.payloadSha256) ||
      forecast.runStatus !== "COMPLETED" || forecast.forecastStatus !== "AVAILABLE" ||
      forecast.classification !== INTERVIEW_V2_CLASSIFICATION || forecast.recommendationEligibility !== INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY ||
      !INTERVIEW_V2_BLOOD_TYPES.includes(forecast.bloodType) || !INTERVIEW_V2_1_COMPONENT_TYPES.includes(forecast.componentType) ||
      !Number.isFinite(forecast.pointForecast) || forecast.pointForecast < 0 ||
      forecast.horizonDate !== manilaDate(evaluationMs) || forecast.horizonDate !== nextDate(forecast.originDate) ||
      strictUtc(forecast.generatedAt) > evaluationMs) fail("COORD_V5_FORECAST_INVALID");
  const inventoryAsOf = snapshot.capturedAt;
  if (!inventoryAsOf || snapshot.snapshotId !== input.inventorySnapshotId ||
      snapshot.institutionId !== input.sourceInstitutionId || snapshot.timezone !== "Asia/Manila" ||
      snapshot.classification !== INTERVIEW_V2_CLASSIFICATION ||
      snapshot.sourceProjectionDigest !== input.sourceProjectionDigest ||
      snapshot.sourceProjectionDigest !== censusProjectionDigest(snapshot as CensusV21Snapshot) ||
      strictUtc(snapshot.scheduledFor) > strictUtc(inventoryAsOf) ||
      strictUtc(inventoryAsOf) > evaluationMs ||
      manilaDate(strictUtc(inventoryAsOf)) !== manilaDate(evaluationMs)) fail("COORD_V5_INVENTORY_INVALID");
  const group = snapshot.groups.find((candidate) => candidate.componentType === forecast.componentType);
  const count = group?.bloodTypes.find((candidate) => candidate.bloodType === forecast.bloodType);
  if (!count || !Number.isSafeInteger(count.availableCount) || count.availableCount < 0 ||
      !Number.isSafeInteger(count.forecastEligibleAvailableCount) || count.forecastEligibleAvailableCount < 0 ||
      count.forecastEligibleAvailableCount > count.availableCount) fail("COORD_V5_INVENTORY_UNAVAILABLE");
  const surplusQuantity = Math.max(0, Math.floor(count.forecastEligibleAvailableCount - forecast.pointForecast -
    SYNTHETIC_OPTIMIZATION_V2_1.safetyAllowance - SYNTHETIC_OPTIMIZATION_V2_1.minimumReserve));
  const material = {
    sourceInstitutionId: input.sourceInstitutionId, forecastId: forecast.forecastId,
    forecastRunId: forecast.forecastRunId, forecastPayloadSha256: forecast.payloadSha256,
    snapshotId: snapshot.snapshotId, projectionDigest: snapshot.sourceProjectionDigest,
    configurationSha256: SYNTHETIC_OPTIMIZATION_V2_1_CONFIGURATION_SHA256, surplusQuantity,
  };
  const evidence: SourceSurplusEvidenceV5 = {
    schemaVersion: V5_SURPLUS_SCHEMA,
    evidenceId: `SURP_${sha256(material).slice(0, 40).toUpperCase()}`,
    sourceInstitutionId: input.sourceInstitutionId,
    bloodType: forecast.bloodType, componentType: forecast.componentType, surplusQuantity,
    asOf: forecast.generatedAt, inventoryAsOf, originDate: forecast.originDate,
    horizonDate: forecast.horizonDate, forecastStatus: "AVAILABLE",
    datasetVersion: V5_FORECAST_DATASET, forecastRunId: forecast.forecastRunId,
    forecastId: forecast.forecastId, modelVersion: V5_FORECAST_MODEL,
    modelSha256: forecast.modelSha256, forecastPayloadSha256: forecast.payloadSha256,
    optimizationPolicyVersion: INTERVIEW_V2_1_POLICY_VERSION,
    configurationSha256: SYNTHETIC_OPTIMIZATION_V2_1_CONFIGURATION_SHA256,
    inventorySnapshotId: snapshot.snapshotId, sourceProjectionDigest: snapshot.sourceProjectionDigest,
    classification: INTERVIEW_V2_CLASSIFICATION,
    recommendationEligibility: INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY,
  };
  validateSourceSurplusEvidenceV5(evidence);
  return evidence;
}
