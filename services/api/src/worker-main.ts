import { randomUUID } from "node:crypto";
import { createPoolFromEnvironment, PostgresScanRepository } from "./database.js";
import { FabricGatewayInventory } from "./fabric.js";
import { ScanSyncWorker } from "./worker.js";
import { FabricGatewayInterviewCore } from "./fabric.js";
import { PostgresV2CommandStore } from "./v2-command.js";
import { PostgresV2Projector } from "./database-v2.js";
import { V2CommandWorker } from "./v2-worker.js";

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

while (!stopping) {
  const result = await worker.runOnce();
  const v2Result = v2Worker ? await v2Worker.runOnce() : { status: "IDLE" as const };
  if (result === "IDLE" && v2Result.status === "IDLE") await new Promise((resolve) => setTimeout(resolve, 500));
}
await pool.end();
