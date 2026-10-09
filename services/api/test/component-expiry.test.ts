import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { interviewCorePayload } from "../src/fabric.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

const origin = "http://127.0.0.1:5174";
const now = Date.parse("2026-10-12T00:00:00.000Z");
const at = (offsetMs: number) => new Date(now + offsetMs).toISOString();
const config = { host: "127.0.0.1", port: 3000, jwtSecret: "component-expiry-test-".repeat(3), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: origin };
const source: CredentialRecord = { userId: "USR_SYNTH_ADMIN", username: "synth_admin", displayName: "Synthetic Hospital Administrator", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix Verification", institutionCategory: "HOSPITAL", roleId: "ROLE-02", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
const recipient: CredentialRecord = { ...source, userId: "USR_SYNTH_RECIPIENT", username: "synth_recipient", institutionId: "INST_SYNTH_SECONDARY_01", roleId: "ROLE-03" };

function component(id: string, inventoryStatus: string, expiresAt: string, inventoryVersion = 1, institutionId = "INST_MEDIATRIX") {
  return { componentId: id, donationId: `DON_${id}`, issuerInstitutionId: "INST_MEDIATRIX", componentType: "PACKED_RED_BLOOD_CELLS", bloodType: "O_POSITIVE", collectedAt: "2026-09-01T00:00:00.000Z", expiresAt, institutionId, inventoryStatus, reservationId: inventoryStatus === "RESERVED" ? "RES_SYNTH_EXP" : null, reservationVersion: inventoryStatus === "RESERVED" ? 1 : null, inventoryVersion, policyVersion: "INTERVIEW_DERIVED_CORE_V2", classification: "SIMULATION_ONLY" as const };
}
const components = [
  component("COMP_EXP_CURRENT", "AVAILABLE", at(1)),
  component("COMP_EXP_EDGE", "AVAILABLE", at(0), 3),
  component("COMP_EXP_PENDING", "AVAILABLE", at(-3_600_000)),
  component("COMP_EXP_RESERVED", "RESERVED", at(-3_600_000), 2),
  component("COMP_EXP_DONE", "EXPIRED", at(-86_400_000), 2),
  component("COMP_EXP_TRANSIT", "IN_TRANSIT", at(-3_600_000), 3),
  component("COMP_EXP_FOREIGN", "AVAILABLE", at(-3_600_000), 1, "INST_SYNTH_SECONDARY_01"),
];

async function fixture(record: CredentialRecord = source) {
  let clock = now;
  const store = new InMemoryV2CommandStore();
  const scoped = (institutionId: string) => components.filter((item) => item.institutionId === institutionId);
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const projection = {
    async listComponents(institutionId: string) { return scoped(institutionId); },
    async getComponent(componentId: string, institutionId: string) { return scoped(institutionId).find((item) => item.componentId === componentId) ?? null; },
    async findComponentByIdentity() { return null; },
  };
  const app = await buildApp(new MemoryRepository(), config, () => new Date(clock), sessions, undefined, undefined, { store, projection });
  const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_EXPIRY", binding: "b".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  const cookie = `bloodledger_session=${token}`;
  const evaluate = (componentId: string, key: string, payload: unknown, headers: Record<string, string> = {}) => app.inject({ method: "POST", url: `/api/v2/components/${componentId}/expiry`, headers: { cookie, origin, "idempotency-key": key, ...headers }, payload: payload as Record<string, unknown> });
  const commands = async () => (await store.list(record.institutionId, record.userId, 50)).commands;
  return { app, store, cookie, evaluate, commands, advance(ms: number) { clock += ms; } };
}
const body = (expectedVersion = 1) => ({ correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", expectedVersion });

test("FR-08/FR-09 component reads expose the label expiry state without changing ledger status", async () => {
  const { app, cookie } = await fixture();
  try {
    const list = await app.inject({ method: "GET", url: "/api/v2/components", headers: { cookie } });
    assert.equal(list.statusCode, 200);
    const states = Object.fromEntries(list.json().components.map((item: { componentId: string; expiryState: string; inventoryStatus: string }) => [item.componentId, [item.expiryState, item.inventoryStatus]]));
    assert.deepEqual(states, {
      COMP_EXP_CURRENT: ["CURRENT", "AVAILABLE"],
      COMP_EXP_EDGE: ["LABEL_EXPIRED_PENDING_EVALUATION", "AVAILABLE"],
      COMP_EXP_PENDING: ["LABEL_EXPIRED_PENDING_EVALUATION", "AVAILABLE"],
      COMP_EXP_RESERVED: ["LABEL_EXPIRED_PENDING_EVALUATION", "RESERVED"],
      COMP_EXP_DONE: ["EXPIRED", "EXPIRED"],
      COMP_EXP_TRANSIT: ["LABEL_EXPIRED_NOT_IN_INVENTORY", "IN_TRANSIT"],
    });
    const detail = await app.inject({ method: "GET", url: "/api/v2/components/COMP_EXP_PENDING", headers: { cookie } });
    assert.equal(detail.json().expiryState, "LABEL_EXPIRED_PENDING_EVALUATION");
    assert.equal(detail.json().inventoryStatus, "AVAILABLE");
  } finally { await app.close(); }
});

test("BL-INV-03 queues a server-timed expiry evaluation with the exact chaincode payload", async () => {
  const { app, store, evaluate } = await fixture();
  try {
    const response = await evaluate("COMP_EXP_PENDING", "IDEM_EXPIRY_1", body());
    assert.equal(response.statusCode, 202);
    assert.equal(response.json().resourceType, "COMPONENT");
    assert.equal(response.json().status, "QUEUED");
    const command = await store.get(response.json().commandId, source.institutionId, source.userId);
    assert.ok(command);
    assert.equal(command.operation, "EVALUATE_COMPONENT_EXPIRY");
    assert.equal(command.payload.evaluationTime, at(0));
    assert.equal(command.payload.eventTime, at(0));
    assert.equal(command.payload.actorUserId, source.userId);
    assert.deepEqual(Object.keys(interviewCorePayload(command)).sort(), ["actorUserId", "componentId", "correlationId", "evaluationTime", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion"]);
    assert.equal((await evaluate("COMP_EXP_EDGE", "IDEM_EXPIRY_EDGE", body(3))).statusCode, 202);
  } finally { await app.close(); }
});

test("NFR-05 an expiry retry replays the original evaluation time and detects a changed body", async () => {
  const { app, store, evaluate, advance } = await fixture();
  try {
    const first = await evaluate("COMP_EXP_PENDING", "IDEM_EXPIRY_RETRY", body());
    advance(3_600_000);
    const retry = await evaluate("COMP_EXP_PENDING", "IDEM_EXPIRY_RETRY", body());
    assert.equal(retry.statusCode, 202);
    assert.equal(retry.json().replayed, true);
    assert.equal(retry.json().commandId, first.json().commandId);
    assert.equal((await store.get(first.json().commandId, source.institutionId, source.userId))?.payload.evaluationTime, at(0));
    const changed = await evaluate("COMP_EXP_PENDING", "IDEM_EXPIRY_RETRY", body(2));
    assert.equal(changed.statusCode, 409);
    assert.equal(changed.json().error.code, "V2_IDEMPOTENCY_CONFLICT");
  } finally { await app.close(); }
});

test("FR-12 expiry evaluation rejects unsafe, stale, foreign and unauthorized requests without queuing", async () => {
  const { app, evaluate, commands } = await fixture();
  try {
    const cases: Array<[string, unknown, number, string, Record<string, string>?]> = [
      ["COMP_EXP_CURRENT", body(), 409, "COMPONENT_LABEL_NOT_EXPIRED"],
      ["COMP_EXP_RESERVED", body(2), 409, "COMPONENT_EXPIRY_RESERVATION_ACTIVE"],
      ["COMP_EXP_DONE", body(2), 409, "COMPONENT_ALREADY_EXPIRED"],
      ["COMP_EXP_TRANSIT", body(3), 409, "COMPONENT_EXPIRY_TRANSITION_INVALID"],
      ["COMP_EXP_PENDING", body(2), 409, "COMPONENT_VERSION_CONFLICT"],
      ["COMP_EXP_FOREIGN", body(), 404, "V2_COMPONENT_NOT_FOUND"],
      ["COMP_EXP_PENDING", { ...body(), evaluationTime: at(-86_400_000) }, 400, "V2_INPUT_INVALID"],
      ["COMP_EXP_PENDING", body(0), 400, "V2_INPUT_INVALID"],
      ["COMP_EXP_PENDING", body(), 403, "ORIGIN_FORBIDDEN", { origin: "http://untrusted.invalid" }],
    ];
    for (const [index, [componentId, payload, status, code, headers]] of cases.entries()) {
      const response = await evaluate(componentId, `IDEM_EXPIRY_REJECT_${index}`, payload, headers);
      assert.equal(response.statusCode, status, `${componentId} ${code}`);
      assert.equal(response.json().error.code, code);
    }
    assert.equal((await commands()).length, 0);
  } finally { await app.close(); }
  const destination = await fixture(recipient);
  try {
    const response = await destination.evaluate("COMP_EXP_FOREIGN", "IDEM_EXPIRY_ROLE", body());
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "AUTH_SCOPE_FORBIDDEN");
  } finally { await destination.app.close(); }
});

test("NFR-05 a reconciliation retry replays the original server-timed command", async () => {
  const { app, store, cookie, advance } = await fixture();
  const hold = { caseId: "RECON_SYNTH_RETRY", componentId: "COMP_EXP_CURRENT", correlationId: "CORR_0123456789ABCDEF0123456789ABCDE1", reasonCode: "LABEL_RECORD_MISMATCH" };
  const send = (payload: Record<string, unknown>) => app.inject({ method: "POST", url: "/api/v2/reconciliation", headers: { cookie, origin, "idempotency-key": "IDEM_RECON_RETRY" }, payload });
  try {
    const first = await send(hold);
    assert.equal(first.statusCode, 202);
    advance(60_000);
    const retry = await send(hold);
    assert.equal(retry.statusCode, 202);
    assert.equal(retry.json().replayed, true);
    assert.equal((await store.get(first.json().commandId, source.institutionId, source.userId))?.payload.eventTime, at(0));
    const changed = await send({ ...hold, reasonCode: "DATE_MISMATCH" });
    assert.equal(changed.statusCode, 409);
    assert.equal(changed.json().error.code, "V2_IDEMPOTENCY_CONFLICT");
  } finally { await app.close(); }
});
