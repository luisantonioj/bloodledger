import { buildApp } from "./app.js";
import { readApiConfig } from "./config.js";
import { createPoolFromEnvironment, PostgresScanRepository } from "./database.js";
import { PostgresSessionRepository } from "./database-session.js";
import { PostgresApplicationReadRepository } from "./database-application-read.js";

const config = readApiConfig();
const pool = createPoolFromEnvironment();
const app = await buildApp(new PostgresScanRepository(pool), config, undefined, new PostgresSessionRepository(pool), new PostgresApplicationReadRepository(pool));

const shutdown = async (): Promise<void> => {
  await app.close();
  await pool.end();
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: config.host, port: config.port });
