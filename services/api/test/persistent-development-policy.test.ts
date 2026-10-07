import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { selectCorePolicy } from "../src/persistent-development-policy.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";
import { interviewCorePayload } from "../src/fabric.js";

const coordinator = { userId: "USR_SYNTH_REVIEW_ROLE02", roleId: "ROLE-02" as const, institutionId: "INST_MEDIATRIX" };
const recipient = { userId: "USR_SYNTH_REVIEW_ROLE03", roleId: "ROLE-03" as const, institutionId: "INST_SYNTH_SECONDARY_REVIEW" };

test("NFR-02 Gateway payload preserves saved policies, legacy default and safe inbound fields", () => {
  for (const policyVersion of ["INTERVIEW_DERIVED_CORE_V2", "INTERVIEW_DERIVED_CORE_V2_1", "PERSISTENT_DEVELOPMENT_CORE_V1"]) {
    const payload = interviewCorePayload({ operation: "REGISTER_INBOUND_COMPONENT", idempotencyKey: "IDEM_RETAINED_GATEWAY", payload: { policyVersion, actorUserId: coordinator.userId, donationNoLookupHmac: "a".repeat(64), donationNoCiphertext: "SYNTHETIC_PRIVATE_TEST_FIELD", captureId: "CAP_SYNTHETIC_GATEWAY" } });
    assert.equal(payload.policyVersion, policyVersion); assert.equal(payload.donationNoDigest, "a".repeat(64));
    assert.equal(payload.donationNoCiphertext, undefined); assert.equal(payload.captureId, undefined);
  }
  assert.equal(interviewCorePayload({ operation: "SUBMIT_TRANSFER", idempotencyKey: "IDEM_RETAINED_GATEWAY", payload: {} }).policyVersion, "INTERVIEW_DERIVED_CORE_V2");
  assert.throws(() => interviewCorePayload({ operation: "SUBMIT_TRANSFER", idempotencyKey: "IDEM_RETAINED_GATEWAY", payload: { policyVersion: "UNKNOWN_POLICY" } }), { code: "CORE_POLICY_UNSUPPORTED" });
});

test("FR-12 exact retained tuples select the new policy while wrong tuples and V2 fail", () => {
  for (const actor of [coordinator, recipient]) {
    assert.equal(selectCorePolicy(actor, "V2.1"), "PERSISTENT_DEVELOPMENT_CORE_V1");
    assert.throws(() => selectCorePolicy({ ...actor, institutionId: "INST_DIVINE_LOVE" }, "V2.1"), { code: "AUTH_SCOPE_FORBIDDEN" });
    assert.throws(() => selectCorePolicy({ ...actor, roleId: "ROLE-01" }, "V2.1"), { code: "AUTH_SCOPE_FORBIDDEN" });
    assert.throws(() => selectCorePolicy(actor, "V2"), { code: "V2_1_CONTRACT_REQUIRED" });
  }
  assert.equal(selectCorePolicy({ ...coordinator, userId: "USR_MEDIATRIX_TECH" }, "V2.1"), "INTERVIEW_DERIVED_CORE_V2_1");
  assert.equal(selectCorePolicy({ ...coordinator, userId: "USR_MEDIATRIX_TECH" }, "V2"), "INTERVIEW_DERIVED_CORE_V2");
});

test("FR-12 official-cookie V2.1 request persists retained identity and policy, denies mismatches and replays", async () => {
  let record: CredentialRecord = { ...recipient, username: "synthetic_retained_recipient", displayName: "Synthetic Retained Recipient", institutionDisplayName: "Synthetic Retained Institution", institutionCategory: "HOSPITAL", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const store = new InMemoryV2CommandStore();
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "retained-policy-in-process-test-key".repeat(2), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "retained-in-process-fixture", workerConfigured: false, webOrigin: "http://127.0.0.1:5174" }, () => new Date("2026-10-08T00:00:00.000Z"), sessions, undefined, undefined, { store });
  const token = () => app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_RETAINED", binding: "a".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  const payload = { transferId: "TRF_RETAINED_API_001", sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: recipient.institutionId, componentType: "CRYOPRECIPITATE", bloodType: "A_POSITIVE", quantity: 1, urgency: "ROUTINE", requestTime: "2026-10-08T00:00:00.000Z", eventTime: "2026-10-08T00:00:00.000Z", correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF" };
  const request = (body = payload) => app.inject({ method: "POST", url: "/api/v2/transfers", headers: { cookie: `bloodledger_session=${token()}`, origin: "http://127.0.0.1:5174", "idempotency-key": "IDEM_RETAINED_API_001", "x-bloodledger-contract-version": "V2.1" }, payload: body });
  try {
    const accepted = await request(); assert.equal(accepted.statusCode, 202);
    const command = await store.get(accepted.json().commandId, recipient.institutionId, recipient.userId);
    assert.equal(command?.payload.policyVersion, "PERSISTENT_DEVELOPMENT_CORE_V1"); assert.equal(command?.actorUserId, recipient.userId);
    const replay = await request(); assert.equal(replay.statusCode, 202); assert.equal(replay.json().replayed, true); assert.equal(replay.json().commandId, accepted.json().commandId);
    assert.equal((await request({ ...payload, destinationInstitutionId: "INST_DIVINE_LOVE" })).statusCode, 403);
    record = { ...record, institutionId: "INST_DIVINE_LOVE" }; assert.equal((await request()).statusCode, 403);
    record = { ...record, ...coordinator }; assert.equal((await request()).statusCode, 403);
  } finally { await app.close(); }
});
