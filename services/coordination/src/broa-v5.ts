/** V5 BROA simulation gate. Ranking cannot approve or submit a transfer. */
import { fail } from "./errors.js";
import { sha256 } from "./hash.js";
import { INTERVIEW_V2_1_COMPONENT_TYPES, INTERVIEW_V2_1_POLICY_VERSION, INTERVIEW_V2_BLOOD_TYPES, INTERVIEW_V2_CLASSIFICATION, INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY } from "./v2-contracts.js";
import { produceSourceSurplusEvidenceV5FromStore, validateSourceSurplusEvidenceV5, type SourceSurplusEvidenceV5, type TrustedV5ForecastReader } from "./surplus-v5.js";
import type { TrustedCensusSnapshotReader } from "./surplus-v21.js";
import type { BroaV21Candidate } from "./broa-v21.js";
import policy from "../policy/interview-derived-optimization-v2-1.json" with { type: "json" };

export interface BroaV5Input {
  evaluationTime: string;
  requiredQuantity: number;
  sourceSurplus: SourceSurplusEvidenceV5;
  candidates: BroaV21Candidate[];
}

function manilaDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function normalize(values: number[], value: number): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max === min ? 1 : (value - min) / (max - min);
}

export function recommendBroaV5(input: BroaV5Input) {
  if (!input || !Array.isArray(input.candidates) || !input.candidates.length ||
      !Number.isSafeInteger(input.requiredQuantity) || input.requiredQuantity < 1) fail("COORD_BROA_V5_INPUT_INVALID");
  try { validateSourceSurplusEvidenceV5(input.sourceSurplus); } catch { fail("COORD_BROA_V5_SURPLUS_INVALID"); }
  const evaluatedMs = Date.parse(input.evaluationTime);
  const forecastMs = Date.parse(input.sourceSurplus.asOf);
  const inventoryMs = Date.parse(input.sourceSurplus.inventoryAsOf);
  if (!Number.isFinite(evaluatedMs) || new Date(evaluatedMs).toISOString() !== input.evaluationTime ||
      forecastMs > evaluatedMs || inventoryMs > evaluatedMs ||
      manilaDate(input.evaluationTime) !== input.sourceSurplus.horizonDate ||
      manilaDate(input.sourceSurplus.inventoryAsOf) !== input.sourceSurplus.horizonDate) fail("COORD_BROA_V5_FRESHNESS_INVALID");
  if (input.sourceSurplus.surplusQuantity < input.requiredQuantity ||
      !INTERVIEW_V2_BLOOD_TYPES.includes(input.sourceSurplus.bloodType) ||
      !INTERVIEW_V2_1_COMPONENT_TYPES.includes(input.sourceSurplus.componentType)) fail("COORD_BROA_V5_SURPLUS_NOT_ELIGIBLE");
  const destinations = new Set<string>();
  for (const candidate of input.candidates) {
    if (candidate.sourceInstitutionId !== input.sourceSurplus.sourceInstitutionId ||
        candidate.bloodType !== input.sourceSurplus.bloodType || candidate.componentType !== input.sourceSurplus.componentType ||
        !/^INST_[A-Z0-9_-]{1,59}$/.test(candidate.destinationInstitutionId) ||
        destinations.has(candidate.destinationInstitutionId) || typeof candidate.eligible !== "boolean" ||
        [candidate.urgency, candidate.stockShortage, candidate.distanceKm].some((value) => !Number.isFinite(value) || value < 0)) fail("COORD_BROA_V5_CANDIDATE_INVALID");
    destinations.add(candidate.destinationInstitutionId);
  }
  const eligible = input.candidates.filter((candidate) => candidate.eligible);
  if (!eligible.length) fail("COORD_BROA_V5_CANDIDATE_INVALID");
  const values = { urgency: eligible.map((candidate) => candidate.urgency), stockShortage: eligible.map((candidate) => candidate.stockShortage), distanceKm: eligible.map((candidate) => candidate.distanceKm) };
  const ranked = eligible.map((candidate) => {
    const normalized = { urgency: normalize(values.urgency, candidate.urgency), stockShortage: normalize(values.stockShortage, candidate.stockShortage), distancePenalty: normalize(values.distanceKm, candidate.distanceKm) };
    const contributions = { urgency: normalized.urgency * policy.broa.weights.urgency, stockShortage: normalized.stockShortage * policy.broa.weights.stockShortage, distancePenalty: normalized.distancePenalty * policy.broa.weights.distancePenalty };
    return { ...candidate, normalized, contributions, score: Number((contributions.urgency + contributions.stockShortage - contributions.distancePenalty).toFixed(12)) };
  }).sort((left, right) => right.score - left.score || left.destinationInstitutionId.localeCompare(right.destinationInstitutionId));
  const evidence = { input, policy, ranked, selectedDestinationInstitutionId: ranked[0]?.destinationInstitutionId ?? null };
  return {
    schemaVersion: "BROA_RUN_V5_SIMULATION_V1" as const,
    runId: `ARUN_${sha256(evidence).slice(0, 32).toUpperCase()}`,
    algorithm: "BROA" as const, algorithmVersion: INTERVIEW_V2_1_POLICY_VERSION,
    classification: INTERVIEW_V2_CLASSIFICATION,
    recommendationEligibility: INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY,
    automaticApproval: false as const,
    inputSha256: sha256(input), configSha256: sha256(policy.broa),
    recommendationDigest: sha256(evidence), evaluationTime: input.evaluationTime,
    sourceSurplusEligibility: "ELIGIBLE_GATE" as const, ranked,
  };
}

export async function recommendBroaV5FromStore(input: Omit<BroaV5Input, "sourceSurplus"> & {
  sourceInstitutionId: string;
  forecastId: string;
  inventorySnapshotId: string;
  sourceProjectionDigest: string;
  snapshotReader: TrustedCensusSnapshotReader;
  forecastReader: TrustedV5ForecastReader;
}): Promise<ReturnType<typeof recommendBroaV5>> {
  const sourceSurplus = await produceSourceSurplusEvidenceV5FromStore(input);
  return recommendBroaV5({ evaluationTime: input.evaluationTime, requiredQuantity: input.requiredQuantity, sourceSurplus, candidates: input.candidates });
}
