import { fail } from "./errors.js";
import { sha256 } from "./hash.js";
import { optimizationPolicy } from "./policies.js";

const INSTITUTION_ID = /^INST_[A-Z0-9_-]{1,59}$/;
const UNIT_ID = /^UNIT_[A-Z0-9_-]{1,56}$/;

export interface BroaCandidate {
  institutionId: string;
  urgency: number;
  stockShortage: number;
  mlSurplus: number;
  distanceKm: number;
  eligible: boolean;
}

export interface BroaUnit { unitId: string; expiresAt: string; eligible: boolean }

export interface BroaInput {
  evaluationTime: string;
  trigger: "NEAR_EXPIRY" | "FORECAST_SURPLUS";
  scenarioMode: boolean;
  forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE";
  units: BroaUnit[];
  candidates: BroaCandidate[];
}

function normalize(values: number[], value: number): number {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return maximum === minimum ? optimizationPolicy.broa.equalValueContribution : (value - minimum) / (maximum - minimum);
}

export function recommendBroa(input: BroaInput) {
  if (typeof input !== "object" || input === null ||
      !Array.isArray(input.units) || !Array.isArray(input.candidates)) {
    fail("COORD_BROA_INPUT_INVALID");
  }
  const evaluationMs = Date.parse(input.evaluationTime);
  if (!Number.isFinite(evaluationMs) || new Date(evaluationMs).toISOString() !== input.evaluationTime) {
    fail("COORD_BROA_TIME_INVALID");
  }
  if (input.trigger === "FORECAST_SURPLUS" && (!input.scenarioMode || input.forecastStatus !== "AVAILABLE")) {
    fail(input.forecastStatus === "STALE" ? "COORD_FORECAST_STALE" : "COORD_FORECAST_NOT_ELIGIBLE");
  }
  if (input.trigger !== "FORECAST_SURPLUS" && input.trigger !== "NEAR_EXPIRY") fail("COORD_BROA_TRIGGER_INVALID");
  const unitIds = new Set<string>();
  for (const unit of input.units) {
    const expiresMs = Date.parse(unit.expiresAt);
    if (!UNIT_ID.test(unit.unitId) || unitIds.has(unit.unitId) ||
        !Number.isFinite(expiresMs) || new Date(expiresMs).toISOString() !== unit.expiresAt ||
        typeof unit.eligible !== "boolean") {
      fail("COORD_BROA_UNITS_INVALID");
    }
    unitIds.add(unit.unitId);
  }
  const units = input.units.filter((unit) => unit.eligible && Date.parse(unit.expiresAt) > evaluationMs)
    .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt) || left.unitId.localeCompare(right.unitId));
  if (units.length === 0) fail("COORD_BROA_NO_ELIGIBLE_UNITS");
  const candidateIds = new Set<string>();
  for (const candidate of input.candidates) {
    if (typeof candidate !== "object" || candidate === null ||
        !INSTITUTION_ID.test(candidate.institutionId) || candidateIds.has(candidate.institutionId) ||
        typeof candidate.eligible !== "boolean" ||
        [candidate.urgency, candidate.stockShortage, candidate.mlSurplus, candidate.distanceKm]
          .some((value) => !Number.isFinite(value) || value < 0)) {
      fail("COORD_BROA_CANDIDATES_INVALID");
    }
    candidateIds.add(candidate.institutionId);
  }
  const candidates = input.candidates.filter((candidate) => candidate.eligible);
  if (candidates.length === 0) fail("COORD_BROA_CANDIDATES_INVALID");
  const values = {
    urgency: candidates.map((candidate) => candidate.urgency),
    stockShortage: candidates.map((candidate) => candidate.stockShortage),
    mlSurplus: candidates.map((candidate) => candidate.mlSurplus),
    distanceKm: candidates.map((candidate) => candidate.distanceKm),
  };
  const ranked = candidates.map((candidate) => {
    const normalized = {
      urgency: normalize(values.urgency, candidate.urgency),
      stockShortage: normalize(values.stockShortage, candidate.stockShortage),
      mlSurplus: normalize(values.mlSurplus, candidate.mlSurplus),
      distancePenalty: normalize(values.distanceKm, candidate.distanceKm),
    };
    const contributions = {
      urgency: normalized.urgency * optimizationPolicy.broa.weights.urgency,
      stockShortage: normalized.stockShortage * optimizationPolicy.broa.weights.stockShortage,
      mlSurplus: normalized.mlSurplus * optimizationPolicy.broa.weights.mlSurplus,
      distancePenalty: normalized.distancePenalty * optimizationPolicy.broa.weights.distancePenalty,
    };
    const score = contributions.urgency + contributions.stockShortage +
      contributions.mlSurplus - contributions.distancePenalty;
    return {
      ...candidate,
      normalized,
      contributions,
      score: Number(score.toFixed(12)),
    };
  }).sort((left, right) => right.score - left.score || left.institutionId.localeCompare(right.institutionId));
  const evidence = { input, policy: optimizationPolicy.broa, selectedUnitId: units[0]?.unitId, ranked };
  return {
    schemaVersion: "BROA_RUN_V1",
    runId: `ARUN_${sha256(evidence).slice(0, 32).toUpperCase()}`,
    algorithm: "BROA" as const,
    algorithmVersion: optimizationPolicy.policyVersion,
    classification: optimizationPolicy.classification,
    recommendationEligibility: optimizationPolicy.recommendationEligibility,
    automaticApproval: false,
    inputSha256: sha256(input),
    configSha256: sha256(optimizationPolicy.broa),
    recommendationDigest: sha256(evidence),
    evaluationTime: input.evaluationTime,
    trigger: input.trigger,
    selectedUnitId: units[0]?.unitId,
    ranked,
  };
}
