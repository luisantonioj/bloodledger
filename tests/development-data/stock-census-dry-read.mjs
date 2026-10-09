// TP-STOCK-01 / FR-09, FR-14: current-time census dry read; no persisted snapshot.
import { createRequire } from 'node:module';
import { readFile, stat, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { InstitutionClient } from '../../scripts/development-data/institution-client.mjs';
import { EXECUTION_SCHEMA, SCENARIO_SHA256, unseal, verifyOperationalCensus } from '../../scripts/development-data/stock-plan.mjs';
import { buildCensusSnapshot, V2_1_COMPONENT_TYPES } from '../../services/api/build/src/census.js';
import { INTERNAL_ML_SNAPSHOT_POLICY_VERSION } from '../../services/api/build/src/census-worker.js';
const { Pool } = createRequire(process.env.BLOODLEDGER_REPOSITORY_ROOT + '/package.json')('pg');
async function privateJson(path) {
  assert.ok(path, 'Private input path is required');
  assert.equal((await stat(path)).mode & 0o077, 0, 'Private input permissions are required');
  return JSON.parse(await readFile(path, 'utf8'));
}
const manifest = await privateJson(process.env.BLOODLEDGER_STOCK_EXECUTION_PATH);
unseal(manifest, process.env.BLOODLEDGER_STOCK_EXECUTION_SHA256);
assert.equal(manifest.schemaVersion, EXECUTION_SCHEMA);
assert.equal(manifest.scenarioSha256, SCENARIO_SHA256);
const config = await privateJson(process.env.BLOODLEDGER_STOCK_CONFIG_PATH);
const reportPath = process.env.BLOODLEDGER_STOCK_EVIDENCE_REPORT_PATH;
assert.ok(reportPath, 'Private report path is required');
const pool = new Pool({ host: 'postgres', database: process.env.POSTGRES_DB, user: process.env.POSTGRES_APP_USER, password: process.env.POSTGRES_APP_PASSWORD });
const client = new InstitutionClient(config, 'http://host.docker.internal:3000');
let database;
try {
  database = await pool.connect();
  await database.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const capturedAt = new Date().toISOString();
  const rows = await database.query(`SELECT component_type,blood_type,inventory_status,COUNT(*)::int AS count,COUNT(*) FILTER (WHERE expires_at > $2)::int AS forecast_eligible_count FROM app.v2_components WHERE institution_id=$1 AND inventory_status IN ('AVAILABLE','RESERVED') GROUP BY component_type,blood_type,inventory_status`, ['INST_MEDIATRIX', capturedAt]);
  const census = buildCensusSnapshot({ snapshotId: 'DRY_READ_ONLY', scheduledFor: capturedAt, capturedAt, reportPolicyVersion: INTERNAL_ML_SNAPSHOT_POLICY_VERSION,
    componentTypes: V2_1_COMPONENT_TYPES, rows: rows.rows.map(row => ({ componentType: row.component_type, bloodType: row.blood_type, inventoryStatus: row.inventory_status, count: Number(row.count), forecastEligibleCount: Number(row.forecast_eligible_count) })) });
  const components = (await client.read('coordinator', '/api/v2/components')).components;
  verifyOperationalCensus(census, components);
  const counts = census.groups.flatMap(group => group.bloodTypes);
  const totals = counts.reduce((value, row) => ({ available: value.available + row.availableCount, reserved: value.reserved + row.reservedCount,
    reportable: value.reportable + row.reportableCount, forecastEligible: value.forecastEligible + row.forecastEligibleAvailableCount }), { available: 0, reserved: 0, reportable: 0, forecastEligible: 0 });
  assert.deepEqual(totals, { available: 492, reserved: 37, reportable: 529, forecastEligible: 491 });
  await database.query('COMMIT');
  const result = { classification: 'SIMULATION_ONLY', hostValidation: 'JOPIA_SELF_VALIDATION', mode: 'CURRENT_TIME_DRY_READ', persisted: false,
    t0Verification: 'NOT_ESTABLISHED_BY_DRY_READ', executionSha256: manifest.manifestSha256, observedAt: capturedAt, operationalComponents: components.length,
    combinations: counts.length, verifiedZeroCombinations: counts.filter(row => row.reportableCount === 0).length, totals, groups: census.groups, result: 'PASS' };
  await writeFile(reportPath, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  const { groups, ...summary } = result;
  console.log(JSON.stringify(summary));
} finally {
  database?.release();
  await client.close();
  await pool.end();
}
