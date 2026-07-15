import { readFile, readdir } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [compose, bootstrap, migration, databasePackage] = await Promise.all([
  read("compose.yaml"),
  read("database/bootstrap/001-create-development-roles.sh"),
  read("database/migrations/20260715000000000_bootstrap-app-schema.js"),
  read("database/package.json").then(JSON.parse)
]);

const assertions = [
  [compose.includes("name: bloodledger"), "Compose project name"],
  [compose.includes("image: postgres:17.10"), "PostgreSQL image pin"],
  [compose.includes("127.0.0.1:${POSTGRES_HOST_PORT:-5432}:5432"), "loopback binding"],
  [compose.includes("postgres-data:/var/lib/postgresql/data"), "persistent volume"],
  [compose.includes("pg_isready -U postgres -d bloodledger_dev"), "health check"],
  [bootstrap.includes("CREATE ROLE bloodledger_migrator"), "migration role"],
  [bootstrap.includes("CREATE ROLE bloodledger_app"), "runtime role"],
  [migration.includes('pgm.createSchema("app"'), "app schema migration"],
  [migration.includes("GRANT USAGE ON SCHEMA app TO bloodledger_app"), "runtime usage grant"],
  [migration.includes("exports.down = false"), "forward-only migration"],
  [databasePackage.scripts["migrate:up"] === "node scripts/migrate.mjs", "apply command"],
  [databasePackage.scripts["migrate:status"] === "node scripts/migration-status.mjs", "status command"]
];

for (const [passed, label] of assertions) {
  if (!passed) throw new Error(`Database baseline check failed: ${label}`);
}

const migrationFiles = (await readdir(new URL("database/migrations", root)))
  .filter((name) => /\.(?:js|cjs|mjs|sql)$/.test(name));
if (migrationFiles.length !== 1) {
  throw new Error(`Expected one bootstrap migration, received ${migrationFiles.length}`);
}

const prohibited = /blood_units|transfers|users|institutions|forecasts|notifications|audit_logs|sync(?:hronization)?_queues/i;
if (prohibited.test(migration)) {
  throw new Error("Bootstrap migration contains a prohibited domain table name");
}

console.log("Static PostgreSQL baseline checks passed");
