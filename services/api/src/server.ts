import { buildApp } from "./app.js";
import { readApiConfig } from "./config.js";
import { createPoolFromEnvironment, PostgresScanRepository } from "./database.js";
import { PostgresSessionRepository } from "./database-session.js";
import { PostgresApplicationReadRepository } from "./database-application-read.js";
import { PostgresApplicationWriteRepository } from "./database-application-write.js";
import { FabricGatewayTransfer } from "./fabric.js";
import { PostgresV2CommandStore } from "./v2-command.js";
import { keyringFromEnvironment } from "./donation-crypto.js";
import { PostgresCensusStore } from "./census-worker.js";
import { V2_BLOOD_TYPES, type V2BloodType } from "./census.js";
import { PostgresV2ProjectionReader } from "./database-v2.js";

const config = readApiConfig();
const pool = createPoolFromEnvironment();
let donationKeyring;
try { donationKeyring = keyringFromEnvironment(); } catch { donationKeyring = undefined; }
const configuredBloodOrder = process.env.BLOODLEDGER_DOH_BLOOD_TYPE_ORDER?.split(",").map((value) => value.trim()).filter(Boolean) as V2BloodType[] | undefined;
const census = new PostgresCensusStore(pool, process.env.BLOODLEDGER_DOH_REPORT_POLICY_VERSION ?? "INTERVIEW_REPORT_PENDING", configuredBloodOrder && configuredBloodOrder.length === V2_BLOOD_TYPES.length ? configuredBloodOrder : undefined);
const enabledIssuerInstitutionIds = (process.env.BLOODLEDGER_INBOUND_ENABLED_ISSUERS ?? "INST_MEDIATRIX").split(",").map((value) => value.trim()).filter((value) => /^INST_[A-Z0-9_-]{1,59}$/.test(value));
const app = await buildApp(new PostgresScanRepository(pool), config, undefined, new PostgresSessionRepository(pool), new PostgresApplicationReadRepository(pool), new PostgresApplicationWriteRepository(pool, new FabricGatewayTransfer()), { store: new PostgresV2CommandStore(pool), keyring: donationKeyring, census, projection: new PostgresV2ProjectionReader(pool), enabledIssuerInstitutionIds });

const shutdown = async (): Promise<void> => {
  await app.close();
  await pool.end();
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: config.host, port: config.port });
