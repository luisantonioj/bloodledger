import { ApiFailure } from "./errors.js";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES, INTERVIEW_V2_1_COMPONENT_TYPES, type V2BloodType, type V2ComponentType } from "./v2-contracts.js";

export const INBOUND_OCR_POLICY_VERSION = "INBOUND_OCR_V1" as const;
export const INBOUND_CAPTURE_METHOD = "OCR" as const;
const MEDIATRIX_DONATION_NUMBER = /^MM[0-9]{2}-(0[1-9]|1[0-2])-[0-9]{4}$/;
const EXTERNAL_DONATION_NUMBER = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/;
const INSTITUTION = /^INST_[A-Z0-9_-]{1,59}$/;
const CORRELATION = /^CORR_[0-9A-F]{32}$/;

export type InboundOcrInput = {
  captureMethod: "OCR";
  capturePolicyVersion: typeof INBOUND_OCR_POLICY_VERSION;
  issuerInstitutionId: string;
  donationNumber: string;
  bloodType: V2BloodType;
  bloodTypeEvidence: { source: "OCR_LABEL" | "OPERATOR_CONFIRMED"; confirmed: true };
  componentType: V2ComponentType | typeof INTERVIEW_V2_1_COMPONENT_TYPES[number];
  componentEvidence: { source: "OCR_LABEL" | "BAG_TYPE" | "OPERATOR_CONFIRMED"; confirmed: true };
  collectedAt: string;
  expiresAt: string;
  capturedAt: string;
  confirmedAt: string;
  eventTime: string;
  correlationId: string;
  ocrEvidence: {
    engine: string;
    engineVersion: string;
    fieldConfidence: { donationNumber: number; bloodType: number; collectedAt: number; expiresAt: number };
  };
};

function stringField(body: Record<string, unknown>, key: string, max = 64): string {
  const value = body[key];
  if (typeof value !== "string" || value.length < 1 || value.length > max) throw new ApiFailure(400, "INBOUND_OCR_INPUT_INVALID", "The OCR inbound capture is invalid.");
  return value;
}
function utc(body: Record<string, unknown>, key: string): string {
  const value = stringField(body, key); const parsed = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new ApiFailure(400, "INBOUND_OCR_TIME_INVALID", "The OCR inbound timestamp is invalid.");
  return value;
}
function evidence(value: unknown, sources: readonly string[]): { source: string; confirmed: true } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiFailure(400, "INBOUND_OCR_EVIDENCE_REQUIRED", "Operator confirmation evidence is required.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "confirmed,source" || record.confirmed !== true || typeof record.source !== "string" || !sources.includes(record.source)) throw new ApiFailure(400, "INBOUND_OCR_EVIDENCE_REQUIRED", "Operator confirmation evidence is required.");
  return { source: record.source, confirmed: true };
}

/**
 * J5 (finding F4): BAG_TYPE and OPERATOR_CONFIRMED were never defined by INBOUND_OCR_V1 (PA-S6-02) and no client
 * sends them, so a new capture must read both blood type and component from the OCR label. validateInboundOcrInput
 * still parses them so a retry of a capture accepted before 2026-10-17 can match its original command and replay.
 * Operator-confirmed values return only in a new contract version under RQ-19.
 */
export function requireOcrLabelEvidence(capture: Pick<InboundOcrInput, "bloodTypeEvidence" | "componentEvidence">): void {
  if (capture.bloodTypeEvidence.source !== "OCR_LABEL" || capture.componentEvidence.source !== "OCR_LABEL") {
    throw new ApiFailure(400, "INBOUND_OCR_EVIDENCE_REQUIRED", "Blood type and component evidence must come from the OCR label.");
  }
}

/** Validate the only supported intake path. Raw OCR text/images are intentionally not accepted. */
export function validateInboundOcrInput(value: unknown, enabledIssuerIds: readonly string[] = ["INST_MEDIATRIX"], contractVersion: "V2" | "V2.1" = "V2"): InboundOcrInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiFailure(400, "INBOUND_OCR_INPUT_INVALID", "The OCR inbound capture is invalid.");
  const body = value as Record<string, unknown>;
  const expected = ["bloodType", "bloodTypeEvidence", "captureMethod", "capturePolicyVersion", "capturedAt", "collectedAt", "componentEvidence", "componentType", "confirmedAt", "correlationId", "donationNumber", "eventTime", "expiresAt", "issuerInstitutionId", "ocrEvidence"].sort();
  if (Object.keys(body).sort().join(",") !== expected.join(",")) throw new ApiFailure(400, "INBOUND_OCR_INPUT_INVALID", "The OCR inbound capture is invalid.");
  if (body.captureMethod !== INBOUND_CAPTURE_METHOD || body.capturePolicyVersion !== INBOUND_OCR_POLICY_VERSION) throw new ApiFailure(400, "INBOUND_OCR_POLICY_MISMATCH", "The inbound capture policy is not supported.");
  const issuerInstitutionId = stringField(body, "issuerInstitutionId");
  if (!INSTITUTION.test(issuerInstitutionId) || !enabledIssuerIds.includes(issuerInstitutionId)) throw new ApiFailure(400, "INBOUND_ISSUER_UNAPPROVED", "The issuer has no enabled inbound format policy.");
  const donationNumber = stringField(body, "donationNumber");
  if (!(issuerInstitutionId === "INST_MEDIATRIX" ? MEDIATRIX_DONATION_NUMBER : issuerInstitutionId === "INST_SYNTH_MEDIX" ? /^SYNMEDIX-[0-9]{4}-[0-9]{4}$/ : issuerInstitutionId === "INST_SYNTH_NLVILLA" ? /^SYNNLVILLA-[0-9]{4}-[0-9]{4}$/ : EXTERNAL_DONATION_NUMBER).test(donationNumber)) throw new ApiFailure(400, "INBOUND_DONATION_NUMBER_INVALID", "The Donation No. does not match the issuer format policy.");
  const bloodType = stringField(body, "bloodType") as V2BloodType;
  const componentType = stringField(body, "componentType") as V2ComponentType;
  if (!(V2_BLOOD_TYPES as readonly string[]).includes(bloodType)) throw new ApiFailure(400, "V2_BLOOD_TYPE_INVALID", "The blood type is not supported.");
  const supportedComponents = contractVersion === "V2.1" ? INTERVIEW_V2_1_COMPONENT_TYPES : V2_COMPONENT_TYPES;
  if (!(supportedComponents as readonly string[]).includes(componentType)) throw new ApiFailure(400, "V2_COMPONENT_TYPE_INVALID", "The component type is not supported by this contract version.");
  const bloodTypeEvidence = evidence(body.bloodTypeEvidence, ["OCR_LABEL", "OPERATOR_CONFIRMED"]) as InboundOcrInput["bloodTypeEvidence"];
  const componentEvidence = evidence(body.componentEvidence, ["OCR_LABEL", "BAG_TYPE", "OPERATOR_CONFIRMED"]) as InboundOcrInput["componentEvidence"];
  const ocr = body.ocrEvidence;
  if (!ocr || typeof ocr !== "object" || Array.isArray(ocr)) throw new ApiFailure(400, "INBOUND_OCR_EVIDENCE_INVALID", "OCR engine evidence is invalid.");
  const o = ocr as Record<string, unknown>; const confidence = o.fieldConfidence;
  if (typeof o.engine !== "string" || o.engine.length < 1 || o.engine.length > 64 || typeof o.engineVersion !== "string" || o.engineVersion.length < 1 || o.engineVersion.length > 64 || !confidence || typeof confidence !== "object" || Array.isArray(confidence)) throw new ApiFailure(400, "INBOUND_OCR_EVIDENCE_INVALID", "OCR engine evidence is invalid.");
  const c = confidence as Record<string, unknown>; const confidenceKeys = ["bloodType", "collectedAt", "donationNumber", "expiresAt"].sort();
  if (Object.keys(c).sort().join(",") !== confidenceKeys.join(",")) throw new ApiFailure(400, "INBOUND_OCR_EVIDENCE_INVALID", "OCR confidence evidence is invalid.");
  for (const key of confidenceKeys) if (!Number.isInteger(c[key]) || Number(c[key]) < 90 || Number(c[key]) > 100) throw new ApiFailure(400, "INBOUND_OCR_CONFIDENCE_LOW", "All OCR fields require at least 90 percent confidence.");
  const collectedAt = utc(body, "collectedAt"); const expiresAt = utc(body, "expiresAt");
  if (new Date(expiresAt).getTime() <= new Date(collectedAt).getTime()) throw new ApiFailure(400, "INBOUND_EXPIRY_INVALID", "Printed expiry must be later than collection time.");
  const capturedAt = utc(body, "capturedAt"); const confirmedAt = utc(body, "confirmedAt"); const eventTime = utc(body, "eventTime");
  const correlationId = stringField(body, "correlationId"); if (!CORRELATION.test(correlationId)) throw new ApiFailure(400, "V2_CORRELATION_INVALID", "Correlation ID is invalid.");
  return { captureMethod: "OCR", capturePolicyVersion: INBOUND_OCR_POLICY_VERSION, issuerInstitutionId, donationNumber, bloodType, bloodTypeEvidence, componentType, componentEvidence, collectedAt, expiresAt, capturedAt, confirmedAt, eventTime, correlationId, ocrEvidence: { engine: o.engine, engineVersion: o.engineVersion, fieldConfidence: { donationNumber: Number(c.donationNumber), bloodType: Number(c.bloodType), collectedAt: Number(c.collectedAt), expiresAt: Number(c.expiresAt) } } };
}

// PA-OCR-03 INBOUND_OCR_CORRECTED_V1 (RQ-19, simulation only): an OCR capture in which the operator corrected some
// fields. Every field reports what OCR read and its score; an uncorrected field must equal that read at >= 90, and a
// corrected field states why. At least one field stays OCR-verified, so fully manual entry remains unsupported.
// An OCR score is never evidence for a corrected value.
export const CORRECTED_OCR_POLICY_VERSION = "INBOUND_OCR_CORRECTED_V1" as const;
const MINIMUM_FIELD_CONFIDENCE = 90;
export const CAPTURE_FIELDS = ["donationNumber", "bloodType", "componentType", "collectedAt", "expiresAt"] as const;
export type CaptureField = typeof CAPTURE_FIELDS[number];
export const CORRECTION_REASONS = ["OCR_MISREAD", "OCR_NOT_READ", "OCR_LOW_CONFIDENCE"] as const;
export type CorrectionReason = typeof CORRECTION_REASONS[number];
export interface CorrectedFieldEvidence { field: CaptureField; ocrValue: string | null; ocrConfidence: number | null; corrected: boolean; reason: CorrectionReason | null }
export interface CorrectedInboundInput { capture: InboundOcrInput; fields: CorrectedFieldEvidence[] }

const correctedInvalid = (code = "CORRECTED_CAPTURE_INVALID", message = "The corrected OCR capture is invalid.") => new ApiFailure(400, code, message);

export function validateCorrectedInboundInput(value: unknown, enabledIssuerIds: readonly string[] = ["INST_MEDIATRIX"], contractVersion: "V2" | "V2.1" = "V2"): CorrectedInboundInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw correctedInvalid();
  const body = value as Record<string, unknown>;
  const required = ["bloodType", "captureMethod", "capturePolicyVersion", "capturedAt", "collectedAt", "componentType", "confirmedAt", "correlationId", "donationNumber", "eventTime", "expiresAt", "fields", "issuerInstitutionId", "ocrEvidence"];
  const keys = Object.keys(body).filter((key) => key !== "donationNumberConfirmation").sort();
  if (keys.join(",") !== required.sort().join(",")) throw correctedInvalid();
  if (body.captureMethod !== INBOUND_CAPTURE_METHOD || body.capturePolicyVersion !== CORRECTED_OCR_POLICY_VERSION) throw new ApiFailure(400, "INBOUND_OCR_POLICY_MISMATCH", "The inbound capture policy is not supported.");
  const ocr = body.ocrEvidence as Record<string, unknown> | null;
  if (!ocr || typeof ocr !== "object" || Array.isArray(ocr) || Object.keys(ocr).sort().join(",") !== "engine,engineVersion") throw new ApiFailure(400, "INBOUND_OCR_EVIDENCE_INVALID", "OCR engine evidence is invalid.");
  // The final values pass exactly the INBOUND_OCR_V1 value rules; the placeholder evidence is discarded below.
  const { fields: rawFields, donationNumberConfirmation, ...values } = body;
  const checked = validateInboundOcrInput({ ...values, capturePolicyVersion: INBOUND_OCR_POLICY_VERSION, bloodTypeEvidence: { source: "OCR_LABEL", confirmed: true }, componentEvidence: { source: "OCR_LABEL", confirmed: true },
    ocrEvidence: { engine: ocr.engine, engineVersion: ocr.engineVersion, fieldConfidence: { donationNumber: 100, bloodType: 100, collectedAt: 100, expiresAt: 100 } } }, enabledIssuerIds, contractVersion);
  if (!rawFields || typeof rawFields !== "object" || Array.isArray(rawFields) || Object.keys(rawFields).sort().join(",") !== [...CAPTURE_FIELDS].sort().join(",")) throw correctedInvalid();
  const finalValue = (field: CaptureField) => String(checked[field]);
  const fields = CAPTURE_FIELDS.map((field): CorrectedFieldEvidence => {
    const entry = (rawFields as Record<string, unknown>)[field] as Record<string, unknown> | null;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw correctedInvalid();
    const entryKeys = Object.keys(entry).sort().join(",");
    if (entryKeys !== "corrected,ocrConfidence,ocrValue" && entryKeys !== "corrected,ocrConfidence,ocrValue,reason") throw correctedInvalid();
    const { ocrValue, ocrConfidence, corrected, reason } = entry;
    if (typeof corrected !== "boolean") throw correctedInvalid();
    if (ocrValue !== null && (typeof ocrValue !== "string" || ocrValue.length < 1 || ocrValue.length > 128)) throw correctedInvalid();
    if (ocrConfidence !== null && (!Number.isInteger(ocrConfidence) || Number(ocrConfidence) < 0 || Number(ocrConfidence) > 100)) throw correctedInvalid();
    if (!corrected) {
      // An uncorrected field is the OCR read itself and still needs the >= 90 score.
      if (reason !== undefined || ocrValue !== finalValue(field)) throw correctedInvalid("CORRECTED_CAPTURE_FIELD_MISMATCH", "An uncorrected field must equal its OCR read.");
      if (ocrConfidence === null || Number(ocrConfidence) < MINIMUM_FIELD_CONFIDENCE) throw new ApiFailure(400, "INBOUND_OCR_CONFIDENCE_LOW", "All OCR fields require at least 90 percent confidence.");
      return { field, ocrValue, ocrConfidence: Number(ocrConfidence), corrected, reason: null };
    }
    if (!(CORRECTION_REASONS as readonly unknown[]).includes(reason)) throw correctedInvalid("CORRECTION_REASON_REQUIRED", "Each corrected field needs a correction reason.");
    const consistent = reason === "OCR_NOT_READ" ? ocrValue === null && ocrConfidence === null
      : reason === "OCR_MISREAD" ? ocrValue !== null && ocrValue !== finalValue(field)
      : ocrValue !== null && ocrValue === finalValue(field) && ocrConfidence !== null && Number(ocrConfidence) < MINIMUM_FIELD_CONFIDENCE;
    if (!consistent) throw correctedInvalid("CORRECTION_REASON_INCONSISTENT", "The correction reason does not match the OCR read.");
    return { field, ocrValue: ocrValue as string | null, ocrConfidence: ocrConfidence === null ? null : Number(ocrConfidence), corrected, reason: reason as CorrectionReason };
  });
  if (!fields.some((field) => field.corrected)) throw correctedInvalid("CORRECTED_CAPTURE_WITHOUT_CORRECTION", "Use INBOUND_OCR_V1 when no field was corrected.");
  if (fields.every((field) => field.corrected)) throw correctedInvalid("CORRECTED_CAPTURE_REQUIRES_OCR_FIELD", "At least one field must remain an unchanged OCR read; manual entry is not supported.");
  // A corrected Donation No. is typed twice; an unchanged one carries no confirmation.
  const donationCorrected = fields.find((field) => field.field === "donationNumber")!.corrected;
  if (donationCorrected ? donationNumberConfirmation !== checked.donationNumber : donationNumberConfirmation !== undefined) throw correctedInvalid("CORRECTED_DONATION_CONFIRMATION_MISMATCH", "A corrected Donation No. must be entered twice and match.");
  const evidenceFor = (field: CaptureField): "OCR_LABEL" | "OPERATOR_CONFIRMED" => fields.find((entry) => entry.field === field)!.corrected ? "OPERATOR_CONFIRMED" : "OCR_LABEL";
  const confidenceFor = (field: CaptureField) => fields.find((entry) => entry.field === field)!.ocrConfidence;
  const capture: InboundOcrInput = { ...checked, capturePolicyVersion: INBOUND_OCR_POLICY_VERSION,
    bloodTypeEvidence: { source: evidenceFor("bloodType"), confirmed: true }, componentEvidence: { source: evidenceFor("componentType"), confirmed: true },
    ocrEvidence: { engine: checked.ocrEvidence.engine, engineVersion: checked.ocrEvidence.engineVersion, fieldConfidence: { donationNumber: confidenceFor("donationNumber") ?? 0, bloodType: confidenceFor("bloodType") ?? 0, collectedAt: confidenceFor("collectedAt") ?? 0, expiresAt: confidenceFor("expiresAt") ?? 0 } } };
  return { capture, fields };
}
