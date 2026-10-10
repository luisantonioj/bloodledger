import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

const origin = "http://127.0.0.1:5174";
const now = Date.parse("2026-10-10T04:00:00.000Z");
const at = (offsetMs: number) => new Date(now + offsetMs).toISOString();
const FIVE_MINUTES = 5 * 60_000;
const config = { host: "127.0.0.1", port: 3000, jwtSecret: "command-time-test-".repeat(3), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: origin };
const keyring = { encryptionKey: Buffer.alloc(32, 0x11), lookupKey: Buffer.alloc(32, 0x22), encryptionKeyVersion: "v1" };

const source: CredentialRecord = { userId: "USR_SYNTH_ADMIN", username: "synth_admin", displayName: "Synthetic Hospital Administrator", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix Verification", institutionCategory: "HOSPITAL", roleId: "ROLE-02", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
const recipient: CredentialRecord = { ...source, userId: "USR_SYNTH_RECIPIENT", username: "synth_recipient", displayName: "Synthetic Recipient", institutionId: "INST_SYNTH_SECONDARY_01", institutionDisplayName: "Synthetic Secondary 01", roleId: "ROLE-03" };
const reservation = {
  reservationId: "RES_SYNTH_TIME_001", purpose: "TRANSFER" as const, status: "ACTIVE", version: 1, sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_SYNTH_SECONDARY_01",
  transferId: "TRF_SYNTH_TIME_001", localReleaseId: null, preparedAt: null, preparedEvidencePresent: false, updatedAt: at(0),
  components: [{ componentId: "COMP_SYNTH_TIME_001", componentType: "PACKED_RED_BLOOD_CELLS", inventoryStatus: "RESERVED", inventoryVersion: 2 }], classification: "SIMULATION_ONLY" as const,
};

class PopulationStore extends InMemoryV2CommandStore {
  constructor(private readonly approved: boolean) { super(); }
  async assertPopulationRequest(): Promise<boolean> { return this.approved; }
}

async function fixture(record: CredentialRecord, store = new InMemoryV2CommandStore()) {
  let clock = now;
  const recorded: string[] = [];
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const projection = {
    async listComponents() { return []; }, async getComponent() { return null; }, async findComponentByIdentity() { return null; },
    async getReservation(reservationId: string) { return reservationId === reservation.reservationId ? reservation : null; },
    async recordInboundCapture(captureId: string) { recorded.push(captureId); },
  };
  const app = await buildApp(new MemoryRepository(), config, () => new Date(clock), sessions, undefined, undefined, { store, projection, keyring });
  const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_TIME", binding: "b".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  const send = (url: string, key: string, payload: Record<string, unknown>) => app.inject({ method: "POST", url, headers: { cookie: `bloodledger_session=${token}`, origin, "idempotency-key": key }, payload });
  return { app, send, recorded, advance(ms: number) { clock += ms; } };
}

const cancel = (eventTime: string) => ({ correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", eventTime, expectedVersion: 1 });
const cancelUrl = `/api/v2/reservations/${reservation.reservationId}/cancel`;

test("FR-02/FR-08 accepts command times within five minutes of the server clock, inclusive", async () => {
  const { app, send } = await fixture(source);
  try {
    for (const [key, offset] of [["IDEM_T_NOW", 0], ["IDEM_T_PAST_EDGE", -FIVE_MINUTES], ["IDEM_T_FUTURE_EDGE", FIVE_MINUTES]] as const) {
      const response = await send(cancelUrl, key, cancel(at(offset)));
      assert.equal(response.statusCode, 202, key);
    }
  } finally { await app.close(); }
});

test("FR-02/FR-08 rejects backdated and future command times without queuing a command", async () => {
  const store = new InMemoryV2CommandStore();
  const { app, send } = await fixture(source, store);
  try {
    for (const [key, offset] of [["IDEM_T_STALE", -FIVE_MINUTES - 1], ["IDEM_T_FUTURE", FIVE_MINUTES + 1], ["IDEM_T_DAY_OLD", -86_400_000]] as const) {
      const response = await send(cancelUrl, key, cancel(at(offset)));
      assert.equal(response.statusCode, 400, key);
      assert.equal(response.json().error.code, "V2_COMMAND_TIME_OUT_OF_WINDOW");
      assert.ok(response.json().error.correlationId);
    }
    assert.equal((await store.list(source.institutionId, source.userId, 50)).commands.length, 0);
  } finally { await app.close(); }
});

test("FR-06 bounds the requisition time that drives RPS wait scoring", async () => {
  const { app, send } = await fixture(recipient);
  const request = (requestTime: string) => ({ bloodType: "O_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", correlationId: "CORR_0123456789ABCDEF0123456789ABCDE0", destinationInstitutionId: recipient.institutionId, eventTime: at(0), quantity: 1, requestTime, sourceInstitutionId: "INST_MEDIATRIX", transferId: "TRF_SYNTH_TIME_REQ", urgency: "ROUTINE" });
  try {
    const backdated = await send("/api/v2/transfers", "IDEM_T_REQ_OLD", request(at(-3_600_000)));
    assert.equal(backdated.statusCode, 400);
    assert.equal(backdated.json().error.code, "V2_COMMAND_TIME_OUT_OF_WINDOW");
    assert.equal((await send("/api/v2/transfers", "IDEM_T_REQ_NOW", request(at(0)))).statusCode, 202);
  } finally { await app.close(); }
});

test("NFR-05 retries of an accepted idempotency key replay after the window and still detect conflicts", async () => {
  const { app, send, advance } = await fixture(source);
  try {
    const first = await send(cancelUrl, "IDEM_T_RETRY", cancel(at(0)));
    assert.equal(first.statusCode, 202);
    advance(3_600_000);
    const retry = await send(cancelUrl, "IDEM_T_RETRY", cancel(at(0)));
    assert.equal(retry.statusCode, 202);
    assert.equal(retry.json().replayed, true);
    assert.equal(retry.json().commandId, first.json().commandId);
    const changed = await send(cancelUrl, "IDEM_T_RETRY", cancel(at(1)));
    assert.equal(changed.statusCode, 409);
    assert.equal(changed.json().error.code, "V2_IDEMPOTENCY_CONFLICT");
  } finally { await app.close(); }
});

test("TP-STOCK-01 exact approved population operations keep their frozen confirmation time", async () => {
  const approved = await fixture(source, new PopulationStore(true));
  const unapproved = await fixture(source, new PopulationStore(false));
  try {
    assert.equal((await approved.send(cancelUrl, "IDEM_T_POP", cancel(at(-6 * 3_600_000)))).statusCode, 202);
    const rejected = await unapproved.send(cancelUrl, "IDEM_T_POP", cancel(at(-6 * 3_600_000)));
    assert.equal(rejected.statusCode, 400);
    assert.equal(rejected.json().error.code, "V2_COMMAND_TIME_OUT_OF_WINDOW");
  } finally { await approved.app.close(); await unapproved.app.close(); }
});

test("FR-01 rejects a stale OCR intake before recording a provisional capture", async () => {
  const { app, send, recorded } = await fixture(source);
  const capture = (eventTime: string) => ({
    captureMethod: "OCR", capturePolicyVersion: "INBOUND_OCR_V1", issuerInstitutionId: "INST_MEDIATRIX", donationNumber: "MM26-08-4046",
    bloodType: "O_POSITIVE", bloodTypeEvidence: { source: "OCR_LABEL", confirmed: true }, componentType: "PACKED_RED_BLOOD_CELLS", componentEvidence: { source: "BAG_TYPE", confirmed: true },
    collectedAt: "2026-10-01T01:00:00.000Z", expiresAt: "2026-11-01T01:00:00.000Z", capturedAt: eventTime, confirmedAt: eventTime, eventTime, correlationId: "CORR_00000000000000000000000000000001",
    ocrEvidence: { engine: "synthetic-ocr", engineVersion: "1", fieldConfidence: { donationNumber: 99, bloodType: 95, collectedAt: 98, expiresAt: 99 } },
  });
  try {
    const stale = await send("/api/v2/inbound-captures", "IDEM_T_OCR_OLD", capture(at(-FIVE_MINUTES - 1)));
    assert.equal(stale.statusCode, 400);
    assert.equal(stale.json().error.code, "V2_COMMAND_TIME_OUT_OF_WINDOW");
    assert.equal(recorded.length, 0);
    assert.equal((await send("/api/v2/inbound-captures", "IDEM_T_OCR_NOW", capture(at(0)))).statusCode, 202);
    assert.equal(recorded.length, 1);
  } finally { await app.close(); }
});
