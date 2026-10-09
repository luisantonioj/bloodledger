import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { interviewCorePayload } from "../src/fabric.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

// Exact input keys of InterviewCoreContract.RecordInboundReceipt (parseExactObject).
const RECORD_INBOUND_RECEIPT_KEYS = ["actorInstitutionId", "actorUserId", "captureEvidenceDigest", "correlationId", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion", "reservationId"];
const origin = "http://127.0.0.1:5174";
const now = "2026-10-09T15:00:00.000Z";
const destination: CredentialRecord = { userId: "USR_SYNTH_RECEIVER", username: "synth_receiver", displayName: "Synthetic Receiver", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix Receiver", institutionCategory: "HOSPITAL", roleId: "ROLE-02", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };

test("FR-10/FR-11 an OCR receipt of in-transit stock sends only RecordInboundReceipt fields to the ledger", async () => {
  const store = new InMemoryV2CommandStore();
  const sessions = { async findCredential() { return destination; }, async createSession() {}, async restoreSession() { return destination; }, async revokeSession() {} };
  const projection = {
    async listComponents() { return []; }, async getComponent() { return null; },
    async findComponentByIdentity() { return { componentId: "COMP_SYNTH_RECEIPT", donationId: "DON_SYNTH_RECEIPT", institutionId: "INST_SYNTH_MEDIX", inventoryStatus: "IN_TRANSIT", reservationId: "RES_SYNTH_RECEIPT", reservationVersion: 4 }; },
    async getReservation(reservationId: string, institutionId: string) { return reservationId === "RES_SYNTH_RECEIPT" && institutionId === destination.institutionId ? { destinationInstitutionId: destination.institutionId } : null; },
    async recordInboundCapture() { throw new Error("A receipt must not record a new provisional capture"); },
  };
  const keyring = { encryptionKey: Buffer.alloc(32, 0x11), lookupKey: Buffer.alloc(32, 0x22), encryptionKeyVersion: "v1" };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "inbound-receipt-test-".repeat(3), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: origin }, () => new Date(now), sessions, undefined, undefined, { store, projection: projection as never, keyring });
  const token = app.jwt.sign({ userId: destination.userId, institutionId: destination.institutionId, roleId: destination.roleId, sessionId: "SESS_SYNTH_RECEIPT", binding: "b".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  try {
    const response = await app.inject({ method: "POST", url: "/api/v2/inbound-captures", headers: { cookie: `bloodledger_session=${token}`, origin, "idempotency-key": "IDEM_RECEIPT_PAYLOAD" }, payload: {
      captureMethod: "OCR", capturePolicyVersion: "INBOUND_OCR_V1", issuerInstitutionId: "INST_MEDIATRIX", donationNumber: "MM26-08-4046",
      bloodType: "O_POSITIVE", bloodTypeEvidence: { source: "OCR_LABEL", confirmed: true }, componentType: "PACKED_RED_BLOOD_CELLS", componentEvidence: { source: "OCR_LABEL", confirmed: true },
      collectedAt: "2026-10-01T01:00:00.000Z", expiresAt: "2026-11-01T01:00:00.000Z", capturedAt: now, confirmedAt: now, eventTime: now, correlationId: "CORR_00000000000000000000000000000002",
      ocrEvidence: { engine: "synthetic-ocr", engineVersion: "1", fieldConfidence: { donationNumber: 99, bloodType: 95, collectedAt: 98, expiresAt: 99 } },
    } });
    assert.equal(response.statusCode, 202, response.body);
    const command = await store.get(response.json().commandId, destination.institutionId, destination.userId);
    assert.equal(command?.operation, "RECEIVE_INBOUND_COMPONENT");
    assert.ok(command?.payload.captureId, "the projection keeps its capture link");
    assert.deepEqual(Object.keys(interviewCorePayload(command!)).sort(), RECORD_INBOUND_RECEIPT_KEYS);
  } finally { await app.close(); }
});
