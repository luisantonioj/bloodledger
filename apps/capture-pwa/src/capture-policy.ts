import {
  BLOOD_TYPES,
  COMPONENT_TYPES,
  type BloodType,
  type CapturedInboundLabel,
  type ComponentType,
  type ContractVersion,
  type FieldConfidence,
} from "./types";

export const CAPTURE_POLICY_VERSION = "INBOUND_OCR_V1" as const;
export const OCR_ENGINE_VERSION = "7.0.0" as const;
export const ENABLED_ISSUER_INSTITUTION_ID = "INST_MEDIATRIX" as const;
export const MINIMUM_FIELD_CONFIDENCE = 90;

const MEDIATRIX_DONATION_NUMBER = /^MM[0-9]{2}-(0[1-9]|1[0-2])-[0-9]{4}$/;
const PROHIBITED_TEXT = /\b(PATIENT|DONOR|DIAGNOSIS|TREATMENT|EMPLOYEE)\b/i;

export class CapturePolicyError extends Error {
  public constructor(public readonly code: string) {
    super(code);
  }
}

function exactUtc(value: string): boolean {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

export function contractVersionFor(componentType: ComponentType): ContractVersion {
  return componentType === "CRYOPRECIPITATE" ? "V2.1" : "V2";
}

export function validateCapturedLabel(label: CapturedInboundLabel): CapturedInboundLabel {
  if (!MEDIATRIX_DONATION_NUMBER.test(label.donationNumber)) {
    throw new CapturePolicyError("INBOUND_DONATION_NUMBER_INVALID");
  }
  if (!BLOOD_TYPES.includes(label.bloodType)) {
    throw new CapturePolicyError("V2_BLOOD_TYPE_INVALID");
  }
  if (!COMPONENT_TYPES.includes(label.componentType)) {
    throw new CapturePolicyError("V2_COMPONENT_TYPE_INVALID");
  }
  if (!exactUtc(label.collectedAt) || !exactUtc(label.expiresAt)) {
    throw new CapturePolicyError("INBOUND_OCR_TIME_INVALID");
  }
  if (Date.parse(label.expiresAt) <= Date.parse(label.collectedAt)) {
    throw new CapturePolicyError("INBOUND_EXPIRY_INVALID");
  }
  return label;
}

export function validateConfidence(confidence: FieldConfidence): FieldConfidence {
  for (const key of ["donationNumber", "bloodType", "componentType", "collectedAt", "expiresAt"] as const) {
    const value = confidence[key];
    if (!Number.isInteger(value) || value < MINIMUM_FIELD_CONFIDENCE || value > 100) {
      throw new CapturePolicyError("INBOUND_OCR_CONFIDENCE_LOW");
    }
  }
  return confidence;
}

interface RecognizedLine {
  text: string;
  confidence: number;
}

export function parseInboundOcrLines(lines: RecognizedLine[]): {
  label: CapturedInboundLabel;
  fieldConfidence: FieldConfidence;
} {
  const populated = lines
    .map((line) => ({ ...line, text: line.text.trim() }))
    .filter((line) => line.text !== "");
  const text = populated.map((line) => line.text).join("\n");
  if (PROHIBITED_TEXT.test(text)) throw new CapturePolicyError("CAPTURE_PROHIBITED_TEXT");
  if (populated.length !== 5) throw new CapturePolicyError("CAPTURE_REQUIRED_FIELD_MISSING");

  const labels = ["DONATION NO", "BLOOD TYPE", "COMPONENT", "COLLECTED AT", "EXPIRES AT"] as const;
  const matched = new Map<string, RecognizedLine>();
  for (const line of populated) {
    const label = labels.find((candidate) => line.text.toUpperCase().startsWith(candidate + ":"));
    if (!label || matched.has(label)) throw new CapturePolicyError("CAPTURE_FIELD_NOT_ALLOWED");
    matched.set(label, line);
  }

  const valueAfter = (label: (typeof labels)[number]): string => {
    const line = matched.get(label);
    if (!line) throw new CapturePolicyError("CAPTURE_REQUIRED_FIELD_MISSING");
    return line.text.slice(line.text.indexOf(":") + 1).trim();
  };

  const label = validateCapturedLabel({
    donationNumber: valueAfter("DONATION NO"),
    bloodType: valueAfter("BLOOD TYPE") as BloodType,
    componentType: valueAfter("COMPONENT") as ComponentType,
    collectedAt: valueAfter("COLLECTED AT"),
    expiresAt: valueAfter("EXPIRES AT"),
  });
  const fieldConfidence = validateConfidence({
    donationNumber: Math.round(matched.get("DONATION NO")!.confidence),
    bloodType: Math.round(matched.get("BLOOD TYPE")!.confidence),
    componentType: Math.round(matched.get("COMPONENT")!.confidence),
    collectedAt: Math.round(matched.get("COLLECTED AT")!.confidence),
    expiresAt: Math.round(matched.get("EXPIRES AT")!.confidence),
  });
  return { label, fieldConfidence };
}

export function parseInboundOcrText(text: string, confidence: number) {
  return parseInboundOcrLines(
    text.split(/\r?\n/).map((line) => ({ text: line, confidence })),
  );
}
