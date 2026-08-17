import locationPolicyJson from "../policy/synthetic-location-v1.json" with { type: "json" };
import optimizationPolicyJson from "../policy/synthetic-optimization-v1.json" with { type: "json" };
import { fail } from "./errors.js";

export type Urgency = "ROUTINE" | "URGENT" | "CRITICAL";
export type LocationPhase = "DISPATCH" | "RECEIPT";

export interface FacilityFixture {
  institutionId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  distanceFromSourceKm: number;
}

export const locationPolicy = locationPolicyJson as {
  classification: "SYNTHETIC_DATA";
  policyVersion: "SYNTHETIC_LOCATION_V1";
  maximumAccuracyMetres: number;
  facilityMatchRadiusMetres: number;
  retentionDays: number;
  allowedFallbackReasons: string[];
  facilities: FacilityFixture[];
  limitations: string[];
};

export const optimizationPolicy = optimizationPolicyJson as {
  classification: "SIMULATION_ONLY";
  policyVersion: "SYNTHETIC_OPTIMIZATION_V1";
  recommendationEligibility: "DISABLED_UNAPPROVED_POLICY";
  rps: {
    urgencyWeights: Record<Urgency, number>;
    urgencyWeight: number;
    waitWeight: number;
    waitCapHours: number;
    tieBreak: string[];
  };
  broa: {
    normalization: "MIN_MAX";
    equalValueContribution: number;
    weights: {
      urgency: number;
      stockShortage: number;
      mlSurplus: number;
      distancePenalty: number;
    };
    requiresScenarioModeForForecast: boolean;
    automaticApprovalEnabled: false;
  };
  limitations: string[];
};

export function validatePolicies(): void {
  if (
    locationPolicy.policyVersion !== "SYNTHETIC_LOCATION_V1" ||
    locationPolicy.retentionDays !== 30 ||
    locationPolicy.facilities.length !== 6 ||
    new Set(locationPolicy.facilities.map((facility) => facility.institutionId)).size !== 6
  ) fail("COORD_LOCATION_POLICY_INVALID");
  const rpsWeight = optimizationPolicy.rps.urgencyWeight + optimizationPolicy.rps.waitWeight;
  const broaWeight = Object.values(optimizationPolicy.broa.weights).reduce((sum, value) => sum + value, 0);
  if (
    Math.abs(rpsWeight - 1) > Number.EPSILON ||
    Math.abs(broaWeight - 1) > Number.EPSILON ||
    optimizationPolicy.broa.automaticApprovalEnabled !== false ||
    optimizationPolicy.recommendationEligibility !== "DISABLED_UNAPPROVED_POLICY"
  ) fail("COORD_OPTIMIZATION_POLICY_INVALID");
}
