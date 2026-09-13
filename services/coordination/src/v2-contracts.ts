export const INTERVIEW_V2_POLICY_VERSION = "INTERVIEW_DERIVED_OPTIMIZATION_V2" as const;
export const INTERVIEW_V2_CLASSIFICATION = "SIMULATION_ONLY" as const;
export const INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY = "DISABLED_UNAPPROVED_POLICY" as const;

export const INTERVIEW_V2_BLOOD_TYPES = [
  "A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE",
  "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE",
] as const;
export type InterviewV2BloodType = (typeof INTERVIEW_V2_BLOOD_TYPES)[number];

export const INTERVIEW_V2_COMPONENT_TYPES = [
  "WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS",
] as const;
export type InterviewV2ComponentType = (typeof INTERVIEW_V2_COMPONENT_TYPES)[number];

export interface SourceSurplusEvidenceV2 {
  evidenceId: string;
  sourceInstitutionId: string;
  bloodType: InterviewV2BloodType;
  componentType: InterviewV2ComponentType;
  surplusQuantity: number;
  asOf: string;
  horizonDate: string;
  forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE";
  modelVersion: string;
  inventorySnapshotId?: string;
  sourceProjectionDigest?: string;
  classification: typeof INTERVIEW_V2_CLASSIFICATION;
  recommendationEligibility: typeof INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY;
}

export interface InterviewV2ContextEvidence {
  relationshipClass: "PARTNER" | "NON_PARTNER" | "UNKNOWN";
  scheduledDonationWindow: { startDate: string; endDate: string } | null;
}

export function validateSourceSurplusEvidenceV2(input: SourceSurplusEvidenceV2): void {
  if (input.classification !== INTERVIEW_V2_CLASSIFICATION ||
      input.recommendationEligibility !== INTERVIEW_V2_RECOMMENDATION_ELIGIBILITY ||
      input.surplusQuantity < 0 || !Number.isSafeInteger(input.surplusQuantity) ||
      input.forecastStatus !== "AVAILABLE" ||
      (input.inventorySnapshotId !== undefined && !/^CENSUS_[A-Z0-9_-]{1,56}$/.test(input.inventorySnapshotId)) ||
      (input.sourceProjectionDigest !== undefined && !/^[0-9a-f]{64}$/.test(input.sourceProjectionDigest))) {
    throw new Error("COORD_V2_SURPLUS_NOT_ELIGIBLE");
  }
}
