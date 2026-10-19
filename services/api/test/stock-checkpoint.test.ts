import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { CensusWorker, PostgresCensusStore, STOCK_CHECKPOINT_POLICY_VERSION, checkpointSlots, checkpointWindowOpen, type CensusStore } from "../src/census-worker.js";
import type { CensusSnapshot } from "../src/census.js";
import { DOH_CENSUS_DISPLAY_ORDER } from "../src/report-policy.js";

// PA-DEF-07 SYNTHETIC_STOCK_CHECKPOINT_V1: 09:00 and 16:00 Asia/Manila (01:00 and 08:00 UTC), 30-minute window.
const at = (iso: string) => new Date(iso);

test("PA-DEF-07 slots are 09:00 and 16:00 Asia/Manila on the Manila calendar day", () => {
  assert.deepEqual(checkpointSlots(at("2026-10-20T00:30:00.000Z")).map((slot) => slot.toISOString()), ["2026-10-20T01:00:00.000Z", "2026-10-20T08:00:00.000Z"]);
  // 23:30 UTC on Oct 19 is already Oct 20 in Manila.
  assert.deepEqual(checkpointSlots(at("2026-10-19T23:30:00.000Z")).map((slot) => slot.toISOString()), ["2026-10-20T01:00:00.000Z", "2026-10-20T08:00:00.000Z"]);
});

test("PA-DEF-07 the capture window opens at the slot and closes 30 minutes later", () => {
  const nine = at("2026-10-20T01:00:00.000Z");
  assert.equal(checkpointWindowOpen(nine, at("2026-10-20T00:59:59.999Z")), false);
  assert.equal(checkpointWindowOpen(nine, nine), true);
  assert.equal(checkpointWindowOpen(nine, at("2026-10-20T01:29:59.999Z")), true);
  assert.equal(checkpointWindowOpen(nine, at("2026-10-20T01:30:00.000Z")), false);
  // A time that is not a checkpoint slot is never open.
  assert.equal(checkpointWindowOpen(at("2026-10-20T01:05:00.000Z"), at("2026-10-20T01:10:00.000Z")), false);
});

function recordingStore(): CensusStore & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async capture(institutionId, scheduledFor) { calls.push(`${institutionId}@${scheduledFor.toISOString()}`); return { scheduledFor: scheduledFor.toISOString() } as CensusSnapshot; },
    async get() { return null; },
    async copyRow() { return null; },
  };
}

test("PA-DEF-07 the windowed scheduler records only an open slot and never backfills a missed one", async () => {
  const store = recordingStore();
  const worker = new CensusWorker(store, ["INST_MEDIATRIX", "INST_SYNTH_MEDIX"], 30 * 60_000);
  assert.equal((await worker.runDueSlots(at("2026-10-20T01:10:00.000Z"))).length, 2);
  assert.deepEqual(store.calls, ["INST_MEDIATRIX@2026-10-20T01:00:00.000Z", "INST_SYNTH_MEDIX@2026-10-20T01:00:00.000Z"]);
  // 12:00 Manila: the 09:00 window has closed and 16:00 has not opened.
  store.calls.length = 0;
  assert.equal((await worker.runDueSlots(at("2026-10-20T04:00:00.000Z"))).length, 0);
  // 16:40 Manila: 16:00 was missed; nothing is recorded late.
  assert.equal((await worker.runDueSlots(at("2026-10-20T08:40:00.000Z"))).length, 0);
  assert.deepEqual(store.calls, []);
});

test("PA-DEF-07 the store refuses a closed or non-slot time before touching the database", async () => {
  const pool = { connect: () => { throw new Error("database must not be reached"); } } as unknown as Pool;
  const store = new PostgresCensusStore(pool, STOCK_CHECKPOINT_POLICY_VERSION, DOH_CENSUS_DISPLAY_ORDER);
  await assert.rejects(store.capture("INST_MEDIATRIX", at("2026-10-19T01:00:00.000Z"), "MANUAL", at("2026-10-20T01:10:00.000Z")), /CHECKPOINT_WINDOW_CLOSED/);
  await assert.rejects(store.capture("INST_MEDIATRIX", at("2026-10-20T01:15:00.000Z"), "MANUAL", at("2026-10-20T01:16:00.000Z")), /CHECKPOINT_WINDOW_CLOSED/);
  // An open window passes the policy check and reaches the database.
  await assert.rejects(store.capture("INST_MEDIATRIX", at("2026-10-20T01:00:00.000Z"), "SCHEDULED", at("2026-10-20T01:05:00.000Z")), /database must not be reached/);
});
