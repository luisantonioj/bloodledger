import assert from "node:assert/strict";
import test from "node:test";
import { StockCheckpointScheduler, requireStockCheckpointPolicy } from "../src/stock-checkpoint-scheduler.js";
import { readDohReportPolicy, DOH_CENSUS_DISPLAY_ORDER } from "../src/report-policy.js";
import { STOCK_CHECKPOINT_POLICY_VERSION, type CensusStore } from "../src/census-worker.js";
import { buildCensusSnapshot } from "../src/census.js";

test("dedicated stock scheduler refuses disabled/incomplete policy", () => {
  assert.throws(() => requireStockCheckpointPolicy(readDohReportPolicy({})), /POLICY_DISABLED/);
  assert.throws(() => requireStockCheckpointPolicy(readDohReportPolicy({ BLOODLEDGER_DOH_REPORT_POLICY_VERSION: STOCK_CHECKPOINT_POLICY_VERSION })), /POLICY_DISABLED/);
  assert.doesNotThrow(() => requireStockCheckpointPolicy(readDohReportPolicy({ BLOODLEDGER_DOH_REPORT_POLICY_VERSION: STOCK_CHECKPOINT_POLICY_VERSION, BLOODLEDGER_DOH_BLOOD_TYPE_ORDER: DOH_CENSUS_DISPLAY_ORDER.join(",") })));
});

test("dedicated scheduler records zero stock at both slots, discovers current banks, and never backfills", async () => {
  const calls: string[] = [];let banks = ["INST_SYNTH_BANK_A", "INST_SYNTH_BANK_B"];
  const store: CensusStore = {
    async capture(institutionId, scheduledFor, _trigger, now) {
      calls.push(institutionId + "@" + scheduledFor.toISOString());
      const snapshot = buildCensusSnapshot({ snapshotId: "CENSUS_SYNTH", scheduledFor: scheduledFor.toISOString(), capturedAt: now.toISOString(), reportPolicyVersion: STOCK_CHECKPOINT_POLICY_VERSION, rows: [] });
      assert.equal(snapshot.groups.length, 4);assert.equal(snapshot.groups.flatMap(group => group.bloodTypes).length, 32);
      assert(snapshot.groups.every(group => group.bloodTypes.every(row => row.reportableCount === 0)));
      return snapshot;
    },
    async get() { return null; },async copyRow() { return null; },
  };
  const scheduler = new StockCheckpointScheduler(store, async () => banks);
  assert.equal((await scheduler.runOnce(new Date("2026-10-20T01:00:00.000Z"))).snapshots, 2);
  banks = ["INST_SYNTH_BANK_B"];
  assert.equal((await scheduler.runOnce(new Date("2026-10-20T08:00:00.000Z"))).snapshots, 1);
  assert.equal(calls[2], "INST_SYNTH_BANK_B@2026-10-20T08:00:00.000Z");
  assert.equal((await scheduler.runOnce(new Date("2026-10-20T08:30:00.000Z"))).snapshots, 0);
  assert.equal(calls.length, 3);
});

test("one failed bank does not prevent another bank checkpoint", async () => {
  const store: CensusStore = { async capture(id) { if(id === "INST_SYNTH_FAIL") throw new Error("database failure");return {} as Awaited<ReturnType<CensusStore["capture"]>>; },async get() { return null; },async copyRow() { return null; } };
  const result = await new StockCheckpointScheduler(store, async () => ["INST_SYNTH_FAIL", "INST_SYNTH_OK"]).runOnce(new Date("2026-10-20T01:01:00.000Z"));
  assert.deepEqual(result, { institutions: 2, snapshots: 1, failedInstitutions: ["INST_SYNTH_FAIL"] });
});
