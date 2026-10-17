import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { interviewCorePayload } from "../src/fabric.js";
import { operatorActions } from "../src/institution-access.js";
import { allowedOperatorAction } from "../src/operator-verification.js";
import { assertReceiptEvidence, compareReceiptLabels, parseReceiptInput, receiptIdentity, type ReceiptEvidence } from "../src/receipt-verification.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord, WebPrincipal } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

// ADR-049 INBOUND_RECEIPT_LABEL_VERIFICATION_V1 and receipt evidence on `receive` (J3, finding F2). Synthetic values only.
const origin = "http://127.0.0.1:5174";
const now = "2026-10-17T05:00:00.000Z";
const correlationId = "CORR_0123456789ABCDEF0123456789ABCDEF";
const reservationId = "RES_SYNTH_RECEIPT";
// Requester receipt: Mediatrix → synthetic requester. Bank receipt: synthetic bank → Mediatrix (legacy sessions scope ROLE-01/02 to Mediatrix).
const destination = "INST_SYNTH_MEDIX", source = "INST_MEDIATRIX";
const evidenceFor = (institutionId: string): ReceiptEvidence => ({ evidenceId: `RCV_${"A".repeat(40)}`, evidenceDigest: "d".repeat(64), reservationId, reservationVersion: 6, institutionId });
const evidence = evidenceFor(destination);
// RecordReservationReceipt and RecordInboundReceipt take exactly these keys; the chaincode is unchanged.
const RESERVATION_RECEIPT_KEYS = ["actorUserId", "correlationId", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion", "reservationId"];
const INBOUND_RECEIPT_KEYS = ["actorInstitutionId", "actorUserId", "captureEvidenceDigest", "correlationId", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion", "reservationId"];

test("INBOUND_RECEIPT_LABEL_VERIFICATION_V1 takes exact bodies and needs the OCR-read component on every label", () => {
  const label = (donationNumber: string, componentType: unknown = "PLATELETS") => ({ donationNumber, componentType });
  const valid = { expectedVersion: 6, correlationId, scannedLabels: [label("MM26-10-0001"), label("MM26-10-0002", "CRYOPRECIPITATE")] };
  assert.deepEqual(parseReceiptInput(valid).scannedLabels, [{ donationNumber: "MM26-10-0001", componentType: "PLATELETS" }, { donationNumber: "MM26-10-0002", componentType: "CRYOPRECIPITATE" }]);
  for (const invalid of [
    { ...valid, scannedLabels: [] }, { ...valid, scannedLabels: Array.from({ length: 51 }, (_, index) => label(`MM26-10-${String(index).padStart(4, "0")}`)) },
    { ...valid, expectedVersion: 0 }, { ...valid, correlationId: "CORR_lowercase" }, { ...valid, note: "x" }, { ...valid, policyVersion: "INBOUND_RECEIPT_LABEL_VERIFICATION_V1" },
    { ...valid, scannedLabels: ["MM26-10-0001"] }, { ...valid, scannedLabels: [{ donationNumber: "MM26-10-0001" }] }, { ...valid, scannedLabels: [label("MM26-10-0001", null)] },
    { ...valid, scannedLabels: [label("MM26-10-0001", "UNKNOWN")] }, { ...valid, scannedLabels: [{ ...label("MM26-10-0001"), bloodType: "A_POSITIVE" }] }, { ...valid, scannedLabels: [label("MM26-10-0001"), null] },
  ]) assert.throws(() => parseReceiptInput(invalid), (error: { code?: string }) => error.code === "RECEIPT_VERIFICATION_INPUT_INVALID");
  assert.throws(() => parseReceiptInput({ ...valid, scannedLabels: [label("MM26-10-0001"), label("MM26-10-0001")] }), (error: { code?: string }) => error.code === "RECEIPT_LABEL_DUPLICATE");
});

test("F2: every in-transit member must match by Donation No. and component; one label never covers a reservation", () => {
  const members = new Map([["COMP_A", receiptIdentity("h1", "PLATELETS")], ["COMP_B", receiptIdentity("h2", "PLATELETS")]]);
  assert.deepEqual(compareReceiptLabels(members, [receiptIdentity("h2", "PLATELETS"), receiptIdentity("h1", "PLATELETS")]), { expectedUnits: 2, matchedUnits: 2, unmatchedLabels: 0, missingUnits: 0 });
  assert.deepEqual(compareReceiptLabels(members, [receiptIdentity("h1", "PLATELETS")]), { expectedUnits: 2, matchedUnits: 1, unmatchedLabels: 0, missingUnits: 1 });
  assert.deepEqual(compareReceiptLabels(members, [receiptIdentity("h1", "FRESH_FROZEN_PLASMA"), receiptIdentity("h2", "PLATELETS")]), { expectedUnits: 2, matchedUnits: 1, unmatchedLabels: 1, missingUnits: 1 });
});

test("receipt evidence binds one reservation, its verified version and the receiving institution", () => {
  const expected = { evidenceDigest: evidence.evidenceDigest, reservationId, expectedVersion: 6, institutionId: destination };
  assert.doesNotThrow(() => assertReceiptEvidence(evidence, expected));
  for (const [stored, wanted] of [[null, expected], [evidence, { ...expected, evidenceDigest: "e".repeat(64) }], [evidence, { ...expected, reservationId: "RES_SYNTH_OTHER" }], [evidence, { ...expected, expectedVersion: 7 }], [evidence, { ...expected, institutionId: source }]] as const) {
    assert.throws(() => assertReceiptEvidence(stored, wanted), (error: { code?: string }) => error.code === "RECEIPT_EVIDENCE_INVALID");
  }
});

test("receipt verification is an operator-bound action for receiving hospitals only", () => {
  const action = `POST /api/v2/reservations/${reservationId}/receipt-verifications`;
  const operator = (roleId: "ROLE-01" | "ROLE-02" | "ROLE-03" | "ROLE-04") => ({ operatorId: "USR_SYNTH_OP", roleId, capabilityProfile: "ROLE" as const, version: 1 });
  assert.equal(allowedOperatorAction({ accountCategory: "REQUESTOR" } as WebPrincipal, operator("ROLE-03"), action), true);
  for (const roleId of ["ROLE-01", "ROLE-02"] as const) assert.equal(allowedOperatorAction({ accountCategory: "BLOOD_BANK" } as WebPrincipal, operator(roleId), action), true);
  assert.equal(allowedOperatorAction({ accountCategory: "DOH" } as WebPrincipal, operator("ROLE-04"), action), false);
  // The web app lists eligible operators by these capabilities; bank and requester operators can receive.
  for (const roleId of ["ROLE-01", "ROLE-02", "ROLE-03"] as const) assert.ok(operatorActions(operator(roleId)).includes("transfer:receive"), roleId);
});

function credential(roleId: CredentialRecord["roleId"], institutionId: string): CredentialRecord {
  return { userId: `USR_SYNTH_${roleId.replace("-", "")}`, username: `synth_${roleId}`, displayName: "Synthetic Receiver", institutionId, institutionDisplayName: "Synthetic Institution", institutionCategory: "HOSPITAL", roleId, saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
}

async function harness(record: CredentialRecord, reservationDestination = destination) {
  const store = new InMemoryV2CommandStore();
  const lookups: string[] = [];
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const projection = {
    async listComponents() { return []; }, async getComponent() { return null; }, async findComponentByIdentity() { return null; },
    async getReservation(id: string) { return id === reservationId ? { reservationId, destinationInstitutionId: reservationDestination, components: [{ componentType: "PLATELETS" }] } : null; },
  };
  const stored = evidenceFor(reservationDestination);
  const receiptVerification = { async verify() { throw new Error("not used"); }, async findEvidence(id: string) { lookups.push(id); return id === stored.evidenceId ? stored : null; } };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "receipt-verification-test-".repeat(3), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: origin }, () => new Date(now), sessions, undefined, undefined, { store, projection: projection as never, receiptVerification });
  const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_RECEIPT", binding: "r".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  const receive = (idempotencyKey: string, extra: Record<string, unknown> = {}) => app.inject({ method: "POST", url: `/api/v2/reservations/${reservationId}/receive`, headers: { cookie: `bloodledger_session=${token}`, origin, "idempotency-key": idempotencyKey }, payload: { correlationId, eventTime: now, expectedVersion: 6, ...extra } });
  const command = async (response: { json(): { commandId: string } }) => store.get(response.json().commandId, record.institutionId, record.userId);
  return { app, store, lookups, receive, command };
}
const withEvidence = { receiptEvidenceId: evidence.evidenceId, receiptEvidenceDigest: evidence.evidenceDigest };

test("FR-10 requester receipt without evidence works as before and records no label evidence", async () => {
  const { app, receive, command, lookups } = await harness(credential("ROLE-03", destination));
  try {
    const response = await receive("IDEM_RECEIPT_PLAIN");
    assert.equal(response.statusCode, 202, response.body);
    const queued = await command(response);
    assert.equal(queued?.operation, "RECEIVE_RESERVATION");
    assert.equal(queued?.payload.receiptEvidenceId, undefined);
    assert.deepEqual(Object.keys(interviewCorePayload(queued!)).sort(), RESERVATION_RECEIPT_KEYS);
    assert.deepEqual(lookups, []);
  } finally { await app.close(); }
});

test("FR-10 requester receipt with evidence binds it off-chain and keeps the ledger payload unchanged", async () => {
  const { app, receive, command } = await harness(credential("ROLE-03", destination));
  try {
    const response = await receive("IDEM_RECEIPT_EVIDENCE", withEvidence);
    assert.equal(response.statusCode, 202, response.body);
    const queued = await command(response);
    assert.equal(queued?.operation, "RECEIVE_RESERVATION");
    assert.equal(queued?.payload.receiptEvidenceId, evidence.evidenceId);
    assert.equal(queued?.payload.receiptEvidenceDigest, evidence.evidenceDigest);
    assert.deepEqual(Object.keys(interviewCorePayload(queued!)).sort(), RESERVATION_RECEIPT_KEYS, "receipt evidence never reaches the ledger");
    const replay = await receive("IDEM_RECEIPT_EVIDENCE", withEvidence);
    assert.equal(replay.json().commandId, response.json().commandId);
    assert.equal(replay.json().replayed, true);
  } finally { await app.close(); }
});

test("FR-10 receipt evidence for another version, an unknown ID or half a pair is refused before queueing", async () => {
  const { app, store, receive } = await harness(credential("ROLE-03", destination));
  try {
    const stale = await receive("IDEM_RECEIPT_STALE", { ...withEvidence, expectedVersion: 7 });
    assert.equal(stale.statusCode, 409, stale.body); assert.equal(stale.json().error.code, "RECEIPT_EVIDENCE_INVALID");
    const unknown = await receive("IDEM_RECEIPT_UNKNOWN", { ...withEvidence, receiptEvidenceId: `RCV_${"B".repeat(40)}` });
    assert.equal(unknown.statusCode, 409, unknown.body); assert.equal(unknown.json().error.code, "RECEIPT_EVIDENCE_INVALID");
    const digest = await receive("IDEM_RECEIPT_DIGEST", { ...withEvidence, receiptEvidenceDigest: "e".repeat(64) });
    assert.equal(digest.statusCode, 409, digest.body); assert.equal(digest.json().error.code, "RECEIPT_EVIDENCE_INVALID");
    const half = await receive("IDEM_RECEIPT_HALF", { receiptEvidenceId: evidence.evidenceId });
    assert.equal(half.statusCode, 400, half.body);
    const malformed = await receive("IDEM_RECEIPT_MALFORMED", { ...withEvidence, receiptEvidenceId: "EVD_" + "A".repeat(40) });
    assert.equal(malformed.statusCode, 400, malformed.body);
    assert.equal((await store.list(destination, "USR_SYNTH_ROLE03", 10)).commands.length, 0);
  } finally { await app.close(); }
});

test("F2 a blood-bank destination receives only with receipt evidence, through the unchanged inbound receipt chaincode", async () => {
  const { app, store, receive, command } = await harness(credential("ROLE-02", source), source);
  try {
    const missing = await receive("IDEM_BANK_NO_EVIDENCE");
    assert.equal(missing.statusCode, 409, missing.body); assert.equal(missing.json().error.code, "RECEIPT_VERIFICATION_REQUIRED");
    const response = await receive("IDEM_BANK_RECEIPT", withEvidence);
    assert.equal(response.statusCode, 202, response.body);
    const queued = await command(response);
    assert.equal(queued?.operation, "RECEIVE_INBOUND_COMPONENT");
    assert.equal(queued?.resourceType, "TRANSFER");
    assert.equal(queued?.payload.captureEvidenceDigest, evidence.evidenceDigest);
    assert.equal(queued?.payload.actorInstitutionId, source);
    assert.equal(queued?.payload.receiptEvidenceId, evidence.evidenceId);
    assert.equal(queued?.payload.captureId, undefined, "no capture: unit history shows the receipt as a web command, not OCR");
    assert.deepEqual(Object.keys(interviewCorePayload(queued!)).sort(), INBOUND_RECEIPT_KEYS, "receipt evidence ID never reaches the ledger");
    assert.equal((await store.list(source, "USR_SYNTH_ROLE02", 10)).commands.length, 1);
  } finally { await app.close(); }
});

test("F2 the source bank cannot receive its own outgoing reservation", async () => {
  const { app, receive } = await harness(credential("ROLE-02", source), destination);
  try {
    const response = await receive("IDEM_SOURCE_RECEIPT", { ...withEvidence });
    assert.equal(response.statusCode, 403, response.body);
    assert.equal(response.json().error.code, "AUTH_SCOPE_FORBIDDEN");
  } finally { await app.close(); }
});
