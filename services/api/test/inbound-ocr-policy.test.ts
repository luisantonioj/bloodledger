import assert from "node:assert/strict";
import test from "node:test";
import { validateInboundOcrInput } from "../src/inbound-ocr-policy.js";

const valid = {
  captureMethod: "OCR", capturePolicyVersion: "INBOUND_OCR_V1", issuerInstitutionId: "INST_MEDIATRIX", donationNumber: "MM26-08-4046",
  bloodType: "O_POSITIVE", bloodTypeEvidence: { source: "OCR_LABEL", confirmed: true }, componentType: "PACKED_RED_BLOOD_CELLS", componentEvidence: { source: "BAG_TYPE", confirmed: true },
  collectedAt: "2026-08-12T01:00:00.000Z", expiresAt: "2026-09-12T01:00:00.000Z", capturedAt: "2026-09-12T02:00:00.000Z", confirmedAt: "2026-09-12T02:01:00.000Z", eventTime: "2026-09-12T02:01:00.000Z", correlationId: "CORR_00000000000000000000000000000001",
  ocrEvidence: { engine: "synthetic-ocr", engineVersion: "1", fieldConfidence: { donationNumber: 99, bloodType: 95, collectedAt: 98, expiresAt: 99 } },
};

test("accepts confirmed OCR-only Mediatrix intake without shelf-life inference", () => {
  const capture = validateInboundOcrInput(valid);
  assert.equal(capture.donationNumber, "MM26-08-4046");
  assert.equal(capture.expiresAt, valid.expiresAt);
});

test("rejects low confidence and manual fallback fields", () => {
  const code = (expected: string, value: unknown) => assert.throws(() => validateInboundOcrInput(value), (error: unknown) => (error as { code?: string }).code === expected);
  code("INBOUND_OCR_CONFIDENCE_LOW", { ...valid, ocrEvidence: { ...valid.ocrEvidence, fieldConfidence: { ...valid.ocrEvidence.fieldConfidence, expiresAt: 89 } } });
  code("INBOUND_OCR_POLICY_MISMATCH", { ...valid, captureMethod: "MANUAL" });
  code("INBOUND_DONATION_NUMBER_INVALID", { ...valid, donationNumber: "MM26-13-4046" });
});

test("allows explicitly enabled external issuer with bounded opaque number", () => {
  const capture = validateInboundOcrInput({ ...valid, issuerInstitutionId: "INST_PRC", donationNumber: "PRC/2026.004046" }, ["INST_MEDIATRIX", "INST_PRC"]);
  assert.equal(capture.issuerInstitutionId, "INST_PRC");
});

test("keeps CRYOPRECIPITATE behind the explicit V2.1 contract", () => {
  assert.throws(() => validateInboundOcrInput({ ...valid, componentType: "CRYOPRECIPITATE" }), (error: unknown) => (error as { code?: string }).code === "V2_COMPONENT_TYPE_INVALID");
  const capture = validateInboundOcrInput({ ...valid, componentType: "CRYOPRECIPITATE" }, ["INST_MEDIATRIX"], "V2.1");
  assert.equal(capture.componentType, "CRYOPRECIPITATE");
});
