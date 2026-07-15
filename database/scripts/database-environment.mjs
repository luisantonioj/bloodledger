import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const environmentPath = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(environmentPath)) {
  process.loadEnvFile(environmentPath);
}

const required = [
  "POSTGRES_DB",
  "POSTGRES_MIGRATOR_USER",
  "POSTGRES_MIGRATOR_PASSWORD"
];

for (const variableName of required) {
  if (!process.env[variableName]) {
    throw new Error(`${variableName} must be set in the untracked .env file`);
  }
}

export const databaseConfig = {
  host: "127.0.0.1",
  port: Number.parseInt(process.env.POSTGRES_HOST_PORT ?? "5432", 10),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_MIGRATOR_USER,
  password: process.env.POSTGRES_MIGRATOR_PASSWORD
};

if (!Number.isInteger(databaseConfig.port) || databaseConfig.port < 1 ||
    databaseConfig.port > 65535) {
  throw new Error("POSTGRES_HOST_PORT must be a valid TCP port");
}

