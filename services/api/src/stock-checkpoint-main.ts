import { writeFile } from "node:fs/promises";
import { setTimeout as pause } from "node:timers/promises";
import { createPoolFromEnvironment } from "./database.js";
import { PostgresCensusStore, checkpointInstitutionIds } from "./census-worker.js";
import { readDohReportPolicy } from "./report-policy.js";
import { StockCheckpointScheduler, requireStockCheckpointPolicy } from "./stock-checkpoint-scheduler.js";

// Dedicated PA-DEF-07 worker: no Fabric client, command processing, forecasts or expiry evaluation.
const policy = readDohReportPolicy();
requireStockCheckpointPolicy(policy);
const pool = createPoolFromEnvironment();
const scheduler = new StockCheckpointScheduler(new PostgresCensusStore(pool, policy.version, policy.bloodTypeOrder), () => checkpointInstitutionIds(pool));
const stop = new AbortController();
process.on("SIGTERM", () => stop.abort());
process.on("SIGINT", () => stop.abort());
console.info(JSON.stringify({ msg: "stock checkpoint scheduler started", policyVersion: policy.version, timeZone: "Asia/Manila", hours: [9, 16] }));
try {
  while (!stop.signal.aborted) {
    const now = new Date();
    try {
      const result = await scheduler.runOnce(now);
      await writeFile("/tmp/bloodledger-stock-checkpoint-health.json", JSON.stringify({ checkedAt: now.toISOString(), healthy: result.failedInstitutions.length === 0, ...result }));
      if (result.snapshots || result.failedInstitutions.length) console.info(JSON.stringify({ msg: "stock checkpoint tick", ...result }));
    } catch {
      await writeFile("/tmp/bloodledger-stock-checkpoint-health.json", JSON.stringify({ checkedAt: now.toISOString(), healthy: false }));
      console.error(JSON.stringify({ msg: "stock checkpoint tick failed", safeErrorCode: "STOCK_CHECKPOINT_UNAVAILABLE" }));
    }
    try { await pause(60_000, undefined, { signal: stop.signal }); } catch { if (!stop.signal.aborted) throw new Error("STOCK_CHECKPOINT_TIMER_FAILED"); }
  }
} finally { await pool.end(); }
