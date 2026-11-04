import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { MemoryRepository } from "./test-support.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { assembleStockCounts, DASHBOARD_BLOOD_TYPE_ORDER, STOCK_COUNT_FIELDS } from "../src/dashboard-stock-counts.js";
import { INTERVIEW_V2_1_COMPONENT_TYPES } from "../src/v2-contracts.js";

const now = new Date("2026-11-04T02:00:00.000Z");

test("PA-REV-03 exact counts: a zero-filled 8 x 5 matrix in fixed order, one field per status", () => {
  const result = assembleStockCounts("INST_MEDIATRIX", {
    rows: [
      { blood_type: "O_POSITIVE", component_type: "PACKED_RED_BLOOD_CELLS", bucket: "available", count: 25 },
      { blood_type: "O_POSITIVE", component_type: "PACKED_RED_BLOOD_CELLS", bucket: "reserved", count: "2" },
      { blood_type: "O_POSITIVE", component_type: "PACKED_RED_BLOOD_CELLS", bucket: "labelExpiredPendingEvaluation", count: 1 },
      { blood_type: "A_NEGATIVE", component_type: "CRYOPRECIPITATE", bucket: "outgoingInTransit", count: 3 },
      { blood_type: "A_NEGATIVE", component_type: "CRYOPRECIPITATE", bucket: "expired", count: 4 },
      { blood_type: "B_POSITIVE", component_type: "PLATELETS", bucket: "onHold", count: 1 },
      { blood_type: "B_POSITIVE", component_type: "PLATELETS", bucket: "compromised", count: 1 },
      { blood_type: "AB_NEGATIVE", component_type: "WHOLE_BLOOD", bucket: "received", count: 2 },
      // Released units and types outside the matrix are not stock on hand.
      { blood_type: "O_POSITIVE", component_type: "PACKED_RED_BLOOD_CELLS", bucket: "excluded", count: 9 },
      { blood_type: "O_POSITIVE", component_type: "RED_BLOOD_CELLS", bucket: "available", count: 7 },
    ],
    lastProjectedAt: new Date("2026-11-04T01:59:00.000Z"),
    pendingCommands: "2",
  }, now);
  assert.equal(result.rows.length, 40);
  assert.deepEqual(result.rows.slice(0, 5).map((row) => `${row.bloodType}|${row.componentType}`), INTERVIEW_V2_1_COMPONENT_TYPES.map((component) => `A_POSITIVE|${component}`));
  assert.deepEqual([...new Set(result.rows.map((row) => row.bloodType))], [...DASHBOARD_BLOOD_TYPE_ORDER]);
  const cell = (bloodType: string, componentType: string) => result.rows.find((row) => row.bloodType === bloodType && row.componentType === componentType)!;
  assert.deepEqual(cell("O_POSITIVE", "PACKED_RED_BLOOD_CELLS"), { bloodType: "O_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", available: 25, reserved: 2, outgoingInTransit: 0, received: 0, labelExpiredPendingEvaluation: 1, expired: 0, onHold: 0, compromised: 0 });
  assert.equal(cell("A_NEGATIVE", "CRYOPRECIPITATE").outgoingInTransit, 3);
  assert.equal(cell("A_POSITIVE", "WHOLE_BLOOD").available, 0, "absent combinations are exact zeros");
  assert.deepEqual(result.totals, { available: 25, reserved: 2, outgoingInTransit: 3, received: 2, labelExpiredPendingEvaluation: 1, expired: 4, onHold: 1, compromised: 1, usable: 27 });
  assert.equal(result.pendingCommands, 2, "pending commands are reported, not counted");
  assert.equal(result.evaluatedAt, now.toISOString());
  assert.equal(result.lastProjectedAt, "2026-11-04T01:59:00.000Z");
  assert.deepEqual(Object.keys(result.rows[0]!).slice(2), [...STOCK_COUNT_FIELDS]);
  assert.equal(result.classification, "SIMULATION_ONLY");
});

function credential(roleId: CredentialRecord["roleId"], institutionId: string): CredentialRecord {
  return { userId: "USR_SYNTH_STOCK", username: "synth_stock", displayName: "Synthetic Stock Reader", institutionId, institutionDisplayName: "Synthetic Institution", institutionCategory: roleId === "ROLE-04" ? "REGULATOR" : "HOSPITAL", roleId, saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
}

test("PA-REV-03 route: own blood bank only; 503 without the exact-count reader", async () => {
  const calls: unknown[][] = [];
  const reader = {
    async summary() { return {}; }, async networkAvailability() { return []; }, async requestHistory() { return []; },
    async stockCounts(institutionId: string, at: Date) { calls.push([institutionId, at.toISOString()]); return { rows: [], lastProjectedAt: null, pendingCommands: 0 }; },
  };
  const request = async (record: CredentialRecord, bloodBank: object) => {
    const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
    const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "dashboard-stock-count-secret-long-enough", operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: "http://127.0.0.1:5174" },
      () => now, sessions, undefined, undefined, { store: new InMemoryV2CommandStore(), bloodBank: bloodBank as never });
    const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_STOCK", binding: "8".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
    try { return await app.inject({ method: "GET", url: "/api/v2/dashboard/stock-counts", headers: { cookie: `bloodledger_session=${token}` } }); } finally { await app.close(); }
  };
  for (const roleId of ["ROLE-01", "ROLE-02"] as const) {
    const response = await request(credential(roleId, "INST_MEDIATRIX"), reader);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().rows.length, 40);
    assert.equal(response.json().policyVersion, "DASHBOARD_EXACT_STOCK_V1");
  }
  assert.deepEqual(calls, [["INST_MEDIATRIX", now.toISOString()], ["INST_MEDIATRIX", now.toISOString()]], "always the caller's own institution");
  assert.equal((await request(credential("ROLE-03", "INST_SYNTH_SECONDARY_01"), reader)).statusCode, 403);
  assert.equal((await request(credential("ROLE-04", "INST_SYNTH_REGULATOR"), reader)).statusCode, 403);
  const { stockCounts: _omitted, ...withoutStockCounts } = reader;
  assert.equal((await request(credential("ROLE-02", "INST_MEDIATRIX"), withoutStockCounts)).statusCode, 503);
});
