export const BLOOD_TYPES = ["A_POSITIVE", "O_POSITIVE"] as const;
export const COMPONENTS = ["RED_BLOOD_CELLS", "PLATELETS"] as const;
export const CAPTURE_METHODS = [
  "OCR",
  "CODE_128_FALLBACK",
  "DATA_MATRIX_FALLBACK",
  "SYNTHETIC_QR_FALLBACK",
] as const;

export type BloodType = (typeof BLOOD_TYPES)[number];
export type Component = (typeof COMPONENTS)[number];
export const FORECAST_BLOOD_TYPES = ["A_POSITIVE", "B_POSITIVE", "AB_POSITIVE", "O_POSITIVE"] as const;
export const FORECAST_COMPONENTS = ["RED_BLOOD_CELLS", "PACKED_RED_BLOOD_CELLS", "PLATELETS", "FRESH_FROZEN_PLASMA", "CRYOPRECIPITATE", "WHOLE_BLOOD"] as const;
export type ForecastBloodType = (typeof FORECAST_BLOOD_TYPES)[number];
export type ForecastComponent = (typeof FORECAST_COMPONENTS)[number];
export type CaptureMethod = (typeof CAPTURE_METHODS)[number];
export type ScanStatus =
  | "QUEUED"
  | "SUBMITTING"
  | "RETRY_WAIT"
  | "LEDGER_COMMITTED_PROJECTION_PENDING"
  | "COMMITTED"
  | "FAILED"
  | "CONFLICT";

export interface ConfidenceEvidence {
  unitId: number;
  bloodType: number;
  component: number;
  collectedAt: number;
  expiresAt: number;
}

export interface CapturedUnit {
  unitId: string;
  bloodType: BloodType;
  component: Component;
  collectedAt: string;
  expiresAt: string;
}

export interface CaptureInput {
  captureMethod: CaptureMethod;
  capturePolicyVersion: "SYNTHETIC_CAPTURE_V1";
  capturedAt: string;
  confirmedAt: string;
  unit: CapturedUnit;
  ocrEvidence: null | {
    engine: "TESSERACT_JS";
    engineVersion: "7.0.0";
    fieldConfidence: ConfidenceEvidence;
  };
}

export interface Principal {
  actorUserId: string;
  institutionId: "INST_MEDIATRIX";
  role: "INVENTORY_OPERATOR";
}

export interface ScanEvent extends CaptureInput {
  eventId: string;
  correlationId: string;
  idempotencyKey: string;
  payloadSha256: string;
  actorUserId: string;
  institutionId: string;
  receivedAt: string;
  classification: "SIMULATION_ONLY";
  recommendationEligibility: "DISABLED_UNAPPROVED_POLICY";
  status: ScanStatus;
  attemptCount: number;
  nextAttemptAt: string;
  ledgerTransactionId: string | null;
  ledgerCommittedAt: string | null;
  safeErrorCode: string | null;
  version: number;
}

export interface ForecastRecord {
  runKey: string;
  institutionId: string;
  bloodType: ForecastBloodType;
  component: ForecastComponent;
  horizonDate: string;
  asOfDate: string;
  pointForecast: number;
  lowerForecast: number | null;
  upperForecast: number | null;
  uncertaintyStatus: "CALIBRATED" | "UNCERTAINTY_UNAVAILABLE";
  uncertaintyNote: string | null;
  datasetVersion: string;
  modelVersion: string;
  forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE";
  classification: "SIMULATION_ONLY";
  recommendationEligibility: "DISABLED_UNAPPROVED_POLICY";
  generatedAt: string;
  stale: boolean;
}

export interface ForecastRead {
  businessDate: string;
  status: "CURRENT" | "STALE" | "UNAVAILABLE";
  datasetVersion: string;
  modelVersion: string | null;
  asOfDate: string | null;
  horizonDate: string | null;
  forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE";
  unavailableReason: string | null;
  forecasts: ForecastRecord[];
}

export interface AcceptedScan {
  event: ScanEvent;
  replayed: boolean;
}
