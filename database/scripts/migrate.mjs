import { runner as migrate } from "node-pg-migrate";
import { Client } from "pg";

import { databaseConfig } from "./database-environment.mjs";

const client = new Client(databaseConfig);
await client.connect();

try {
  const applied = await migrate({
    dbClient: client,
    direction: "up",
    dir: new URL("../migrations", import.meta.url).pathname,
    ignorePattern: "README\\.md",
    migrationsSchema: "public",
    migrationsTable: "pgmigrations",
    count: Infinity,
    log: (message) => console.log(message)
  });
  console.log(`Migration apply complete; ${applied.length} migration(s) applied`);
} finally {
  await client.end();
}
