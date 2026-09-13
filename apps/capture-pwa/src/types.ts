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
export type CaptureMethod = (typeof CAPTURE_METHODS)[number];

export interface CapturedUnit {
  unitId: string;
  bloodType: BloodType;
  component: Component;
  collectedAt: string;
  expiresAt: string;
}

export type FieldConfidence = Record<keyof CapturedUnit, number>;

export interface ConfirmedCapture {
  captureMethod: CaptureMethod;
  capturePolicyVersion: "SYNTHETIC_CAPTURE_V1";
  capturedAt: string;
  confirmedAt: string;
  unit: CapturedUnit;
  ocrEvidence: null | {
    engine: "TESSERACT_JS";
    engineVersion: "7.0.0";
    fieldConfidence: FieldConfidence;
  };
}

export interface LocalScanEvent {
  idempotencyKey: string;
  capture: ConfirmedCapture;
  dataClassification: "SYNTHETIC_DATA";
  status:
    | "LOCAL_PENDING"
    | "QUEUED"
    | "SUBMITTING"
    | "RETRY_WAIT"
    | "LEDGER_COMMITTED_PROJECTION_PENDING"
    | "COMMITTED"
    | "FAILED"
    | "CONFLICT";
  eventId?: string;
  correlationId?: string;
  safeErrorCode?: string;
  createdAt: string;
}
