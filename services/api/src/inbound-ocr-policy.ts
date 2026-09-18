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
  if (!(issuerInstitutionId === "INST_MEDIATRIX" ? MEDIATRIX_DONATION_NUMBER : EXTERNAL_DONATION_NUMBER).test(donationNumber)) throw new ApiFailure(400, "INBOUND_DONATION_NUMBER_INVALID", "The Donation No. does not match the issuer format policy.");
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
