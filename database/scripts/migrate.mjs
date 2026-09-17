import { runner as migrate } from "node-pg-migrate";
import { Client } from "pg";

import { databaseConfig } from "./database-environment.mjs";

const client = new Client(databaseConfig);
const configuredCount = process.env.BLOODLEDGER_MIGRATION_COUNT;
const count = configuredCount === undefined ? Infinity : Number(configuredCount);
if (configuredCount !== undefined && (!Number.isSafeInteger(count) || count < 1)) throw new Error("BLOODLEDGER_MIGRATION_COUNT must be a positive integer");
await client.connect();

try {
  const applied = await migrate({
    dbClient: client,
    direction: "up",
    dir: new URL("../migrations", import.meta.url).pathname,
    ignorePattern: "README\\.md",
    migrationsSchema: "public",
    migrationsTable: "pgmigrations",
    count,
    log: (message) => console.log(message)
  });
  console.log(`Migration apply complete; ${applied.length} migration(s) applied`);
} finally {
  await client.end();
}
