// TP-STOCK-01 / FR-09, FR-14: independent, read-only persisted T0 census evidence.
import { createRequire } from 'node:module';
import { readFile, stat, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { InstitutionClient } from '../../scripts/development-data/institution-client.mjs';
import { canonical } from '../../scripts/development-data/scenario.mjs';
import { EXECUTION_SCHEMA, SCENARIO_SHA256, unseal, verifyOperationalCensus, verificationWindow } from '../../scripts/development-data/stock-plan.mjs';
import { PostgresMlInventorySnapshotStore } from '../../services/api/build/src/census-worker.js';
import { validatePersistedMlCounts } from '../../services/api/build/src/inventory-evidence.js';
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
const original = await privateJson(process.env.BLOODLEDGER_STOCK_T0_REPORT_PATH);
assert.equal(original.executionSha256, manifest.manifestSha256);
assert.equal(original.t0Verification, 'PASS');
assert.ok(original.census);
const reportPath = process.env.BLOODLEDGER_STOCK_EVIDENCE_REPORT_PATH;
assert.ok(reportPath, 'Private output path is required');
const config = await privateJson(process.env.BLOODLEDGER_STOCK_CONFIG_PATH);
const pool = new Pool({ host: 'postgres', database: process.env.POSTGRES_DB, user: process.env.POSTGRES_APP_USER, password: process.env.POSTGRES_APP_PASSWORD });
const client = new InstitutionClient(config, 'http://host.docker.internal:3000');
try {
  const run = (await pool.query('SELECT manifest_sha256,writer_lock,census_snapshot_id FROM app.operational_stock_runs WHERE run_id=$1', [manifest.runId])).rows[0];
  assert.equal(run.manifest_sha256, manifest.manifestSha256);
  assert.equal(run.writer_lock, false);
  assert.equal(run.census_snapshot_id, original.census.snapshotId);
  const persisted = await new PostgresMlInventorySnapshotStore(pool).get(run.census_snapshot_id, 'INST_MEDIATRIX');
  assert.equal(canonical(persisted), canonical(original.census));
  assert.equal(persisted.scheduledFor, new Date(manifest.scenario.t0).toISOString());
  assert.ok(verificationWindow(manifest.scenario, persisted.capturedAt));
  assert.ok(Date.parse(persisted.capturedAt) <= Date.now());
  const rows = (await pool.query('SELECT component_type,blood_type,available_count,reserved_count,forecast_eligible_available_count,reportable_count FROM app.ml_inventory_snapshot_counts WHERE snapshot_id=$1 ORDER BY component_type,blood_type', [persisted.snapshotId])).rows;
  validatePersistedMlCounts(rows);
  const components = (await client.read('coordinator', '/api/v2/components')).components;
  verifyOperationalCensus(persisted, components);
  const businessDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  const evidence = await client.read('coordinator', '/api/v2/analytics/inventory-evidence?businessDate=' + businessDate);
  assert.equal(evidence.status, 'CURRENT');
  assert.equal(evidence.classification, 'SIMULATION_ONLY');
  assert.equal(evidence.recommendationEligibility, 'DISABLED_UNAPPROVED_POLICY');
  assert.equal(canonical(evidence.snapshot), canonical({ ...persisted, coverage: 'COMPLETE', expectedSeries: 40, persistedSeries: 40 }));
  const totals = rows.reduce((value, row) => ({ available: value.available + row.available_count, reserved: value.reserved + row.reserved_count,
    reportable: value.reportable + row.reportable_count, forecastEligible: value.forecastEligible + row.forecast_eligible_available_count }), { available: 0, reserved: 0, reportable: 0, forecastEligible: 0 });
  assert.deepEqual(totals, { available: 492, reserved: 37, reportable: 529, forecastEligible: 491 });
  const result = { classification: 'SIMULATION_ONLY', hostValidation: 'JOPIA_SELF_VALIDATION', source: 'INDEPENDENT_PERSISTED_T0_DATABASE_AND_AUTHENTICATED_API_READ',
    executionSha256: manifest.manifestSha256, observedAt: new Date().toISOString(), writerLock: run.writer_lock, combinations: rows.length,
    verifiedReportableZeros: rows.filter(row => row.reportable_count === 0).length, totals, snapshot: persisted, persistedRows: rows, apiStatus: evidence.status, result: 'PASS' };
  await writeFile(reportPath, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  const { snapshot, persistedRows, ...summary } = result;
  console.log(JSON.stringify({ ...summary, snapshotId: snapshot.snapshotId, scheduledFor: snapshot.scheduledFor, capturedAt: snapshot.capturedAt, sourceProjectionDigest: snapshot.sourceProjectionDigest }));
} finally {
  await client.close();
  await pool.end();
}
