import { sha256 } from "./hash.js";
import { fail } from "./errors.js";
import { INTERVIEW_V2_BLOOD_TYPES, INTERVIEW_V2_COMPONENT_TYPES, INTERVIEW_V2_CLASSIFICATION, INTERVIEW_V2_POLICY_VERSION, INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY, type InterviewV2BloodType, type InterviewV2ComponentType, type SourceSurplusEvidenceV2, validateSourceSurplusEvidenceV2 } from "./v2-contracts.js";
import policy from "../policy/interview-derived-optimization-v2.json" with { type: "json" };

export interface BroaV2Candidate { destinationInstitutionId: string; sourceInstitutionId: string; bloodType: InterviewV2BloodType; componentType: InterviewV2ComponentType; urgency: number; stockShortage: number; distanceKm: number; eligible: boolean; context: { relationshipClass: "PARTNER" | "NON_PARTNER" | "UNKNOWN"; scheduledDonationWindow: { startDate: string; endDate: string } | null }; }
export interface BroaV2Input { evaluationTime: string; requiredQuantity: number; sourceSurplus: SourceSurplusEvidenceV2; candidates: BroaV2Candidate[]; }

function normalize(values: number[], value: number): number { const min = Math.min(...values); const max = Math.max(...values); return max === min ? 1 : (value - min) / (max - min); }

export function recommendBroaV2(input: BroaV2Input) {
  if (!input || !Array.isArray(input.candidates) || input.candidates.length === 0 || !Number.isSafeInteger(input.requiredQuantity) || input.requiredQuantity < 1) fail("COORD_BROA_V2_INPUT_INVALID");
  const evaluationMs = Date.parse(input.evaluationTime);
  if (!Number.isFinite(evaluationMs) || new Date(evaluationMs).toISOString() !== input.evaluationTime) fail("COORD_BROA_V2_TIME_INVALID");
  try { validateSourceSurplusEvidenceV2(input.sourceSurplus); } catch { fail("COORD_BROA_V2_SURPLUS_NOT_ELIGIBLE"); }
  if (input.sourceSurplus.forecastStatus !== "AVAILABLE" || input.sourceSurplus.classification !== INTERVIEW_V2_CLASSIFICATION || input.sourceSurplus.recommendationEligibility !== INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY || input.sourceSurplus.sourceInstitutionId === "" || input.sourceSurplus.surplusQuantity < input.requiredQuantity || Date.parse(input.sourceSurplus.asOf) > evaluationMs) fail("COORD_BROA_V2_SURPLUS_NOT_ELIGIBLE");
  if (input.sourceSurplus.inventorySnapshotId === undefined || input.sourceSurplus.sourceProjectionDigest === undefined) fail("COORD_BROA_V2_COMMITTED_INVENTORY_REQUIRED");
  if (!INTERVIEW_V2_BLOOD_TYPES.includes(input.sourceSurplus.bloodType) || !INTERVIEW_V2_COMPONENT_TYPES.includes(input.sourceSurplus.componentType)) fail("COORD_BROA_V2_SURPLUS_INVALID");
  const keys = new Set<string>();
  for (const candidate of input.candidates) {
    const key = `${candidate.sourceInstitutionId}|${candidate.bloodType}|${candidate.componentType}`;
    if (!/^INST_[A-Z0-9_-]{1,59}$/.test(candidate.destinationInstitutionId) || candidate.sourceInstitutionId !== input.sourceSurplus.sourceInstitutionId || candidate.bloodType !== input.sourceSurplus.bloodType || candidate.componentType !== input.sourceSurplus.componentType || keys.has(candidate.destinationInstitutionId) || [candidate.urgency, candidate.stockShortage, candidate.distanceKm].some((value) => !Number.isFinite(value) || value < 0) || typeof candidate.eligible !== "boolean") fail("COORD_BROA_V2_CANDIDATE_INVALID");
    keys.add(candidate.destinationInstitutionId); void key;
  }
  const eligible = input.candidates.filter((candidate) => candidate.eligible); if (eligible.length === 0) fail("COORD_BROA_V2_CANDIDATE_INVALID");
  const values = { urgency: eligible.map((candidate) => candidate.urgency), stockShortage: eligible.map((candidate) => candidate.stockShortage), distanceKm: eligible.map((candidate) => candidate.distanceKm) };
  const ranked = eligible.map((candidate) => {
    const normalized = { urgency: normalize(values.urgency, candidate.urgency), stockShortage: normalize(values.stockShortage, candidate.stockShortage), distancePenalty: normalize(values.distanceKm, candidate.distanceKm) };
    const contributions = { urgency: normalized.urgency * policy.broa.weights.urgency, stockShortage: normalized.stockShortage * policy.broa.weights.stockShortage, distancePenalty: normalized.distancePenalty * policy.broa.weights.distancePenalty };
    return { ...candidate, normalized, contributions, score: Number((contributions.urgency + contributions.stockShortage - contributions.distancePenalty).toFixed(12)) };
  }).sort((left, right) => right.score - left.score || left.destinationInstitutionId.localeCompare(right.destinationInstitutionId));
  const evidence = { input, policy, ranked, selectedDestinationInstitutionId: ranked[0]?.destinationInstitutionId ?? null };
  return { schemaVersion: "BROA_RUN_V2", runId: `ARUN_${sha256(evidence).slice(0, 32).toUpperCase()}`, algorithm: "BROA" as const, algorithmVersion: INTERVIEW_V2_POLICY_VERSION, classification: INTERVIEW_V2_CLASSIFICATION, recommendationEligibility: INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY, automaticApproval: false as const, inputSha256: sha256(input), configSha256: sha256(policy.broa), recommendationDigest: sha256(evidence), evaluationTime: input.evaluationTime, sourceSurplusEligibility: "ELIGIBLE_GATE", contextUsedForScoring: false, ranked };
}
