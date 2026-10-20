import { randomUUID } from "node:crypto";
import { createPoolFromEnvironment, PostgresScanRepository } from "./database.js";
import { FabricGatewayInventory } from "./fabric.js";
import { ScanSyncWorker } from "./worker.js";
import { FabricGatewayInterviewCore } from "./fabric.js";
import { PostgresV2CommandStore } from "./v2-command.js";
import { PostgresV2Projector } from "./database-v2.js";
import { V2CommandWorker } from "./v2-worker.js";
import { CensusWorker, PostgresCensusStore, STOCK_CHECKPOINT_POLICY_VERSION, STOCK_CHECKPOINT_WINDOW_MS, checkpointInstitutionIds } from "./census-worker.js";
import { readDohReportPolicy } from "./report-policy.js";
import { ScheduledExpiryEvaluator } from "./expiry-evaluator.js";
import { PostgresReservationLocation } from "./reservation-location.js";

if (process.env.FABRIC_SYNC_ENABLED !== "true") {
  throw new Error("FABRIC_SYNC_ENABLED=true is required to start the Sprint 4 worker");
}

const pool = createPoolFromEnvironment();
const worker = new ScanSyncWorker(
  new PostgresScanRepository(pool),
  new FabricGatewayInventory(),
  `WORKER_${randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`,
);
const v2Worker = process.env.FABRIC_V2_SYNC_ENABLED === "true"
  ? new V2CommandWorker(new PostgresV2CommandStore(pool), { submit: (command) => new FabricGatewayInterviewCore().submit(command), project: (command, committed) => new PostgresV2Projector(pool).project(command, committed) }, `V2WORKER_${randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`)
  : null;
let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

// PA-DEF-07: 09:00/16:00 Asia/Manila stock checkpoints run only under the approved simulation report policy.
const reportPolicy = readDohReportPolicy();
const checkpoints = reportPolicy.copyModeEnabled && reportPolicy.version === STOCK_CHECKPOINT_POLICY_VERSION
  ? new PostgresCensusStore(pool, reportPolicy.version, reportPolicy.bloodTypeOrder) : null;
let nextCheckpointCheck = 0;
async function runCheckpoints(now: Date): Promise<void> {
  if (!checkpoints || now.getTime() < nextCheckpointCheck) return;
  nextCheckpointCheck = now.getTime() + 60_000;
  const recorded = await new CensusWorker(checkpoints, await checkpointInstitutionIds(pool), STOCK_CHECKPOINT_WINDOW_MS).runDueSlots(now);
  if (recorded.length) console.info(JSON.stringify({ level: "info", msg: "stock checkpoint recorded", slots: [...new Set(recorded.map((snapshot) => snapshot.scheduledFor))], institutions: recorded.length }));
}

// TC-E05: opt-in scheduled expiry evaluation; TC-G01: purge exact checkpoint points after their retention window.
const expiryEvaluator = v2Worker && process.env.V2_EXPIRY_EVALUATOR_ENABLED === "true" ? new ScheduledExpiryEvaluator(pool, new PostgresV2CommandStore(pool)) : null;
const reservationLocation = new PostgresReservationLocation(pool);
let nextPurge = 0;
async function runScheduledEvaluations(now: Date): Promise<void> {
  const queued = expiryEvaluator ? await expiryEvaluator.runDue(now) : 0;
  let purged = 0;
  if (now.getTime() >= nextPurge) { nextPurge = now.getTime() + 60_000; purged = await reservationLocation.purgeExpired(now); }
  if (queued || purged) console.info(JSON.stringify({ level: "info", msg: "scheduled evaluation", expiryCommandsQueued: queued, locationEvidencePurged: purged }));
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
while (!stopping) {
  try { await runCheckpoints(new Date()); }
  catch (error) { console.error(JSON.stringify({ level: "warn", msg: "stock checkpoint failed", safeErrorCode: error instanceof Error ? error.message.slice(0, 64) : "CHECKPOINT_FAILED" })); }
  try { await runScheduledEvaluations(new Date()); }
  catch (error) { console.error(JSON.stringify({ level: "warn", msg: "scheduled evaluation failed", safeErrorCode: error instanceof Error ? error.message.slice(0, 64) : "SCHEDULED_EVALUATION_FAILED" })); }
  try {
    const result = await worker.runOnce();
    const v2Result = v2Worker ? await v2Worker.runOnce() : { status: "IDLE" as const };
    if (result === "IDLE" && v2Result.status === "IDLE") await pause(500);
  } catch (error) {
    // TP-JOP-D14: keep polling through a database outage; a leased command is reclaimed after its lease expires.
    console.error(JSON.stringify({ level: "warn", msg: "worker iteration failed", safeErrorCode: (error as { code?: string }).code ?? "WORKER_ITERATION_FAILED" }));
    await pause(5_000);
  }
}
await pool.end();
