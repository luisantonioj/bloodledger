import { PostgresOperatorVerification } from "./operator-verification.js";
import { PostgresDevelopmentReader } from "./development-read.js";
import { buildApp } from "./app.js";
import { readApiConfig } from "./config.js";
import { createPoolFromEnvironment, PostgresScanRepository } from "./database.js";
import { PostgresSessionRepository } from "./database-session.js";
import { PostgresApplicationReadRepository } from "./database-application-read.js";
import { PostgresApplicationWriteRepository } from "./database-application-write.js";
import { FabricGatewayTransfer } from "./fabric.js";
import { PostgresV2CommandStore } from "./v2-command.js";
import { keyringFromEnvironment } from "./donation-crypto.js";
import { PostgresCensusStore, PostgresMlInventorySnapshotStore } from "./census-worker.js";
import { PostgresV2ProjectionReader } from "./database-v2.js";
import { readDohReportPolicy } from "./report-policy.js";

const config = readApiConfig();
const pool = createPoolFromEnvironment();
let donationKeyring;
try { donationKeyring = keyringFromEnvironment(); } catch { donationKeyring = undefined; }
const reportPolicy = readDohReportPolicy();
const census = new PostgresCensusStore(pool, reportPolicy.version, reportPolicy.copyModeEnabled ? reportPolicy.bloodTypeOrder : undefined);
const enabledIssuerInstitutionIds = (process.env.BLOODLEDGER_INBOUND_ENABLED_ISSUERS ?? "INST_MEDIATRIX,INST_SYNTH_MEDIX,INST_SYNTH_NLVILLA").split(",").map((value) => value.trim()).filter((value) => /^INST_[A-Z0-9_-]{1,59}$/.test(value));
const app = await buildApp(new PostgresScanRepository(pool), config, undefined, new PostgresSessionRepository(pool), new PostgresApplicationReadRepository(pool), new PostgresApplicationWriteRepository(pool, new FabricGatewayTransfer()), { store: new PostgresV2CommandStore(pool), developmentRead: new PostgresDevelopmentReader(pool), keyring: donationKeyring, census, mlInventory: new PostgresMlInventorySnapshotStore(pool), projection: new PostgresV2ProjectionReader(pool), enabledIssuerInstitutionIds }, new PostgresOperatorVerification(pool));

// Off-chain retention only; payload access is redacted immediately at its expiry.
const retentionTick=async()=>{try{await pool.query("SELECT app.purge_closed_synthetic_onboarding(CURRENT_TIMESTAMP)");}catch{app.log.error({code:"ONB_RETENTION_UNAVAILABLE"},"Synthetic onboarding retention is unavailable");}};
await retentionTick();
const retentionTimer=setInterval(()=>void retentionTick(),3_600_000);retentionTimer.unref();
const shutdown = async (): Promise<void> => {
  clearInterval(retentionTimer);
  await app.close();
  await pool.end();
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: config.host, port: config.port });
