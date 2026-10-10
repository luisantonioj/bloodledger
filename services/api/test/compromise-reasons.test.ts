import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { interviewCorePayload } from "../src/fabric.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

// Exact input keys of InterviewCoreContract.MarkReservationCompromised (parseReservationAction + reasonCode).
const MARK_RESERVATION_COMPROMISED_KEYS = ["actorUserId", "correlationId", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion", "reasonCode", "reservationId"];
const origin = "http://127.0.0.1:5174";
const now = "2026-10-10T02:00:00.000Z";
const source: CredentialRecord = { userId: "USR_SYNTH_ADMIN", username: "synth_admin", displayName: "Synthetic Hospital Administrator", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix Verification", institutionCategory: "HOSPITAL", roleId: "ROLE-02", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
const regulator: CredentialRecord = { ...source, userId: "USR_SYNTH_REGULATOR", username: "synth_regulator", institutionId: "INST_SYNTH_DOH", institutionCategory: "REGULATOR", roleId: "ROLE-04" };
const reservation = {
  reservationId: "RES_SYNTH_COMPROMISE", purpose: "TRANSFER" as const, status: "DISPATCHED", version: 3, sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_SYNTH_SECONDARY_01",
  transferId: "TRF_SYNTH_COMPROMISE", localReleaseId: null, preparedAt: now, preparedEvidencePresent: true, updatedAt: now,
  components: [{ componentId: "COMP_SYNTH_COMPROMISE", componentType: "PACKED_RED_BLOOD_CELLS", inventoryStatus: "DISPATCHED", inventoryVersion: 4 }], classification: "SIMULATION_ONLY" as const,
};

async function fixture(record: CredentialRecord) {
  const store = new InMemoryV2CommandStore();
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const projection = { async listComponents() { return []; }, async getComponent() { return null; }, async findComponentByIdentity() { return null; }, async getReservation(id: string) { return id === reservation.reservationId ? reservation : null; } };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "compromise-reasons-test-".repeat(3), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: origin }, () => new Date(now), sessions, undefined, undefined, { store, projection });
  const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_COMPROMISE", binding: "b".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  const cookie = `bloodledger_session=${token}`;
  const compromise = (key: string, reasonCode: unknown) => app.inject({ method: "POST", url: `/api/v2/reservations/${reservation.reservationId}/compromise`, headers: { cookie, origin, "idempotency-key": key }, payload: { correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", eventTime: now, expectedVersion: reservation.version, reasonCode } });
  return { app, store, cookie, compromise };
}

test("FR-11 BL-DEC-S6-2026-09-23-01 discovers the synthetic compromise vocabulary for permitted roles only", async () => {
  const { app, cookie } = await fixture(source);
  try {
    const response = await app.inject({ method: "GET", url: "/api/v2/reservations/compromise-reasons", headers: { cookie } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().policyVersion, "SYNTHETIC_COMPROMISE_REASONS_V1");
    assert.equal(response.json().effect, "QUARANTINE_PENDING_MANUAL_REVIEW");
    assert.equal(response.json().freeTextAllowed, false);
    assert.deepEqual(response.json().reasons.map((reason: { code: string }) => reason.code), ["TEMPERATURE_EXCURSION_REPORTED", "CONTAINER_DAMAGE_OR_LEAK_REPORTED", "VISIBLE_COMPONENT_ABNORMALITY_REPORTED", "HANDLING_OR_CUSTODY_DEVIATION_REPORTED"]);
  } finally { await app.close(); }
  const reader = await fixture(regulator);
  try {
    const response = await reader.app.inject({ method: "GET", url: "/api/v2/reservations/compromise-reasons", headers: { cookie: reader.cookie } });
    assert.equal(response.statusCode, 403);
  } finally { await reader.app.close(); }
});

test("FR-11 rejects an unlisted compromise reason before queuing and records the policy only off-chain", async () => {
  const { app, store, compromise } = await fixture(source);
  try {
    for (const [key, code] of [["IDEM_COMPROMISE_FREE", "SYNTHETIC_REHEARSAL_DAMAGE"], ["IDEM_COMPROMISE_LOWER", "temperature_excursion_reported"], ["IDEM_COMPROMISE_NUMBER", 7]] as const) {
      const rejected = await compromise(key, code);
      assert.equal(rejected.statusCode, 400, key);
      assert.equal(rejected.json().error.code, "COMPROMISE_REASON_INVALID");
    }
    assert.equal((await store.list(source.institutionId, source.userId, 50)).commands.length, 0);
    const accepted = await compromise("IDEM_COMPROMISE_OK", "CONTAINER_DAMAGE_OR_LEAK_REPORTED");
    assert.equal(accepted.statusCode, 202);
    const command = await store.get(accepted.json().commandId, source.institutionId, source.userId);
    assert.equal(command?.operation, "COMPROMISE_RESERVATION");
    assert.equal(command?.payload.compromisePolicyVersion, "SYNTHETIC_COMPROMISE_REASONS_V1");
    assert.deepEqual(Object.keys(interviewCorePayload(command!)).sort(), MARK_RESERVATION_COMPROMISED_KEYS);
  } finally { await app.close(); }
});
