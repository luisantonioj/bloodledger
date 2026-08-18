import { ApiFailure } from "./errors.js";
import {
  BLOOD_TYPES,
  CAPTURE_METHODS,
  COMPONENTS,
  type CaptureInput,
} from "./types.js";

const EXACT_KEYS = [
  "captureMethod",
  "capturePolicyVersion",
  "capturedAt",
  "confirmedAt",
  "unit",
  "ocrEvidence",
].sort();
const UNIT_KEYS = ["unitId", "bloodType", "component", "collectedAt", "expiresAt"].sort();
const OCR_EVIDENCE_KEYS = ["engine", "engineVersion", "fieldConfidence"].sort();
const CONFIDENCE_KEYS = [
  "unitId",
  "bloodType",
  "component",
  "collectedAt",
  "expiresAt",
].sort();
const PROHIBITED_KEYS = new Set([
  "patient",
  "patientName",
  "donor",
  "donorName",
  "diagnosis",
  "treatment",
  "employeeId",
  "image",
  "imageData",
  "rawText",
  "ocrText",
]);

function assertExactKeys(value: Record<string, unknown>, expected: string[]): void {
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    if (actual.some((key) => PROHIBITED_KEYS.has(key))) {
      throw new ApiFailure(400, "PROHIBITED_FIELD", "Prohibited sensitive or raw capture field.");
    }
    throw new ApiFailure(400, "INVALID_CAPTURE_PAYLOAD", "Capture payload does not match the approved contract.");
  }
}

function parseTimestamp(value: unknown, field: string): Date {
  if (typeof value !== "string") {
    throw new ApiFailure(400, "INVALID_CAPTURE_PAYLOAD", `${field} must be an ISO timestamp.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ApiFailure(400, "INVALID_CAPTURE_PAYLOAD", `${field} must be a canonical UTC timestamp.`);
  }
  return parsed;
}

export function validateCaptureInput(value: unknown): CaptureInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiFailure(400, "INVALID_CAPTURE_PAYLOAD", "Capture payload must be an object.");
  }
  const input = value as Record<string, unknown>;
  assertExactKeys(input, EXACT_KEYS);
  if (input.unit === null || typeof input.unit !== "object" || Array.isArray(input.unit)) {
    throw new ApiFailure(400, "INVALID_CAPTURE_PAYLOAD", "Unit must be an exact object.");
  }
  const unit = input.unit as Record<string, unknown>;
  assertExactKeys(unit, UNIT_KEYS);
  if (typeof unit.unitId !== "string" || !/^UNIT_[A-Z0-9_-]{1,56}$/.test(unit.unitId)) {
    throw new ApiFailure(400, "INVALID_UNIT_ID", "Unit ID is invalid.");
  }
  if (!BLOOD_TYPES.includes(unit.bloodType as never) || !COMPONENTS.includes(unit.component as never)) {
    throw new ApiFailure(400, "INVALID_CAPTURE_PAYLOAD", "Blood type or component is unsupported.");
  }
  if (!CAPTURE_METHODS.includes(input.captureMethod as never)) {
    throw new ApiFailure(400, "INVALID_CAPTURE_PAYLOAD", "Capture method is unsupported.");
  }
  if (
    input.capturePolicyVersion !== "SYNTHETIC_CAPTURE_V1"
  ) {
    throw new ApiFailure(400, "UNAPPROVED_CAPTURE_POLICY", "Only the approved simulation policy is allowed.");
  }
  const collectedAt = parseTimestamp(unit.collectedAt, "collectedAt");
  const expiresAt = parseTimestamp(unit.expiresAt, "expiresAt");
  const capturedAt = parseTimestamp(input.capturedAt, "capturedAt");
  const confirmedAt = parseTimestamp(input.confirmedAt, "confirmedAt");
  const maximumLifetime = unit.component === "RED_BLOOD_CELLS" ? 72 * 3_600_000 : 36 * 3_600_000;
  if (expiresAt <= collectedAt || expiresAt.getTime() - collectedAt.getTime() > maximumLifetime) {
    throw new ApiFailure(400, "INVALID_EXPIRY", "Expiry violates the synthetic inventory policy.");
  }
  if (capturedAt < collectedAt || confirmedAt < capturedAt) {
    throw new ApiFailure(400, "INVALID_CAPTURE_TIME", "Capture timestamps are not ordered.");
  }
  if (input.captureMethod === "OCR") {
    if (input.ocrEvidence === null || typeof input.ocrEvidence !== "object" || Array.isArray(input.ocrEvidence)) {
      throw new ApiFailure(400, "INVALID_OCR_EVIDENCE", "OCR evidence is required.");
    }
    const evidence = input.ocrEvidence as Record<string, unknown>;
    assertExactKeys(evidence, OCR_EVIDENCE_KEYS);
    if (evidence.engine !== "TESSERACT_JS" || evidence.engineVersion !== "7.0.0") {
      throw new ApiFailure(400, "INVALID_OCR_EVIDENCE", "OCR engine evidence is invalid.");
    }
    if (evidence.fieldConfidence === null || typeof evidence.fieldConfidence !== "object" || Array.isArray(evidence.fieldConfidence)) {
      throw new ApiFailure(400, "LOW_OCR_CONFIDENCE", "All OCR fields require confidence evidence.");
    }
    const confidence = evidence.fieldConfidence as Record<string, unknown>;
    assertExactKeys(confidence, CONFIDENCE_KEYS);
    if (CONFIDENCE_KEYS.some((field) => !Number.isInteger(confidence[field]) || Number(confidence[field]) < 90 || Number(confidence[field]) > 100)) {
      throw new ApiFailure(400, "LOW_OCR_CONFIDENCE", "All OCR fields must have confidence of at least 90.");
    }
  } else if (input.ocrEvidence !== null) {
    throw new ApiFailure(400, "INVALID_FALLBACK_EVIDENCE", "Fallback scans must not claim OCR evidence.");
  }
  return input as unknown as CaptureInput;
}
