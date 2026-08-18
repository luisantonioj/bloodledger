import { randomUUID } from "node:crypto";
import { createPoolFromEnvironment, PostgresScanRepository } from "./database.js";
import { FabricGatewayInventory } from "./fabric.js";
import { ScanSyncWorker } from "./worker.js";

if (process.env.FABRIC_SYNC_ENABLED !== "true") {
  throw new Error("FABRIC_SYNC_ENABLED=true is required to start the Sprint 4 worker");
}

const pool = createPoolFromEnvironment();
const worker = new ScanSyncWorker(
  new PostgresScanRepository(pool),
  new FabricGatewayInventory(),
  `WORKER_${randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`,
);
let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

while (!stopping) {
  const result = await worker.runOnce();
  if (result === "IDLE") await new Promise((resolve) => setTimeout(resolve, 500));
}
await pool.end();
