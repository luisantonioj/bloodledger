import {
  BLOOD_TYPES,
  COMPONENTS,
  type BloodType,
  type CapturedUnit,
  type Component,
  type FieldConfidence,
} from "./types";

export const CAPTURE_POLICY_VERSION = "SYNTHETIC_CAPTURE_V1" as const;
export const OCR_ENGINE_VERSION = "7.0.0" as const;
export const MINIMUM_FIELD_CONFIDENCE = 90;
const UNIT_PATTERN = /^UNIT_[A-Z0-9_-]{1,56}$/;
const PROHIBITED_TEXT = /\b(PATIENT|DONOR|DIAGNOSIS|TREATMENT|EMPLOYEE)\b/i;
const MAXIMUM_LIFETIME_SECONDS: Record<Component, number> = {
  RED_BLOOD_CELLS: 72 * 60 * 60,
  PLATELETS: 36 * 60 * 60,
};

export class CapturePolicyError extends Error {
  public constructor(public readonly code: string) {
    super(code);
  }
}

function exactUtc(value: string): boolean {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

export function validateCapturedUnit(unit: CapturedUnit): CapturedUnit {
  if (!UNIT_PATTERN.test(unit.unitId)) throw new CapturePolicyError("CAPTURE_UNIT_ID_INVALID");
  if (!BLOOD_TYPES.includes(unit.bloodType)) throw new CapturePolicyError("CAPTURE_BLOOD_TYPE_INVALID");
  if (!COMPONENTS.includes(unit.component)) throw new CapturePolicyError("CAPTURE_COMPONENT_INVALID");
  if (!exactUtc(unit.collectedAt) || !exactUtc(unit.expiresAt)) {
    throw new CapturePolicyError("CAPTURE_TIME_INVALID");
  }
  const lifetime = (Date.parse(unit.expiresAt) - Date.parse(unit.collectedAt)) / 1000;
  if (lifetime <= 0 || lifetime > MAXIMUM_LIFETIME_SECONDS[unit.component]) {
    throw new CapturePolicyError("CAPTURE_EXPIRY_INVALID");
  }
  return unit;
}

export function validateConfidence(confidence: FieldConfidence): FieldConfidence {
  for (const key of ["unitId", "bloodType", "component", "collectedAt", "expiresAt"] as const) {
    const value = confidence[key];
    if (!Number.isInteger(value) || value < MINIMUM_FIELD_CONFIDENCE || value > 100) {
      throw new CapturePolicyError("CAPTURE_CONFIDENCE_TOO_LOW");
    }
  }
  return confidence;
}

interface RecognizedLine {
  text: string;
  confidence: number;
}

export function parseSyntheticOcrLines(lines: RecognizedLine[]): {
  unit: CapturedUnit;
  fieldConfidence: FieldConfidence;
} {
  const populated = lines.map((line) => ({ ...line, text: line.text.trim() })).filter((line) => line.text !== "");
  const text = populated.map((line) => line.text).join("\n");
  if (PROHIBITED_TEXT.test(text)) throw new CapturePolicyError("CAPTURE_PROHIBITED_TEXT");
  if (populated.length !== 5) throw new CapturePolicyError("CAPTURE_REQUIRED_FIELD_MISSING");
  const labels = ["UNIT ID", "BLOOD TYPE", "COMPONENT", "COLLECTED AT", "EXPIRES AT"] as const;
  const matched = new Map<string, RecognizedLine>();
  for (const line of populated) {
    const label = labels.find((candidate) => line.text.toUpperCase().startsWith(`${candidate}:`));
    if (!label || matched.has(label)) throw new CapturePolicyError("CAPTURE_FIELD_NOT_ALLOWED");
    matched.set(label, line);
  }
  const valueAfter = (label: (typeof labels)[number]): string => {
    const line = matched.get(label);
    if (!line) throw new CapturePolicyError("CAPTURE_REQUIRED_FIELD_MISSING");
    return line.text.slice(line.text.indexOf(":") + 1).trim();
  };
  const unit = validateCapturedUnit({
    unitId: valueAfter("UNIT ID"),
    bloodType: valueAfter("BLOOD TYPE") as BloodType,
    component: valueAfter("COMPONENT") as Component,
    collectedAt: valueAfter("COLLECTED AT"),
    expiresAt: valueAfter("EXPIRES AT"),
  });
  const fieldConfidence = validateConfidence({
    unitId: Math.round(matched.get("UNIT ID")!.confidence),
    bloodType: Math.round(matched.get("BLOOD TYPE")!.confidence),
    component: Math.round(matched.get("COMPONENT")!.confidence),
    collectedAt: Math.round(matched.get("COLLECTED AT")!.confidence),
    expiresAt: Math.round(matched.get("EXPIRES AT")!.confidence),
  });
  return { unit, fieldConfidence };
}

export function parseSyntheticOcrText(text: string, confidence: number) {
  return parseSyntheticOcrLines(
    text.split(/\r?\n/).map((line) => ({ text: line, confidence })),
  );
}

export function parseSyntheticMachinePayload(payload: string): CapturedUnit {
  if (PROHIBITED_TEXT.test(payload)) throw new CapturePolicyError("CAPTURE_PROHIBITED_TEXT");
  const [version, unitId, bloodType, component, collectedAt, expiresAt, ...extra] = payload.split("|");
  if (version !== "BL1" || extra.length !== 0 || [unitId, bloodType, component, collectedAt, expiresAt].some((value) => !value)) {
    throw new CapturePolicyError("CAPTURE_MACHINE_PAYLOAD_INVALID");
  }
  return validateCapturedUnit({
    unitId,
    bloodType: bloodType as BloodType,
    component: component as Component,
    collectedAt,
    expiresAt,
  });
}
