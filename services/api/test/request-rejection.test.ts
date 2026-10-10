import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { ApiConfig } from "../src/config.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

const origin = "http://127.0.0.1:5174";
const config: ApiConfig = { host: "127.0.0.1", port: 3000, jwtSecret: "request-rejection-test-secret-not-deployed", operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: origin, webCookieSecure: false };
const record: CredentialRecord = { userId: "USR_SYNTH_WEB_01", username: "synth_operator_01", displayName: "Synthetic Operator 01", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix 01", institutionCategory: "HOSPITAL", roleId: "ROLE-01", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };

async function fixture() {
  const revoked: string[] = [];
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession(sessionId: string) { revoked.push(sessionId); } };
  const app = await buildApp(new MemoryRepository(), config, () => new Date(), sessions);
  const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_REJECTION", binding: "b".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  return { app, revoked, cookie: `bloodledger_session=${token}` };
}

function assertSafeRejection(response: { statusCode: number; body: string; json(): { error: { code: string; correlationId?: string } } }, status: number, code: string) {
  assert.equal(response.statusCode, status);
  assert.equal(response.json().error.code, code);
  assert.match(String(response.json().error.correlationId), /^CORR_API_/);
  assert.doesNotMatch(response.body, /FST_|stack|SyntaxError/);
}

test("NFR-10 an empty JSON logout body is a client rejection, not a server failure", async () => {
  const { app, cookie } = await fixture();
  try {
    const response = await app.inject({ method: "DELETE", url: "/api/v1/auth/session", headers: { origin, cookie, "content-type": "application/json" } });
    assertSafeRejection(response, 400, "REQUEST_INVALID");
  } finally { await app.close(); }
});

test("NFR-10 malformed, oversized and unsupported bodies keep stable 4xx codes", async () => {
  const { app } = await fixture();
  try {
    assertSafeRejection(await app.inject({ method: "POST", url: "/api/v1/auth/session", headers: { origin, "content-type": "application/json" }, payload: "{\"username\":" }), 400, "REQUEST_INVALID");
    assertSafeRejection(await app.inject({ method: "POST", url: "/api/v1/auth/session", headers: { origin, "content-type": "application/json" }, payload: JSON.stringify({ username: "x".repeat(40 * 1024) }) }), 413, "REQUEST_BODY_TOO_LARGE");
    assertSafeRejection(await app.inject({ method: "POST", url: "/api/v1/auth/session", headers: { origin, "content-type": "application/xml" }, payload: "<session/>" }), 415, "REQUEST_MEDIA_TYPE_UNSUPPORTED");
  } finally { await app.close(); }
});

test("FR-12 logout without a body still revokes the session", async () => {
  const { app, cookie, revoked } = await fixture();
  try {
    const response = await app.inject({ method: "DELETE", url: "/api/v1/auth/session", headers: { origin, cookie } });
    assert.equal(response.statusCode, 204);
    assert.deepEqual(revoked, ["SESS_SYNTH_REJECTION"]);
  } finally { await app.close(); }
});
