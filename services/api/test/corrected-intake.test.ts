import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { interviewCorePayload } from "../src/fabric.js";
import { CORRECTED_OCR_POLICY_VERSION, validateCorrectedInboundInput } from "../src/inbound-ocr-policy.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

// PA-OCR-03 INBOUND_OCR_CORRECTED_V1 (RQ-19): an OCR capture with operator corrections. Synthetic values only.
const origin = "http://127.0.0.1:5174";
const now = "2026-10-19T03:00:00.000Z";
const operator: CredentialRecord = { userId: "USR_SYNTH_CORRECT", username: "synth_correct", displayName: "Synthetic Correcting Operator", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix", institutionCategory: "HOSPITAL", roleId: "ROLE-02", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
const keyring = { encryptionKey: Buffer.alloc(32, 0x31), lookupKey: Buffer.alloc(32, 0x42), encryptionKeyVersion: "v1" };

const ok = (value: string, confidence = 96) => ({ ocrValue: value, ocrConfidence: confidence, corrected: false });
function corrected(overrides: Record<string, unknown> = {}, fields: Record<string, unknown> = {}) {
  return {
    captureMethod: "OCR", capturePolicyVersion: CORRECTED_OCR_POLICY_VERSION, issuerInstitutionId: "INST_MEDIATRIX", donationNumber: "MM26-10-9209",
    bloodType: "A_POSITIVE", componentType: "PLATELETS", collectedAt: "2026-10-17T00:00:00.000Z", expiresAt: "2026-10-22T00:00:00.000Z",
    capturedAt: now, confirmedAt: now, eventTime: now, correlationId: "CORR_00000000000000000000000000000019",
    ocrEvidence: { engine: "synthetic-ocr", engineVersion: "1" },
    fields: {
      donationNumber: ok("MM26-10-9209"),
      // OCR read the blood type wrongly; the operator corrected it.
      bloodType: { ocrValue: "A_NEGAFIVE", ocrConfidence: 93, corrected: true, reason: "OCR_MISREAD" },
      componentType: ok("PLATELETS"), collectedAt: ok("2026-10-17T00:00:00.000Z"), expiresAt: ok("2026-10-22T00:00:00.000Z"),
      ...fields,
    },
    ...overrides,
  };
}

async function harness(enabled: boolean) {
  const store = new InMemoryV2CommandStore();
  const recorded: Record<string, unknown>[] = [];
  const sessions = { async findCredential() { return operator; }, async createSession() {}, async restoreSession() { return operator; }, async revokeSession() {} };
  const projection = { async listComponents() { return []; }, async getComponent() { return null; }, async findComponentByIdentity() { return null; }, async recordInboundCapture(_id: string, payload: Record<string, unknown>) { recorded.push(payload); } };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "corrected-intake-test-".repeat(3), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: origin }, () => new Date(now), sessions, undefined, undefined, { store, projection: projection as never, keyring, correctedIntakeEnabled: enabled });
  const token = app.jwt.sign({ userId: operator.userId, institutionId: operator.institutionId, roleId: operator.roleId, sessionId: "SESS_SYNTH_CORRECT", binding: "b".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  const post = (key: string, payload: Record<string, unknown>) => app.inject({ method: "POST", url: "/api/v2/inbound-captures", headers: { cookie: `bloodledger_session=${token}`, origin, "idempotency-key": key }, payload });
  return { app, store, recorded, post };
}

test("PA-OCR-03 corrected intake is refused unless the host enables it", async () => {
  const { app, post } = await harness(false);
  try {
    const response = await post("IDEM_CORRECT_DISABLED", corrected());
    assert.equal(response.statusCode, 403); assert.equal(response.json().error.code, "CORRECTED_INTAKE_DISABLED");
  } finally { await app.close(); }
});

test("PA-OCR-03 a corrected field becomes OPERATOR_CONFIRMED with no confidence, and raw OCR text is not kept", async () => {
  const { app, store, recorded, post } = await harness(true);
  try {
    const response = await post("IDEM_CORRECT_ACCEPT", corrected());
    assert.equal(response.statusCode, 202, response.body);
    const command = await store.get(response.json().commandId, operator.institutionId, operator.userId);
    const payload = command!.payload;
    assert.equal(command!.operation, "REGISTER_INBOUND_COMPONENT");
    assert.equal(payload.capturePolicyVersion, CORRECTED_OCR_POLICY_VERSION);
    assert.equal(payload.bloodType, "A_POSITIVE");
    assert.equal(payload.bloodTypeEvidenceSource, "OPERATOR_CONFIRMED");
    assert.equal(payload.componentEvidenceSource, "OCR_LABEL");
    assert.equal(payload.bloodTypeConfidence, null, "an OCR score is never evidence for a corrected value");
    assert.equal(payload.donationNumberConfidence, 96);
    const provenance = payload.fieldProvenance as Record<string, unknown>[];
    assert.equal(provenance.length, 5);
    const blood = provenance.find((entry) => entry.field === "bloodType")!;
    assert.equal(blood.source, "OPERATOR_CORRECTED"); assert.equal(blood.correctionReason, "OCR_MISREAD"); assert.equal(blood.ocrConfidence, 93);
    assert.notEqual(blood.ocrValueDigest, blood.finalValueDigest);
    const donation = provenance.find((entry) => entry.field === "donationNumber")!;
    assert.equal(donation.source, "OCR_LABEL"); assert.equal(donation.ocrValueDigest, donation.finalValueDigest);
    const stored = JSON.stringify(payload);
    assert.equal(stored.includes("A_NEGAFIVE"), false, "the raw OCR read is not stored");
    assert.equal(stored.includes("MM26-10-9209"), false, "the Donation No. is not stored in clear");
    assert.equal(recorded.length, 1);
    // The ledger input keeps its exact key set; provenance reaches it only through the capture evidence digest.
    const ledger = interviewCorePayload(command!);
    assert.equal("fieldProvenance" in ledger, false); assert.equal("capturePolicyVersion" in ledger, false);
    assert.equal(ledger.bloodTypeEvidenceSource, "OPERATOR_CONFIRMED");
  } finally { await app.close(); }
});

test("PA-OCR-03 a retry replays the same command and a different correction under the same key conflicts", async () => {
  const { app, post } = await harness(true);
  try {
    const first = await post("IDEM_CORRECT_REPLAY", corrected());
    const retry = await post("IDEM_CORRECT_REPLAY", corrected());
    assert.equal(retry.statusCode, 202); assert.equal(retry.json().commandId, first.json().commandId); assert.equal(retry.json().replayed, true);
    const changed = await post("IDEM_CORRECT_REPLAY", corrected({}, { bloodType: { ocrValue: "A_NEGAFIVE", ocrConfidence: 40, corrected: true, reason: "OCR_MISREAD" } }));
    assert.equal(changed.statusCode, 409); assert.equal(changed.json().error.code, "V2_IDEMPOTENCY_CONFLICT");
  } finally { await app.close(); }
});

test("PA-OCR-03 rejects captures that are not genuine OCR reads with stated corrections", () => {
  const reject = (body: Record<string, unknown>, code: string) => assert.throws(() => validateCorrectedInboundInput(body, ["INST_MEDIATRIX"]), (error: { code?: string }) => error.code === code, code);
  reject(corrected({}, { bloodType: ok("A_POSITIVE") }), "CORRECTED_CAPTURE_WITHOUT_CORRECTION");
  const all = Object.fromEntries(["donationNumber", "bloodType", "componentType", "collectedAt", "expiresAt"].map((field) => [field, { ocrValue: null, ocrConfidence: null, corrected: true, reason: "OCR_NOT_READ" }]));
  reject(corrected({ donationNumberConfirmation: "MM26-10-9209" }, all), "CORRECTED_CAPTURE_REQUIRES_OCR_FIELD");
  reject(corrected({}, { componentType: ok("PLATELETS", 85) }), "INBOUND_OCR_CONFIDENCE_LOW");
  reject(corrected({}, { componentType: ok("WHOLE_BLOOD") }), "CORRECTED_CAPTURE_FIELD_MISMATCH");
  reject(corrected({}, { bloodType: { ocrValue: "A_NEGAFIVE", ocrConfidence: 93, corrected: true } }), "CORRECTION_REASON_REQUIRED");
  reject(corrected({}, { bloodType: { ocrValue: "A_NEGAFIVE", ocrConfidence: 93, corrected: true, reason: "OCR_NOT_READ" } }), "CORRECTION_REASON_INCONSISTENT");
  reject(corrected({}, { bloodType: { ocrValue: "A_POSITIVE", ocrConfidence: 97, corrected: true, reason: "OCR_LOW_CONFIDENCE" } }), "CORRECTION_REASON_INCONSISTENT");
  // A corrected Donation No. is entered twice; an unchanged one carries no confirmation.
  const donationFix = { donationNumber: { ocrValue: "MM26-10-9208", ocrConfidence: 91, corrected: true, reason: "OCR_MISREAD" } };
  reject(corrected({}, donationFix), "CORRECTED_DONATION_CONFIRMATION_MISMATCH");
  reject(corrected({ donationNumberConfirmation: "MM26-10-9200" }, donationFix), "CORRECTED_DONATION_CONFIRMATION_MISMATCH");
  reject(corrected({ donationNumberConfirmation: "MM26-10-9209" }), "CORRECTED_DONATION_CONFIRMATION_MISMATCH");
  assert.equal(validateCorrectedInboundInput(corrected({ donationNumberConfirmation: "MM26-10-9209" }, donationFix), ["INST_MEDIATRIX"]).capture.donationNumber, "MM26-10-9209");
  // The final values still pass every INBOUND_OCR_V1 value rule.
  reject(corrected({ expiresAt: "2026-10-16T00:00:00.000Z" }, { expiresAt: ok("2026-10-16T00:00:00.000Z") }), "INBOUND_EXPIRY_INVALID");
  reject(corrected({ extra: true }), "CORRECTED_CAPTURE_INVALID");
});

test("PA-OCR-03 INBOUND_OCR_V1 captures are unchanged", async () => {
  const { app, store, post } = await harness(true);
  try {
    const v1 = { captureMethod: "OCR", capturePolicyVersion: "INBOUND_OCR_V1", issuerInstitutionId: "INST_MEDIATRIX", donationNumber: "MM26-10-9210", bloodType: "A_NEGATIVE", bloodTypeEvidence: { source: "OCR_LABEL", confirmed: true }, componentType: "WHOLE_BLOOD", componentEvidence: { source: "OCR_LABEL", confirmed: true }, collectedAt: "2026-10-01T00:00:00.000Z", expiresAt: "2026-11-01T00:00:00.000Z", capturedAt: now, confirmedAt: now, eventTime: now, correlationId: "CORR_00000000000000000000000000000020", ocrEvidence: { engine: "synthetic-ocr", engineVersion: "1", fieldConfidence: { donationNumber: 99, bloodType: 95, collectedAt: 98, expiresAt: 99 } } };
    const response = await post("IDEM_CORRECT_V1", v1);
    assert.equal(response.statusCode, 202, response.body);
    const payload = (await store.get(response.json().commandId, operator.institutionId, operator.userId))!.payload;
    assert.equal("capturePolicyVersion" in payload, false); assert.equal("fieldProvenance" in payload, false);
    assert.equal(payload.bloodTypeConfidence, 95);
    // J5 still applies to V1: OPERATOR_CONFIRMED evidence is not accepted from the client.
    const operatorClaimed = await post("IDEM_CORRECT_V1_OPERATOR", { ...v1, correlationId: "CORR_00000000000000000000000000000021", bloodTypeEvidence: { source: "OPERATOR_CONFIRMED", confirmed: true } });
    assert.equal(operatorClaimed.statusCode, 400); assert.equal(operatorClaimed.json().error.code, "INBOUND_OCR_EVIDENCE_REQUIRED");
  } finally { await app.close(); }
});
