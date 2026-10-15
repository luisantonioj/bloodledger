import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { assembleNetworkAvailability, assembleRequestHistory, assembleSummary, parseHistoryRange } from "../src/blood-bank-reads.js";
import { compareLabels, parseOutboundInput } from "../src/outbound-verification.js";
import { allowedOperatorAction } from "../src/operator-verification.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord, WebPrincipal } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

// ADR-046/047 blood-bank completion contracts; synthetic values only.
const now = new Date("2026-10-15T08:00:00.000Z");

test("BLOOD_BANK_SUMMARY_V1 keeps counts complete, separates label-expired stock and blocks Expiring Soon on RQ-03", () => {
  const summary = assembleSummary({ available: 489, reserved: 33, label_expired_pending: 0, last_projected_at: new Date("2026-10-15T07:59:00.250Z"), incoming_awaiting: 4, outgoing_awaiting: 0 }, now);
  assert.equal(summary.scope, "INSTITUTION");
  assert.deepEqual(summary.inventory, { available: 489, reserved: 33, labelExpiredPendingEvaluation: 0, lastProjectedAt: "2026-10-15T07:59:00.250Z" });
  assert.deepEqual(summary.requests, { incomingAwaitingDecision: 4, outgoingAwaitingDecision: 0 });
  assert.deepEqual(summary.expiringSoon, { availability: "POLICY_BLOCKED", count: null, blocker: "RQ-03" });
  // A genuine zero stays zero; an unprojected institution has a null projection time.
  assert.equal(assembleSummary({ available: 0, reserved: 0, label_expired_pending: 0, last_projected_at: null, incoming_awaiting: 0, outgoing_awaiting: 0 }, now).inventory.lastProjectedAt, null);
});

test("NETWORK_AVAILABILITY_V1 is a labelled city aggregate with per-institution freshness", () => {
  const network = assembleNetworkAvailability([{ institution_id: "INST_MEDIATRIX", display_name: "Synthetic Mediatrix Hospital", blood_type: "O_POSITIVE", component_type: "PLATELETS", available_units: 7, last_projected_at: new Date("2026-10-15T07:00:00.000Z") }], now);
  assert.equal(network.scope, "CITY_AGGREGATE");
  assert.deepEqual(network.rows[0], { institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix Hospital", bloodType: "O_POSITIVE", componentType: "PLATELETS", availableUnits: 7, lastProjectedAt: "2026-10-15T07:00:00.000Z" });
});

test("REQUEST_HISTORY_AGGREGATE_V1 validates Manila date ranges and labels direction from the caller's side", () => {
  assert.deepEqual(parseHistoryRange("2026-01-01", "2026-12-31"), { from: "2026-01-01", to: "2026-12-31" });
  for (const [from, to] of [["2026-01-02", "2026-01-01"], ["2025-01-01", "2026-01-02"], ["2026-02-30", "2026-03-01"], [undefined, "2026-01-01"], ["2026-1-1", "2026-01-02"]]) {
    assert.throws(() => parseHistoryRange(from, to), (error: { code?: string }) => error.code === "REQUEST_HISTORY_RANGE_INVALID");
  }
  const history = assembleRequestHistory("INST_MEDIATRIX", { from: "2026-10-01", to: "2026-10-15" }, [
    { request_date: "2026-10-08", source_institution_id: "INST_MEDIATRIX", blood_type: "A_POSITIVE", component_type: "PLATELETS", urgency: "ROUTINE", request_count: 2, requested_units: 3 },
    { request_date: "2026-10-09", source_institution_id: "INST_SYNTH_MEDIX", blood_type: "A_POSITIVE", component_type: "PLATELETS", urgency: "URGENT", request_count: 1, requested_units: 1 },
  ], now);
  assert.deepEqual(history.rows.map((row) => row.direction), ["INCOMING", "OUTGOING"]);
  assert.equal(history.departmentAvailability, "NOT_RECORDED");
  assert.equal(history.range.timeZone, "Asia/Manila");
});

test("OUTBOUND_LABEL_VERIFICATION_V1 takes exact bodies and reports only match counts", () => {
  const valid = { expectedVersion: 1, correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", scannedLabels: ["MM26-10-0001"] };
  assert.equal(parseOutboundInput(valid).scannedLabels.length, 1);
  for (const invalid of [{ ...valid, scannedLabels: [] }, { ...valid, expectedVersion: 0 }, { ...valid, note: "x" }, { ...valid, scannedLabels: [7] }]) {
    assert.throws(() => parseOutboundInput(invalid), (error: { code?: string }) => error.code === "OUTBOUND_VERIFICATION_INPUT_INVALID");
  }
  assert.throws(() => parseOutboundInput({ ...valid, scannedLabels: ["MM26-10-0001", "MM26-10-0001"] }), (error: { code?: string }) => error.code === "OUTBOUND_LABEL_DUPLICATE");
  const members = new Map([["COMP_A", "h1"], ["COMP_B", "h2"]]);
  assert.deepEqual(compareLabels(members, ["h2", "h1"]), { expectedUnits: 2, matchedUnits: 2, unmatchedLabels: 0, missingUnits: 0 });
  assert.deepEqual(compareLabels(members, ["h1", "hX"]), { expectedUnits: 2, matchedUnits: 1, unmatchedLabels: 1, missingUnits: 1 });
});

test("the outbound verification action is bound to blood-bank ROLE-01/02 operators", () => {
  const bank = { accountCategory: "BLOOD_BANK" } as WebPrincipal, requester = { accountCategory: "REQUESTOR" } as WebPrincipal;
  const action = "POST /api/v2/reservations/RES_SYNTH_1/outbound-verifications";
  for (const roleId of ["ROLE-01", "ROLE-02"] as const) assert.equal(allowedOperatorAction(bank, { operatorId: "USR_SYNTH_OP", roleId, capabilityProfile: "ROLE", version: 1 }, action), true);
  assert.equal(allowedOperatorAction(requester, { operatorId: "USR_SYNTH_OP", roleId: "ROLE-03", capabilityProfile: "ROLE", version: 1 }, action), false);
});

function credential(roleId: CredentialRecord["roleId"], institutionId: string): CredentialRecord {
  return { userId: "USR_SYNTH_SUMMARY", username: "synth_summary", displayName: "Synthetic Summary Reader", institutionId, institutionDisplayName: "Synthetic Institution", institutionCategory: roleId === "ROLE-04" ? "REGULATOR" : "HOSPITAL", roleId, saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
}

test("routes enforce the decided role scopes and pass the caller's own institution", async () => {
  const calls: unknown[][] = [];
  const bloodBank = {
    async summary(...args: unknown[]) { calls.push(["summary", args[0]]); return { available: 1, reserved: 0, label_expired_pending: 0, last_projected_at: null, incoming_awaiting: 0, outgoing_awaiting: 0 }; },
    async networkAvailability() { calls.push(["network"]); return []; },
    async requestHistory(...args: unknown[]) { calls.push(["history", ...args]); return []; },
  };
  const statusFor = async (record: CredentialRecord, url: string) => {
    const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
    const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "blood-bank-completion-secret-long-enough", operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: "http://127.0.0.1:5174" },
      () => now, sessions, undefined, undefined, { store: new InMemoryV2CommandStore(), bloodBank });
    const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_BANK", binding: "7".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
    try { return (await app.inject({ method: "GET", url, headers: { cookie: `bloodledger_session=${token}` } })).statusCode; } finally { await app.close(); }
  };
  const bank = credential("ROLE-02", "INST_MEDIATRIX"), technologist = credential("ROLE-01", "INST_MEDIATRIX"), requester = credential("ROLE-03", "INST_SYNTH_SECONDARY_01"), regulator = credential("ROLE-04", "INST_SYNTH_REGULATOR");
  assert.equal(await statusFor(bank, "/api/v2/dashboard/summary"), 200);
  assert.equal(await statusFor(technologist, "/api/v2/dashboard/summary"), 200);
  assert.equal(await statusFor(requester, "/api/v2/dashboard/summary"), 403);
  assert.equal(await statusFor(regulator, "/api/v2/dashboard/summary"), 403);
  assert.equal(await statusFor(requester, "/api/v2/network-availability"), 200);
  assert.equal(await statusFor(regulator, "/api/v2/network-availability"), 403);
  assert.equal(await statusFor(bank, "/api/v2/analytics/request-history?from=2026-10-01&to=2026-10-15"), 200);
  assert.equal(await statusFor(bank, "/api/v2/analytics/request-history?from=2026-10-15&to=2026-10-01"), 400);
  assert.equal(await statusFor(requester, "/api/v2/analytics/request-history?from=2026-10-01&to=2026-10-15"), 403);
  assert.deepEqual(calls.filter((call) => call[0] !== "network"), [["summary", "INST_MEDIATRIX"], ["summary", "INST_MEDIATRIX"], ["history", "INST_MEDIATRIX", "2026-10-01", "2026-10-15"]]);
});
