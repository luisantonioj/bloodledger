/** FR-12 / FR-14 / BR-ALG-07: internal ML evidence safety boundaries. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { buildCensusSnapshot, V2_1_COMPONENT_TYPES } from "../src/census.js";
import { type MlInventorySnapshot, PostgresMlInventorySnapshotStore, INTERNAL_ML_SNAPSHOT_POLICY_VERSION, INTERNAL_ML_SNAPSHOT_SCHEMA_VERSION } from "../src/census-worker.js";
import { readInventoryEvidence, validatePersistedMlCounts } from "../src/inventory-evidence.js";
import { buildApp } from "../src/app.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import { MemoryRepository } from "./test-support.js";
import { deriveVerifier, type CredentialRecord } from "../src/session.js";

const now = new Date("2026-10-01T04:00:00.000Z");
const base = buildCensusSnapshot({ snapshotId: "CENSUS_TEST_EVIDENCE", scheduledFor: "2026-10-01T01:00:00.000Z", capturedAt: now.toISOString(), reportPolicyVersion: INTERNAL_ML_SNAPSHOT_POLICY_VERSION, componentTypes: V2_1_COMPONENT_TYPES, rows: [] });
const snapshot: MlInventorySnapshot = { ...base, institutionId: "INST_MEDIATRIX", snapshotKind: "INTERNAL_ML" as const, schemaVersion: INTERNAL_ML_SNAPSHOT_SCHEMA_VERSION, projectionWatermark: 0 };
const counts = base.groups.flatMap(group => group.bloodTypes.map(item => ({ component_type: group.componentType, blood_type: item.bloodType, available_count: item.availableCount, reserved_count: item.reservedCount, forecast_eligible_available_count: item.forecastEligibleAvailableCount, reportable_count: item.reportableCount })));

test("complete persisted zeros are valid; absent, duplicate and invalid rows never become zero", () => {
  validatePersistedMlCounts(counts);
  assert.throws(() => validatePersistedMlCounts(counts.slice(1)), /COVERAGE/);
  assert.throws(() => validatePersistedMlCounts([counts[0]!, ...counts.slice(0, 39)]), /COUNTS/);
  for (const patch of [{ available_count: -1 }, { available_count: 0.5 }, { forecast_eligible_available_count: 1 }, { reportable_count: 1 }, { component_type: "UNKNOWN" }]) {
    assert.throws(() => validatePersistedMlCounts([{ ...counts[0]!, ...patch }, ...counts.slice(1)]), /COUNTS/);
  }
});

test("persisted reader checks coverage before reconstruction and digest independently", async () => {
  const header = { snapshot_id: snapshot.snapshotId, institution_id: snapshot.institutionId, scheduled_for: snapshot.scheduledFor, captured_at: snapshot.capturedAt, policy_version: snapshot.reportPolicyVersion, schema_version: snapshot.schemaVersion, projection_watermark: 0, source_projection_digest: snapshot.sourceProjectionDigest };
  let storedCounts = counts;
  let storedHeader = header;
  const pool = { async query(sql: string) { return { rows: sql.includes("FROM app.ml_inventory_snapshot_counts") ? storedCounts : [storedHeader] }; } } as unknown as Pool;
  const store = new PostgresMlInventorySnapshotStore(pool);
  assert.equal((await store.get(snapshot.snapshotId, snapshot.institutionId))?.groups.length, 5);
  storedCounts = counts.slice(1);
  await assert.rejects(() => store.get(snapshot.snapshotId, snapshot.institutionId), /COVERAGE/);
  storedCounts = counts;
  storedHeader = { ...header, source_projection_digest: "f".repeat(64) };
  await assert.rejects(() => store.get(snapshot.snapshotId, snapshot.institutionId), /DIGEST/);
});

test("same-day, historical, future and unavailable inventory remain independent of forecasts", async () => {
  const reader = { async latest(institution: string, before: Date) { assert.equal(institution, "INST_MEDIATRIX"); assert.equal(before.toISOString(), "2026-10-01T16:00:00.000Z"); return snapshot; } };
  assert.equal((await readInventoryEvidence(reader, "INST_MEDIATRIX", "2026-10-01", now)).status, "CURRENT");
  assert.equal((await readInventoryEvidence({ async latest() { return null; } }, "INST_MEDIATRIX", "2026-10-01", now)).snapshot, null);
  const stale = await readInventoryEvidence({ async latest() { return { ...snapshot, scheduledFor: "2026-09-30T01:00:00.000Z", capturedAt: "2026-09-30T04:00:00.000Z" }; } }, "INST_MEDIATRIX", "2026-10-01", now);
  assert.equal(stale.status, "STALE");
  const future = await readInventoryEvidence(reader, "INST_MEDIATRIX", "2026-10-01", new Date("2026-10-01T03:59:59.999Z"));
  assert.equal(future.unavailableReason, "ML_SNAPSHOT_FUTURE_CAPTURED"); assert.equal(future.snapshot, null);
  const invalid = await readInventoryEvidence({ async latest() { throw new Error("ML_SNAPSHOT_DIGEST_MISMATCH"); } }, "INST_MEDIATRIX", "2026-10-01", now);
  assert.equal(invalid.status, "UNAVAILABLE"); assert.equal(invalid.snapshot, null);
  assert.equal((await readInventoryEvidence(reader, "INST_MEDIATRIX", "2026-10-01", new Date("2026-10-01T16:00:00.000Z"))).status, "STALE");
});

test("official cookie all-role matrix, institution binding, query rejection and revocation", async () => {
  for (const roleId of ["ROLE-01", "ROLE-02", "ROLE-03", "ROLE-04", "ROLE-05", "ROLE-06"] as const) {
    const institutionId = roleId === "ROLE-03" ? "INST_SECONDARY" : roleId === "ROLE-04" ? "INST_PRC" : roleId === "ROLE-05" ? "INST_SYSTEM" : "INST_MEDIATRIX";
    const password = randomBytes(24).toString("hex"); const saltHex = randomBytes(16).toString("hex");
    const record: CredentialRecord = { userId: "USR_SYNTH_EVIDENCE", username: "synth_evidence", displayName: "Synthetic Evidence User", institutionId, institutionDisplayName: "Synthetic Evidence Institution", institutionCategory: roleId === "ROLE-04" ? "REGULATOR" : roleId === "ROLE-05" ? "SYSTEM" : "HOSPITAL", roleId, saltHex, verifierHex: await deriveVerifier(password, saltHex) };
    let active = false;
    const sessions = { async findCredential() { return record; }, async createSession() { active = true; }, async restoreSession() { return active ? record : null; }, async revokeSession() { active = false; } };
    const origin = "http://127.0.0.1:5174";
    const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: randomBytes(32).toString("hex"), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: randomBytes(24).toString("hex"), workerConfigured: false, webOrigin: origin, webCookieSecure: false }, () => now, sessions, undefined, undefined, { store: new InMemoryV2CommandStore(), mlInventory: { async latest(scope) { assert.equal(scope, institutionId); return null; } } });
    try {
      const url = "/api/v2/analytics/inventory-evidence?businessDate=2026-10-01";
      assert.equal((await app.inject({ method: "GET", url })).statusCode, 401);
      const login = await app.inject({ method: "POST", url: "/api/v1/auth/session", headers: { origin }, payload: { username: record.username, password } });
      assert.equal(login.statusCode, 200);
      const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
      const response = await app.inject({ method: "GET", url, headers: { cookie } });
      const allowed = ["ROLE-01", "ROLE-02", "ROLE-03"].includes(roleId);
      assert.equal(response.statusCode, allowed ? 200 : 403);
      if (allowed) {
        assert.equal(response.json().institutionId, institutionId);
        for (const bad of [url + "&institutionId=INST_FOREIGN", url.replace("2026-10-01", "2026-02-30")]) assert.equal((await app.inject({ method: "GET", url: bad, headers: { cookie } })).statusCode, 400);
      }
      await app.inject({ method: "DELETE", url: "/api/v1/auth/session", headers: { cookie, origin } });
      assert.equal((await app.inject({ method: "GET", url, headers: { cookie, authorization: "Bearer ignored" } })).statusCode, 401);
    } finally { await app.close(); }
  }
});
