import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { donationLookupHmac } from "../src/donation-crypto.js";
import { interviewCorePayload } from "../src/fabric.js";
import { validateInboundOcrInput } from "../src/inbound-ocr-policy.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

// FR-01/FR-13: an inbound-capture retry returns the command its Idempotency-Key created, and a reused key
// with a different capture is a conflict, even after the unit has been projected. Synthetic values only.
const origin = "http://127.0.0.1:5174";
const now = "2026-10-17T03:00:00.000Z";
const operator: CredentialRecord = { userId: "USR_SYNTH_REPLAY", username: "synth_replay", displayName: "Synthetic Replay Operator", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix", institutionCategory: "HOSPITAL", roleId: "ROLE-02", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
const keyring = { encryptionKey: Buffer.alloc(32, 0x11), lookupKey: Buffer.alloc(32, 0x22), encryptionKeyVersion: "v1" };
type Existing = { componentId: string; donationId: string; institutionId: string; inventoryStatus: string; reservationId: string | null; reservationVersion: number | null; inventoryVersion: number };

function capture(overrides: Record<string, unknown> = {}) {
  return {
    captureMethod: "OCR", capturePolicyVersion: "INBOUND_OCR_V1", issuerInstitutionId: "INST_MEDIATRIX", donationNumber: "MM26-08-4046",
    bloodType: "O_POSITIVE", bloodTypeEvidence: { source: "OCR_LABEL", confirmed: true }, componentType: "PACKED_RED_BLOOD_CELLS", componentEvidence: { source: "OCR_LABEL", confirmed: true },
    collectedAt: "2026-10-01T01:00:00.000Z", expiresAt: "2026-11-01T01:00:00.000Z", capturedAt: now, confirmedAt: now, eventTime: now, correlationId: "CORR_00000000000000000000000000000017",
    ocrEvidence: { engine: "synthetic-ocr", engineVersion: "1", fieldConfidence: { donationNumber: 99, bloodType: 95, collectedAt: 98, expiresAt: 99 } },
    ...overrides,
  };
}

async function harness() {
  const store = new InMemoryV2CommandStore();
  const state: { existing: Existing | null; provisionalCaptures: number } = { existing: null, provisionalCaptures: 0 };
  const sessions = { async findCredential() { return operator; }, async createSession() {}, async restoreSession() { return operator; }, async revokeSession() {} };
  const projection = {
    async listComponents() { return []; }, async getComponent() { return null; },
    async findComponentByIdentity() { return state.existing; },
    async getReservation(reservationId: string, institutionId: string) { return reservationId === "RES_SYNTH_REPLAY" && institutionId === operator.institutionId ? { destinationInstitutionId: operator.institutionId } : null; },
    async recordInboundCapture() { state.provisionalCaptures += 1; },
  };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "inbound-capture-replay-".repeat(3), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: origin }, () => new Date(now), sessions, undefined, undefined, { store, projection: projection as never, keyring });
  const token = app.jwt.sign({ userId: operator.userId, institutionId: operator.institutionId, roleId: operator.roleId, sessionId: "SESS_SYNTH_REPLAY", binding: "b".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  const post = (idempotencyKey: string, payload: Record<string, unknown>) => app.inject({ method: "POST", url: "/api/v2/inbound-captures", headers: { cookie: `bloodledger_session=${token}`, origin, "idempotency-key": idempotencyKey }, payload });
  return { app, store, state, post };
}

const registered = (componentId: string): Existing => ({ componentId, donationId: "DON_SYNTH_REPLAY", institutionId: operator.institutionId, inventoryStatus: "AVAILABLE", reservationId: null, reservationVersion: null, inventoryVersion: 1 });

test("FR-13 a registration retry after projection returns the original command, not the unit's current state", async () => {
  const { app, store, state, post } = await harness();
  try {
    const first = await post("IDEM_REPLAY_REGISTER", capture());
    assert.equal(first.statusCode, 202, first.body);
    assert.equal(first.json().replayed, false);
    const command = await store.get(first.json().commandId, operator.institutionId, operator.userId);
    assert.equal(command?.operation, "REGISTER_INBOUND_COMPONENT");
    state.existing = registered(String(command!.payload.componentId));

    const retry = await post("IDEM_REPLAY_REGISTER", capture());
    assert.equal(retry.statusCode, 202, retry.body);
    assert.equal(retry.json().commandId, first.json().commandId);
    assert.equal(retry.json().replayed, true);
    assert.equal(retry.json().resolution, undefined, "a retry is not reported as ALREADY_REGISTERED");
    assert.equal(state.provisionalCaptures, 1, "a retry records no second provisional capture");
  } finally { await app.close(); }
});

test("FR-13 a reused key with a different capture is a conflict even when the new capture matches a registered unit", async () => {
  const { app, store, state, post } = await harness();
  try {
    const first = await post("IDEM_REPLAY_REUSE", capture());
    assert.equal(first.statusCode, 202, first.body);
    state.existing = registered("COMP_SYNTH_OTHER");

    const reused = await post("IDEM_REPLAY_REUSE", capture({ donationNumber: "MM26-08-4047" }));
    assert.equal(reused.statusCode, 409, reused.body);
    assert.equal(reused.json().error.code, "V2_IDEMPOTENCY_CONFLICT");
    assert.doesNotMatch(reused.body, /MM26-08-404/, "the conflict never echoes a label");
    assert.equal((await store.list(operator.institutionId, operator.userId, 10)).commands.length, 1);
  } finally { await app.close(); }
});

test("FR-01 a new key for an already registered unit still reports ALREADY_REGISTERED", async () => {
  const { app, state, post } = await harness();
  try {
    state.existing = registered("COMP_SYNTH_EXISTING");
    const duplicate = await post("IDEM_REPLAY_DUPLICATE", capture());
    assert.equal(duplicate.statusCode, 200, duplicate.body);
    assert.equal(duplicate.json().resolution, "ALREADY_REGISTERED");
    assert.equal(duplicate.json().componentId, "COMP_SYNTH_EXISTING");
  } finally { await app.close(); }
});

test("ADR-049 F2: a new key on an in-transit unit no longer receives the reservation from one label", async () => {
  const { app, store, state, post } = await harness();
  try {
    state.existing = { componentId: "COMP_SYNTH_TRANSIT", donationId: "DON_SYNTH_TRANSIT", institutionId: "INST_SYNTH_MEDIX", inventoryStatus: "IN_TRANSIT", reservationId: "RES_SYNTH_REPLAY", reservationVersion: 4, inventoryVersion: 3 };
    const response = await post("IDEM_REPLAY_RECEIPT_NEW", capture());
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(response.json().error.code, "INBOUND_RECEIPT_REQUIRED");
    assert.doesNotMatch(response.body, /MM26-08-404/, "the refusal never echoes a label");
    assert.equal((await store.list(operator.institutionId, operator.userId, 10)).commands.length, 0, "nothing is queued");
    assert.equal(state.provisionalCaptures, 0, "no provisional capture is recorded");
  } finally { await app.close(); }
});

test("FR-10/FR-13 an OCR-matched receipt accepted before ADR-049 still replays and rejects a different capture", async () => {
  const { app, store, state, post } = await harness();
  try {
    // Recreate a receipt exactly as the J1 route stored it, with its body-bound captureRequestSha256.
    const key = "IDEM_REPLAY_RECEIPT";
    const keyDigest = createHash("sha256").update(key, "utf8").digest("hex").toUpperCase().slice(0, 40);
    const commandId = `CMD_${keyDigest}`, captureId = `INCAP_${keyDigest}`;
    const captureRequestSha256 = createHash("sha256").update(JSON.stringify({ operation: "RECEIVE_INBOUND_COMPONENT", capture: validateInboundOcrInput(capture()), captureId, custodyInstitutionId: operator.institutionId }), "utf8").digest("hex");
    await store.enqueue({ commandId, idempotencyKey: key, resourceType: "INBOUND_CAPTURE", resourceId: captureId, operation: "RECEIVE_INBOUND_COMPONENT", payload: { reservationId: "RES_SYNTH_REPLAY", expectedVersion: 4, actorUserId: operator.userId, actorInstitutionId: operator.institutionId, eventTime: now, correlationId: "CORR_00000000000000000000000000000017", captureId, captureEvidenceDigest: donationLookupHmac("MM26-08-4046", keyring), captureRequestSha256 }, correlationId: "CORR_00000000000000000000000000000017", actorUserId: operator.userId, actorInstitutionId: operator.institutionId, acceptedAt: now });
    const stored = await store.get(commandId, operator.institutionId, operator.userId);
    assert.equal(interviewCorePayload(stored!).captureRequestSha256, undefined, "replay evidence never reaches the ledger");
    state.existing = { componentId: "COMP_SYNTH_TRANSIT", donationId: "DON_SYNTH_TRANSIT", institutionId: operator.institutionId, inventoryStatus: "RECEIVED", reservationId: "RES_SYNTH_REPLAY", reservationVersion: 5, inventoryVersion: 4 };

    const retry = await post(key, capture());
    assert.equal(retry.statusCode, 202, retry.body);
    assert.equal(retry.json().commandId, commandId);
    assert.equal(retry.json().replayed, true);

    const reused = await post(key, capture({ bloodType: "A_POSITIVE" }));
    assert.equal(reused.statusCode, 409, reused.body);
    assert.equal(reused.json().error.code, "V2_IDEMPOTENCY_CONFLICT");
  } finally { await app.close(); }
});

test("FR-13 a receipt accepted before replay evidence existed replays on its recorded fields only", async () => {
  const { app, store, post } = await harness();
  try {
    // Recreate a retained receipt command exactly as the earlier route stored it (no captureRequestSha256).
    const legacyKey = "IDEM_REPLAY_LEGACY";
    const keyDigest = createHash("sha256").update(legacyKey, "utf8").digest("hex").toUpperCase().slice(0, 40);
    const legacyCommandId = `CMD_${keyDigest}`; const captureId = `INCAP_${keyDigest}`;
    const correlationId = "CORR_00000000000000000000000000000017";
    await store.enqueue({ commandId: legacyCommandId, idempotencyKey: legacyKey, resourceType: "INBOUND_CAPTURE", resourceId: captureId, operation: "RECEIVE_INBOUND_COMPONENT", payload: { reservationId: "RES_SYNTH_REPLAY", expectedVersion: 4, actorUserId: operator.userId, actorInstitutionId: operator.institutionId, eventTime: now, correlationId, captureId, captureEvidenceDigest: donationLookupHmac("MM26-08-4046", keyring) }, correlationId, actorUserId: operator.userId, actorInstitutionId: operator.institutionId, acceptedAt: now });

    const retry = await post(legacyKey, capture());
    assert.equal(retry.statusCode, 202, retry.body);
    assert.equal(retry.json().commandId, legacyCommandId);
    assert.equal(retry.json().replayed, true);

    const reused = await post(legacyKey, capture({ correlationId: "CORR_00000000000000000000000000000018" }));
    assert.equal(reused.statusCode, 409, reused.body);
    assert.equal(reused.json().error.code, "V2_IDEMPOTENCY_CONFLICT");
  } finally { await app.close(); }
});
