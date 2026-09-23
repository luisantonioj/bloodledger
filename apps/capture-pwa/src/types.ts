export const BLOOD_TYPES = [
  "A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE",
  "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE",
] as const;
export const COMPONENT_TYPES = [
  "WHOLE_BLOOD",
  "PACKED_RED_BLOOD_CELLS",
  "FRESH_FROZEN_PLASMA",
  "PLATELETS",
  "CRYOPRECIPITATE",
] as const;

export const COMMAND_STATUSES = [
  "QUEUED",
  "SUBMITTING",
  "RETRY_WAIT",
  "LEDGER_COMMITTED_PROJECTION_PENDING",
  "COMMITTED",
  "FAILED",
  "CONFLICT",
] as const;

export type BloodType = (typeof BLOOD_TYPES)[number];
export type ComponentType = (typeof COMPONENT_TYPES)[number];
export type ContractVersion = "V2" | "V2.1";
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export interface CapturedInboundLabel {
  donationNumber: string;
  bloodType: BloodType;
  componentType: ComponentType;
  collectedAt: string;
  expiresAt: string;
}

export type FieldConfidence = Record<keyof CapturedInboundLabel, number>;

export interface InboundOcrCapture {
  captureMethod: "OCR";
  capturePolicyVersion: "INBOUND_OCR_V1";
  issuerInstitutionId: string;
  donationNumber: string;
  bloodType: BloodType;
  bloodTypeEvidence: { source: "OCR_LABEL"; confirmed: true };
  componentType: ComponentType;
  componentEvidence: { source: "OCR_LABEL"; confirmed: true };
  collectedAt: string;
  expiresAt: string;
  capturedAt: string;
  confirmedAt: string;
  eventTime: string;
  correlationId: string;
  ocrEvidence: {
    engine: "TESSERACT_JS";
    engineVersion: "7.0.0";
    fieldConfidence: Pick<FieldConfidence, "donationNumber" | "bloodType" | "collectedAt" | "expiresAt">;
  };
}

export interface V2Command {
  commandId: string;
  resourceType: "COMPONENT" | "INBOUND_CAPTURE" | "TRANSFER" | "LOCAL_RELEASE" | "RECONCILIATION";
  resourceId: string;
  status: CommandStatus;
  statusUrl: string;
  acceptedAt: string;
  correlationId: string;
  safeErrorCode: string | null;
  classification: "SIMULATION_ONLY";
  replayed: boolean;
}

export interface AlreadyRegisteredCapture {
  captureId: string;
  resolution: "ALREADY_REGISTERED";
  componentId: string;
  status: string;
  classification: "SIMULATION_ONLY";
}

export type InboundCaptureResult = V2Command | AlreadyRegisteredCapture;

/** Privacy-safe status evidence. Exact Donation No. and OCR payloads are never stored here. */
export interface StoredCommandReceipt {
  idempotencyKey?: string;
  commandId: string;
  resourceId: string;
  statusUrl: string;
  status: CommandStatus;
  correlationId: string;
  acceptedAt: string;
  safeErrorCode: string | null;
  bloodType?: BloodType;
  componentType?: ComponentType;
  issuerInstitutionId?: string;
  terminalObservedAt?: string;
  classification: "SIMULATION_ONLY";
}
