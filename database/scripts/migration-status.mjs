import { readdir } from "node:fs/promises";
import { Client } from "pg";

import { databaseConfig } from "./database-environment.mjs";

const migrationsDirectory = new URL("../migrations", import.meta.url);
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((name) => /^\d+[-_].+\.(?:js|cjs|mjs)$/.test(name))
  .sort();

const client = new Client(databaseConfig);
await client.connect();

try {
  const tableResult = await client.query(
    "SELECT to_regclass('public.pgmigrations') IS NOT NULL AS exists"
  );
  if (!tableResult.rows[0].exists) {
    console.log("Migration history: public.pgmigrations does not exist");
    for (const name of migrationFiles) {
      console.log(`PENDING ${name}`);
    }
    process.exitCode = migrationFiles.length === 0 ? 0 : 1;
  } else {
    const history = await client.query(
      "SELECT name, run_on FROM public.pgmigrations ORDER BY run_on, id"
    );
    const appliedNames = new Set(history.rows.map(({ name }) => name));
    for (const { name, run_on: runOn } of history.rows) {
      console.log(`APPLIED ${name} ${runOn.toISOString()}`);
    }
    const pending = migrationFiles.filter((name) =>
      !appliedNames.has(name.replace(/\.(?:js|cjs|mjs)$/, ""))
    );
    for (const name of pending) {
      console.log(`PENDING ${name}`);
    }
    console.log(`Migration status: ${history.rowCount} applied, ${pending.length} pending`);
    process.exitCode = pending.length === 0 ? 0 : 1;
  }
} finally {
  await client.end();
}

