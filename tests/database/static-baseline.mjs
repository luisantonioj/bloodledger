import { readFile, readdir } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [compose, bootstrap, migration, forecastMigration, coordinationMigration, scanMigration, databasePackage] = await Promise.all([
  read("compose.yaml"),
  read("database/bootstrap/001-create-development-roles.sh"),
  read("database/migrations/20260715000000000_bootstrap-app-schema.js"),
  read("database/migrations/20260812000000000_create-simulation-forecast-tables.js"),
  read("database/migrations/20260814000000000_create-synthetic-coordination-tables.js"),
  read("database/migrations/20260817000000000_create-synthetic-scan-sync-tables.js"),
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
  [forecastMigration.includes("CREATE TABLE app.forecast_runs"), "forecast run table"],
  [forecastMigration.includes("CREATE TABLE app.demand_forecasts"), "demand forecast table"],
  [forecastMigration.includes("target_name = 'requested_units'"), "requested demand target"],
  [forecastMigration.includes("classification = 'SIMULATION_ONLY'"), "simulation classification"],
  [forecastMigration.includes("DISABLED_UNAPPROVED_POLICY"), "disabled recommendation policy"],
  [forecastMigration.includes("GRANT SELECT, INSERT ON app.forecast_runs"), "run runtime grants"],
  [forecastMigration.includes("GRANT SELECT, INSERT ON app.demand_forecasts"), "forecast runtime grants"],
  [forecastMigration.includes("exports.down = false"), "forecast forward-only migration"],
  [coordinationMigration.includes("CREATE TABLE app.location_evidence"), "location evidence table"],
  [coordinationMigration.includes("CREATE TABLE app.algorithm_runs"), "algorithm run table"],
  [coordinationMigration.includes("delete_after = captured_at + interval '30 days'"), "location retention check"],
  [coordinationMigration.includes("DISABLED_UNAPPROVED_POLICY"), "algorithm approval disabled"],
  [coordinationMigration.includes("SECURITY DEFINER"), "scoped purge definer security"],
  [coordinationMigration.includes("GRANT EXECUTE ON FUNCTION app.purge_expired_synthetic_location_evidence"), "purge runtime grant"],
  [coordinationMigration.includes("exports.down = false"), "coordination forward-only migration"],
  [scanMigration.includes("CREATE TABLE app.scan_events"), "scan event table"],
  [scanMigration.includes("CREATE TABLE app.scan_event_attempts"), "scan attempt table"],
  [scanMigration.includes("CREATE TABLE app.inventory_projection"), "inventory projection table"],
  [scanMigration.includes("LEDGER_COMMITTED_PROJECTION_PENDING"), "recoverable projection status"],
  [scanMigration.includes("DISABLED_UNAPPROVED_POLICY"), "scan recommendation disabled"],
  [scanMigration.includes("GRANT UPDATE ("), "runtime column update grant"],
  [scanMigration.includes("exports.down = false"), "scan forward-only migration"],
  [databasePackage.scripts["migrate:up"] === "node scripts/migrate.mjs", "apply command"],
  [databasePackage.scripts["migrate:status"] === "node scripts/migration-status.mjs", "status command"]
];

for (const [passed, label] of assertions) {
  if (!passed) throw new Error(`Database baseline check failed: ${label}`);
}

const migrationFiles = (await readdir(new URL("database/migrations", root)))
  .filter((name) => /\.(?:js|cjs|mjs|sql)$/.test(name));
if (migrationFiles.length !== 4) {
  throw new Error(`Expected bootstrap, forecast, coordination, and scan migrations, received ${migrationFiles.length}`);
}

const prohibited = /blood_units|transfers|users|institutions|forecasts|notifications|audit_logs|sync(?:hronization)?_queues/i;
if (prohibited.test(migration)) {
  throw new Error("Bootstrap migration contains a prohibited domain table name");
}

console.log("Static PostgreSQL baseline checks passed");
