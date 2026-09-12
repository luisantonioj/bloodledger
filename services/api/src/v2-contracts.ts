export const V2_POLICY_VERSION = "INTERVIEW_DERIVED_CORE_V2" as const;
export const V2_CLASSIFICATION = "SIMULATION_ONLY" as const;
export const V2_RECOMMENDATION_ELIGIBILITY = "DISABLED_UNAPPROVED_POLICY" as const;

export const V2_BLOOD_TYPES = [
  "A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE",
  "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE",
] as const;
export type V2BloodType = (typeof V2_BLOOD_TYPES)[number];

export const V2_COMPONENT_TYPES = [
  "WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS",
] as const;
export type V2ComponentType = (typeof V2_COMPONENT_TYPES)[number];

export const V2_INVENTORY_STATUSES = [
  "AVAILABLE", "RESERVED", "DISPATCHED", "IN_TRANSIT", "RECEIVED",
  "RELEASED", "COMPROMISED", "EXPIRED", "RECONCILIATION_HOLD",
] as const;
export type V2InventoryStatus = (typeof V2_INVENTORY_STATUSES)[number];

export const V2_COMMAND_STATUSES = [
  "QUEUED", "SUBMITTING", "LEDGER_COMMITTED_PROJECTION_PENDING", "COMMITTED",
  "RETRY_WAIT", "FAILED", "CONFLICT",
] as const;
export type V2CommandStatus = (typeof V2_COMMAND_STATUSES)[number];

export type V2ReservationPurpose = "TRANSFER" | "LOCAL_RELEASE";

export interface V2ComponentView {
  componentId: string;
  donationId: string;
  issuerInstitutionId: string;
  donationNumber?: string;
  donationNumberDigest: string;
  componentType: V2ComponentType;
  bloodType: V2BloodType;
  collectedAt: string;
  expiresAt: string;
  institutionId: string;
  status: V2InventoryStatus;
  reservationPurpose: V2ReservationPurpose | null;
  reservationId: string | null;
  version: number;
  policyVersion: typeof V2_POLICY_VERSION;
  classification: typeof V2_CLASSIFICATION;
}

export interface V2LedgerCommandView {
  commandId: string;
  resourceType: "COMPONENT" | "TRANSFER" | "LOCAL_RELEASE" | "RECONCILIATION";
  resourceId: string;
  status: V2CommandStatus;
  statusUrl: string;
  acceptedAt: string;
  correlationId: string;
  safeErrorCode: string | null;
  classification: typeof V2_CLASSIFICATION;
}

export interface V2SourceSurplusEvidence {
  evidenceId: string;
  sourceInstitutionId: string;
  bloodType: V2BloodType;
  componentType: V2ComponentType;
  surplusQuantity: number;
  asOf: string;
  horizonDate: string;
  forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE";
  modelVersion: string;
  classification: typeof V2_CLASSIFICATION;
  recommendationEligibility: typeof V2_RECOMMENDATION_ELIGIBILITY;
}

export function isV2BloodType(value: unknown): value is V2BloodType {
  return typeof value === "string" && (V2_BLOOD_TYPES as readonly string[]).includes(value);
}

export function isV2ComponentType(value: unknown): value is V2ComponentType {
  return typeof value === "string" && (V2_COMPONENT_TYPES as readonly string[]).includes(value);
}

export function isV2CommandStatus(value: unknown): value is V2CommandStatus {
  return typeof value === "string" && (V2_COMMAND_STATUSES as readonly string[]).includes(value);
}
