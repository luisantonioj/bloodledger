import { buildApp } from "./app.js";
import { readApiConfig } from "./config.js";
import { createPoolFromEnvironment, PostgresScanRepository } from "./database.js";

const config = readApiConfig();
const pool = createPoolFromEnvironment();
const app = await buildApp(new PostgresScanRepository(pool), config);

const shutdown = async (): Promise<void> => {
  await app.close();
  await pool.end();
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: config.host, port: config.port });
