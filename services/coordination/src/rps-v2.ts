import { fail } from "./errors.js";
import { sha256 } from "./hash.js";
import { INTERVIEW_V2_BLOOD_TYPES, INTERVIEW_V2_COMPONENT_TYPES, INTERVIEW_V2_CLASSIFICATION, INTERVIEW_V2_POLICY_VERSION, INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY, type InterviewV2BloodType, type InterviewV2ComponentType } from "./v2-contracts.js";
import policy from "../policy/interview-derived-optimization-v2.json" with { type: "json" };

type Urgency = "ROUTINE" | "URGENT" | "CRITICAL";
export interface RpsV2Request { requestId: string; sourceInstitutionId: string; bloodType: InterviewV2BloodType; componentType: InterviewV2ComponentType; urgency: Urgency; requestTime: string; }
export interface RpsV2Input { evaluationTime: string; requests: RpsV2Request[]; }

export function rankRpsV2(input: RpsV2Input) {
  if (!input || !Array.isArray(input.requests) || input.requests.length === 0) fail("COORD_RPS_V2_REQUESTS_INVALID");
  const evaluationMs = Date.parse(input.evaluationTime);
  if (!Number.isFinite(evaluationMs) || new Date(evaluationMs).toISOString() !== input.evaluationTime) fail("COORD_RPS_V2_TIME_INVALID");
  const seen = new Set<string>();
  const groups = new Set<string>();
  const ranked = input.requests.map((request) => {
    if (!request || !/^TRF_[A-Z0-9_-]{1,56}$/.test(request.requestId) || seen.has(request.requestId) || !/^INST_[A-Z0-9_-]{1,59}$/.test(request.sourceInstitutionId) || !INTERVIEW_V2_BLOOD_TYPES.includes(request.bloodType) || !INTERVIEW_V2_COMPONENT_TYPES.includes(request.componentType) || !["ROUTINE", "URGENT", "CRITICAL"].includes(request.urgency)) fail("COORD_RPS_V2_REQUEST_INVALID");
    const key = `${request.sourceInstitutionId}|${request.bloodType}|${request.componentType}`; groups.add(key); seen.add(request.requestId);
    const requestMs = Date.parse(request.requestTime);
    if (!Number.isFinite(requestMs) || new Date(requestMs).toISOString() !== request.requestTime || requestMs > evaluationMs) fail("COORD_RPS_V2_TIME_INVALID");
    const waitHours = (evaluationMs - requestMs) / 3_600_000;
    const urgencyNormalized = request.urgency === "CRITICAL" ? 1 : request.urgency === "URGENT" ? 0.5 : 0;
    const waitNormalized = Math.min(waitHours, policy.rps.waitCapHours) / policy.rps.waitCapHours;
    const score = urgencyNormalized * policy.rps.urgencyWeight + waitNormalized * policy.rps.waitWeight;
    return { ...request, competitionKey: key, urgencyNormalized, waitHours, waitNormalized, score: Number(score.toFixed(12)) };
  });
  if (groups.size > 1) fail("COORD_RPS_V2_COMPETITION_MISMATCH");
  ranked.sort((left, right) => right.score - left.score || left.requestTime.localeCompare(right.requestTime) || left.requestId.localeCompare(right.requestId));
  return { schemaVersion: "RPS_RUN_V2", runId: `ARUN_${sha256({ input, policy }).slice(0, 32).toUpperCase()}`, algorithm: "RPS" as const, algorithmVersion: INTERVIEW_V2_POLICY_VERSION, classification: INTERVIEW_V2_CLASSIFICATION, recommendationEligibility: INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY, inputSha256: sha256(input), configSha256: sha256(policy.rps), recommendationDigest: sha256({ input, policy, ranked }), evaluationTime: input.evaluationTime, ranked };
}
