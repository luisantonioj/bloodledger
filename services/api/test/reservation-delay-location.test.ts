// TC-T04/TC-G01/TC-G03/TC-T07/TC-E05 remediation: checkpoint location, staff-recorded delay and scheduled expiry.
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { interviewCorePayload } from "../src/fabric.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { captureReservationLocation, scopeLocationView, type ReservationLocation, type ReservationLocationStore, type ReservationLocationView } from "../src/reservation-location.js";
import { EXPIRY_SERVICE_ACTOR_ID, ScheduledExpiryEvaluator, expiryCommand } from "../src/expiry-evaluator.js";
import { MemoryRepository } from "./test-support.js";

const origin = "http://127.0.0.1:5174";
const now = "2026-10-10T02:00:00.000Z";
const source: CredentialRecord = { userId: "USR_SYNTH_ADMIN", username: "synth_admin", displayName: "Synthetic Hospital Administrator", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix Verification", institutionCategory: "HOSPITAL", roleId: "ROLE-02", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
const recipient: CredentialRecord = { ...source, userId: "USR_SYNTH_RECIPIENT", username: "synth_recipient", institutionId: "INST_SYNTH_MEDIX", roleId: "ROLE-03" };
const reservation = (status: string) => ({
  reservationId: "RES_SYNTH_DELAY", purpose: "TRANSFER" as const, status, version: 4, sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_SYNTH_MEDIX",
  transferId: "TRF_SYNTH_DELAY", localReleaseId: null, preparedAt: now, preparedEvidencePresent: true, updatedAt: now,
  components: [{ componentId: "COMP_SYNTH_DELAY", componentType: "PACKED_RED_BLOOD_CELLS", inventoryStatus: "IN_TRANSIT", inventoryVersion: 4 }], classification: "SIMULATION_ONLY" as const,
});
const device = { latitude: 0, longitude: 0.0001, accuracyMetres: 20, source: "DEVICE", fallbackReason: null, capturedAt: "2026-10-10T01:59:00.000Z" };

class MemoryLocation implements ReservationLocationStore {
  rows: Array<{ reservationId: string; evidence: ReservationLocation }> = [];
  async record(reservationId: string, evidence: ReservationLocation) { if (!this.rows.some(row => row.evidence.evidenceId === evidence.evidenceId)) this.rows.push({ reservationId, evidence }); }
  async list(reservationId: string) {
    return this.rows.filter(row => row.reservationId === reservationId).map(({ evidence: e }) => ({ evidenceId: e.evidenceId, phase: e.phase, institutionId: e.institutionId, capturedAt: e.capturedAt, accuracyMetres: e.accuracyMetres, source: e.source, fallbackReason: e.fallbackReason, facilityMatched: e.facilityMatched, evidenceDigest: e.evidenceDigest, coordinates: { latitude: e.latitude, longitude: e.longitude }, deleteAfter: e.deleteAfter }));
  }
  async purgeExpired() { return 0; }
}

async function fixture(record: CredentialRecord, status = "IN_TRANSIT", withLocationStore = true) {
  const store = new InMemoryV2CommandStore(), reservationLocation = new MemoryLocation();
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const projection = { async listComponents() { return []; }, async getComponent() { return null; }, async findComponentByIdentity() { return null; }, async getReservation(id: string) { return id === "RES_SYNTH_DELAY" ? reservation(status) : null; } };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "reservation-delay-location-".repeat(3), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: origin }, () => new Date(now), sessions, undefined, undefined, { store, projection, ...(withLocationStore ? { reservationLocation } : {}) });
  const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_DELAY", binding: "b".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  const cookie = `bloodledger_session=${token}`;
  const post = (action: string, key: string, extra: Record<string, unknown> = {}) => app.inject({ method: "POST", url: `/api/v2/reservations/RES_SYNTH_DELAY/${action}`, headers: { cookie, origin, "idempotency-key": key }, payload: { correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", eventTime: now, expectedVersion: 4, ...extra } });
  return { app, store, cookie, post, reservationLocation };
}

test("TC-T07 queues a coded delay and resume; free-text reasons and wrong roles are rejected", async () => {
  const { app, store, post } = await fixture(source);
  try {
    assert.equal((await post("delay", "IDEM_DELAY_FREE", { reasonCode: "stuck in traffic" })).json().error.code, "DELAY_REASON_INVALID");
    const accepted = await post("delay", "IDEM_DELAY_OK", { reasonCode: "TRAFFIC" });
    assert.equal(accepted.statusCode, 202);
    const command = await store.get(accepted.json().commandId, source.institutionId, source.userId);
    assert.equal(command?.operation, "DELAY_RESERVATION");
    assert.deepEqual(Object.keys(interviewCorePayload(command!)).sort(), ["actorUserId", "correlationId", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion", "reasonCode", "reservationId"]);
    assert.equal((await post("resume", "IDEM_RESUME_OK")).statusCode, 202);
  } finally { await app.close(); }
  const other = await fixture(recipient);
  try { assert.equal((await other.post("resume", "IDEM_RESUME_RECIPIENT")).statusCode, 403); } finally { await other.app.close(); }
});

test("TC-T04/TC-G01 dispatch splits the exact point off-chain and sends only the summary to the ledger", async () => {
  const { app, store, post, reservationLocation } = await fixture(source, "ACTIVE");
  try {
    const accepted = await post("dispatch", "IDEM_DISPATCH_LOC", { location: device });
    assert.equal(accepted.statusCode, 202, accepted.body);
    const command = await store.get(accepted.json().commandId, source.institutionId, source.userId);
    const ledger = interviewCorePayload(command!);
    assert.deepEqual(Object.keys(ledger.locationEvidence as object).sort(), ["capturedAt", "evidenceDigest", "evidenceId", "facilityMatched", "fallback", "phase", "policyVersion", "source"]);
    assert.equal(JSON.stringify(ledger).includes("latitude"), false);
    assert.equal(reservationLocation.rows.length, 1);
    assert.equal(reservationLocation.rows[0]!.evidence.facilityMatched, true);
    const replay = await post("dispatch", "IDEM_DISPATCH_LOC", { location: device });
    assert.equal(replay.json().commandId, accepted.json().commandId);
    assert.equal(reservationLocation.rows.length, 1);
    for (const bad of [{ ...device, latitude: "0" }, { ...device, extra: 1 }, { ...device, capturedAt: "2026-10-10T02:01:00.000Z" }, { ...device, source: "FACILITY_FALLBACK", fallbackReason: null }])
      assert.equal((await post("dispatch", "IDEM_DISPATCH_BAD_" + Object.keys(bad).length + String(bad.capturedAt).slice(-6, -5) + String(bad.source).length, { location: bad })).statusCode, 400);
    assert.equal((await post("transit", "IDEM_TRANSIT_LOC", { location: device })).statusCode, 400);
  } finally { await app.close(); }
});

test("TC-G03 location audit shows coordinates only to the capturing institution", async () => {
  const sourceFixture = await fixture(source, "ACTIVE");
  try {
    await sourceFixture.post("dispatch", "IDEM_DISPATCH_AUDIT", { location: device });
    const own = await sourceFixture.app.inject({ method: "GET", url: "/api/v2/reservations/RES_SYNTH_DELAY/location-evidence", headers: { cookie: sourceFixture.cookie } });
    assert.equal(own.statusCode, 200);
    assert.deepEqual(own.json().evidence[0].coordinates, { latitude: 0, longitude: 0.0001 });
    const views = await sourceFixture.reservationLocation.list("RES_SYNTH_DELAY");
    assert.equal(scopeLocationView(views as ReservationLocationView[], "INST_SYNTH_MEDIX")[0]!.coordinates, null);
    assert.equal((await sourceFixture.app.inject({ method: "GET", url: "/api/v2/reservations/RES_UNKNOWN/location-evidence", headers: { cookie: sourceFixture.cookie } })).statusCode, 404);
  } finally { await sourceFixture.app.close(); }
});

test("TC-G01 fallback must sit on the facility and carry a reason; evidence ID is deterministic", () => {
  const input = { institutionId: "INST_MEDIATRIX", reservationId: "RES_SYNTH_DELAY", phase: "RECEIPT" as const, idempotencyKey: "IDEM_X", eventTime: now };
  const fallback = captureReservationLocation({ latitude: 0, longitude: 0, accuracyMetres: 500, source: "FACILITY_FALLBACK", fallbackReason: "PERMISSION_DENIED", capturedAt: now }, input);
  assert.equal(fallback.fallback, true);
  assert.equal(captureReservationLocation({ ...device }, input).evidenceId, captureReservationLocation({ ...device }, input).evidenceId);
  assert.throws(() => captureReservationLocation({ latitude: 0, longitude: 0.01, accuracyMetres: 500, source: "FACILITY_FALLBACK", fallbackReason: "PERMISSION_DENIED", capturedAt: now }, input));
  const omitted = captureReservationLocation({ latitude: null, longitude: null, accuracyMetres: 500, source: "FACILITY_FALLBACK", fallbackReason: "SIGNAL_UNAVAILABLE", capturedAt: now }, input);
  assert.deepEqual([omitted.latitude, omitted.longitude, omitted.facilityMatched], [0, 0, true]);
  assert.throws(() => captureReservationLocation({ latitude: null, longitude: null, accuracyMetres: 20, source: "DEVICE", fallbackReason: null, capturedAt: now }, input));
  const far = captureReservationLocation({ ...device, longitude: 0.5 }, input);
  assert.equal(far.facilityMatched, false);
});

test("TC-E05 scheduled expiry queues one service-actor command per component and printed expiry", async () => {
  const candidate = { componentId: "COMP_SYNTH_EXP", institutionId: "INST_SYNTH_MEDIX", expiresAt: "2026-10-09T00:00:00.000Z", ledgerVersion: 3, policyVersion: "SYNTHETIC_INSTITUTION_CORE_V1" };
  const first = expiryCommand(candidate, new Date(now)), later = expiryCommand(candidate, new Date("2026-10-10T03:00:00.000Z"));
  assert.equal(first.idempotencyKey, later.idempotencyKey);
  assert.equal(first.actorUserId, EXPIRY_SERVICE_ACTOR_ID);
  assert.equal(first.payload.evaluationTime, now);
  // v2_commands.correlation_id is varchar(42); found in the live re-test.
  assert.match(first.correlationId, /^CORR_[0-9A-F]{32}$/); // v2_commands_hash2 check constraint
  // Mirrors the v2_commands_id and v2_commands_idempotency check constraints.
  assert.match(first.commandId, /^CMD_[A-Z0-9_-]{1,56}$/);
  assert.match(first.idempotencyKey, /^IDEM_[A-Z0-9_-]{1,59}$/);
  assert.notEqual(expiryCommand({ ...candidate, expiresAt: "2026-10-08T00:00:00.000Z" }, new Date(now)).idempotencyKey, first.idempotencyKey);
  const store = new InMemoryV2CommandStore();
  const evaluator = new ScheduledExpiryEvaluator({} as never, store, 60_000);
  evaluator.candidates = async () => [candidate];
  evaluator.actorRegistered = async () => true;
  assert.equal(await evaluator.runDue(new Date(now)), 1);
  assert.equal(await evaluator.runDue(new Date("2026-10-10T02:00:30.000Z")), 0, "interval not yet due");
  assert.equal(await evaluator.runDue(new Date("2026-10-10T02:01:00.000Z")), 0, "same key replays, nothing new queued");
  const command = await store.get(first.commandId, candidate.institutionId, EXPIRY_SERVICE_ACTOR_ID);
  assert.deepEqual(Object.keys(interviewCorePayload(command!)).sort(), ["actorUserId", "componentId", "correlationId", "evaluationTime", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion"]);
});
