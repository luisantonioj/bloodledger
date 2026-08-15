import { fail } from "./errors.js";
import { sha256 } from "./hash.js";
import { optimizationPolicy, type Urgency } from "./policies.js";

const REQUEST_ID = /^TRF_[A-Z0-9_-]{1,56}$/;

export interface RpsRequest {
  requestId: string;
  urgency: Urgency;
  requestTime: string;
}

export interface RpsInput {
  evaluationTime: string;
  requests: RpsRequest[];
}

export function rankRps(input: RpsInput) {
  if (typeof input !== "object" || input === null || !Array.isArray(input.requests)) {
    fail("COORD_RPS_REQUESTS_INVALID");
  }
  const evaluationMs = Date.parse(input.evaluationTime);
  if (!Number.isFinite(evaluationMs) || new Date(evaluationMs).toISOString() !== input.evaluationTime) {
    fail("COORD_RPS_TIME_INVALID");
  }
  if (!Array.isArray(input.requests) || input.requests.length === 0) fail("COORD_RPS_REQUESTS_INVALID");
  const seen = new Set<string>();
  const ranked = input.requests.map((request) => {
    if (typeof request !== "object" || request === null) fail("COORD_RPS_REQUEST_INVALID");
    if (!REQUEST_ID.test(request.requestId) || seen.has(request.requestId)) fail("COORD_RPS_REQUEST_INVALID");
    seen.add(request.requestId);
    const urgencyNormalized = optimizationPolicy.rps.urgencyWeights[request.urgency];
    if (urgencyNormalized === undefined) fail("COORD_RPS_URGENCY_INVALID");
    const requestMs = Date.parse(request.requestTime);
    if (!Number.isFinite(requestMs) || new Date(requestMs).toISOString() !== request.requestTime || requestMs > evaluationMs) {
      fail("COORD_RPS_TIME_INVALID");
    }
    const waitHours = (evaluationMs - requestMs) / 3_600_000;
    const waitNormalized = Math.min(waitHours, optimizationPolicy.rps.waitCapHours) /
      optimizationPolicy.rps.waitCapHours;
    const urgencyContribution = urgencyNormalized * optimizationPolicy.rps.urgencyWeight;
    const waitContribution = waitNormalized * optimizationPolicy.rps.waitWeight;
    return {
      ...request,
      urgencyNormalized,
      waitHours,
      waitNormalized,
      urgencyContribution,
      waitContribution,
      score: Number((urgencyContribution + waitContribution).toFixed(12)),
    };
  }).sort((left, right) =>
    right.score - left.score ||
    left.requestTime.localeCompare(right.requestTime) ||
    left.requestId.localeCompare(right.requestId));
  const evidence = { input, policy: optimizationPolicy.rps, ranked };
  return {
    schemaVersion: "RPS_RUN_V1",
    runId: `ARUN_${sha256({ input, policy: optimizationPolicy.rps }).slice(0, 32).toUpperCase()}`,
    algorithm: "RPS" as const,
    algorithmVersion: optimizationPolicy.policyVersion,
    classification: optimizationPolicy.classification,
    recommendationEligibility: optimizationPolicy.recommendationEligibility,
    inputSha256: sha256(input),
    configSha256: sha256(optimizationPolicy.rps),
    recommendationDigest: sha256(evidence),
    evaluationTime: input.evaluationTime,
    ranked,
  };
}
