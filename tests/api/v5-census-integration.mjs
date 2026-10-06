// FR-12/FR-14/BR-ALG-07: real persisted census evidence without an external model.
// Builds required: API and coordination. Uses only a disposable PostgreSQL container.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { PostgresMlInventorySnapshotStore } from '../../services/api/build/src/census-worker.js';
import { readInventoryEvidence } from '../../services/api/build/src/inventory-evidence.js';
import { createPoolFromEnvironment } from '../../services/api/build/src/database.js';

const root = resolve('.');
const work = await mkdtemp(resolve(tmpdir(), 'bloodledger-lat-census-'));
const container = 'bloodledger-lat-census-' + randomBytes(6).toString('hex');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe' });
const node = (...args) => execFileSync(process.execPath, args, { env: process.env, encoding: 'utf8', stdio: 'pipe' });
const evidence = { classification: 'SIMULATION_ONLY', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.version, database: 'postgres:17.10', ledger: 'SYNTHETIC_COMMITTED_PROJECTION_FIXTURE', migrations: 'NOT_RUN', apiDatabase: 'NOT_RUN', coordinationDatabase: 'NOT_RUN', census: 'NOT_RUN' };
let created = false, owner, pool;
let stage = 'bootstrap';
try {
  const env = { POSTGRES_USER: 'postgres', POSTGRES_DB: 'bloodledger_dev', POSTGRES_MIGRATOR_USER: 'bloodledger_migrator', POSTGRES_APP_USER: 'bloodledger_app', POSTGRES_PASSWORD: randomBytes(24).toString('hex'), POSTGRES_MIGRATOR_PASSWORD: randomBytes(24).toString('hex'), POSTGRES_APP_PASSWORD: randomBytes(24).toString('hex'), POSTGRES_HOST: '127.0.0.1' };
  const envPath = resolve(work, 'db.env');
  await writeFile(envPath, Object.entries(env).map(([key, value]) => key + '=' + value).join('\n') + '\n', { mode: 0o600 });
  docker('run', '--detach', '--name', container, '--env-file', envPath, '--publish', '127.0.0.1::5432', '-v', root + '/database/bootstrap:/docker-entrypoint-initdb.d:ro', 'postgres:17.10');
  created = true;
  const port = docker('port', container, '5432/tcp').trim().split(':').at(-1);
  Object.assign(process.env, env, { POSTGRES_PORT: port, POSTGRES_HOST_PORT: port });
  owner = new Pool({ host: env.POSTGRES_HOST, port: Number(port), database: env.POSTGRES_DB, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD });
  for (let attempt = 0; ; attempt++) {
    try { assert.equal((await owner.query("SELECT 1 FROM pg_roles WHERE rolname='bloodledger_app'")).rowCount, 1); break; }
    catch { if (attempt >= 40) throw new Error('Disposable PostgreSQL bootstrap unavailable'); await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  node('database/scripts/migrate.mjs');
  const migrationCount = Number((await owner.query('SELECT count(*) FROM public.pgmigrations')).rows[0].count);
  node('database/scripts/migrate.mjs');
  assert.equal(Number((await owner.query('SELECT count(*) FROM public.pgmigrations')).rows[0].count), migrationCount);
  node('database/scripts/migration-status.mjs');
  const privileges = await owner.query("SELECT has_table_privilege('bloodledger_app','app.ml_inventory_snapshots','SELECT,INSERT') AS read_insert, has_table_privilege('bloodledger_app','app.ml_inventory_snapshots','UPDATE') AS update, has_table_privilege('bloodledger_app','app.ml_inventory_snapshot_counts','DELETE') AS delete");
  assert.deepEqual(privileges.rows[0], { read_insert: true, update: false, delete: false });
  evidence.migrations = 'PASS: ' + migrationCount + ' forward migrations, idempotent reapply and runtime grants';
  node('services/api/test/postgres-probe.mjs');
  node('services/api/test/sprint-6-integration-probe.mjs');
  evidence.apiDatabase = 'PASS: existing API persistence and Sprint 6 probes';

  const cli = (...args) => JSON.parse(node('services/coordination/build/src/cli.js', ...args));
  const fixture = name => 'services/coordination/test/fixtures/' + name + '.json';
  const location = cli('capture-location-evidence', '--input', fixture('location'), '--persist');
  assert.equal(location.persistence, 'INSERTED');
  assert.equal(cli('capture-location-evidence', '--input', fixture('location'), '--persist').persistence, 'EXISTING');
  assert.throws(() => cli('capture-location-evidence', '--input', fixture('location-conflict'), '--persist'), error => String(error.stderr).includes('COORD_LOCATION_EVIDENCE_CONFLICT'));
  const rps = cli('rank-rps', '--input', fixture('rps'), '--persist');
  assert.equal(rps.persistence, 'INSERTED');
  assert.equal(cli('rank-rps', '--input', fixture('rps'), '--persist').persistence, 'EXISTING');
  const broa = cli('recommend-broa', '--input', fixture('broa'), '--persist');
  assert.equal(broa.persistence, 'INSERTED');
  assert.notEqual(rps.runId, broa.runId);
  const algorithms = await owner.query('SELECT recommendation_eligibility,recommendation_digest FROM app.algorithm_runs WHERE run_id=ANY($1)', [[rps.runId, broa.runId]]);
  assert.equal(algorithms.rowCount, 2);
  assert.ok(algorithms.rows.every(row => row.recommendation_eligibility === 'DISABLED_UNAPPROVED_POLICY' && row.recommendation_digest));
  assert.equal(cli('purge-expired-location-evidence', '--as-of', '2026-08-01T00:00:00.000Z').deletedCount, 1);
  assert.equal(Number((await owner.query("SELECT count(*) FROM app.location_evidence WHERE evidence_id='LOC_INTEGRATION_001'")).rows[0].count), 0);
  evidence.coordinationDatabase = 'PASS: persisted replay, conflict, disabled recommendation evidence and scoped purge';

  // Existing recovery probes intentionally leave pending commands. Census uses
  // a separate fresh database so those fixtures cannot impersonate committed stock.
  stage = 'isolated census database';
  await owner.query('CREATE DATABASE bloodledger_census_test OWNER bloodledger_migrator');
  await owner.end();
  process.env.POSTGRES_DB = 'bloodledger_census_test';
  owner = new Pool({ host: env.POSTGRES_HOST, port: Number(port), database: process.env.POSTGRES_DB, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD });
  node('database/scripts/migrate.mjs');
  stage = 'synthetic census fixture';
  await owner.query(await readFile('tests/forecasting/v4-verification-fixture.sql', 'utf8'));
  pool = createPoolFromEnvironment();
  const store = new PostgresMlInventorySnapshotStore(pool);
  const capturedAt = new Date('2026-10-07T04:00:00.123Z');
  const scheduledFor = new Date('2026-10-07T03:00:00.456Z');
  stage = 'fractional census capture';
  const captured = await store.capture('INST_MEDIATRIX', scheduledFor, 'MANUAL', capturedAt);
  stage = 'persisted census validation';
  const persisted = await store.get(captured.snapshotId, 'INST_MEDIATRIX');
  assert.equal(persisted.capturedAt, capturedAt.toISOString());
  assert.equal(persisted.scheduledFor, scheduledFor.toISOString());
  assert.equal(persisted.sourceProjectionDigest, captured.sourceProjectionDigest);
  const counts = await owner.query('SELECT * FROM app.ml_inventory_snapshot_counts WHERE snapshot_id=$1', [captured.snapshotId]);
  assert.equal(counts.rowCount, 40);
  const now = new Date('2026-10-07T05:00:00.000Z');
  const current = await readInventoryEvidence(store, 'INST_MEDIATRIX', '2026-10-07', now);
  assert.equal(current.status, 'CURRENT');
  assert.equal(current.snapshot.persistedSeries, 40);
  assert.ok(current.snapshot.groups.flatMap(group => group.bloodTypes).some(row => row.availableCount === 0));
  assert.equal((await readInventoryEvidence(store, 'INST_METRO_LIPA', '2026-10-07', now)).snapshot, null);
  assert.equal((await readInventoryEvidence(store, 'INST_MEDIATRIX', '2026-10-07', new Date('2026-10-07T03:59:59.999Z'))).unavailableReason, 'ML_SNAPSHOT_FUTURE_CAPTURED');
  assert.equal((await readInventoryEvidence(store, 'INST_MEDIATRIX', '2026-10-07', new Date('2026-10-07T16:00:00.000Z'))).status, 'STALE');
  // Prove database immutability, then inject a missing row at the read boundary
  // without disabling database guards or mutating persisted snapshot evidence.
  stage = 'missing latest row without fallback';
  const older = await store.capture('INST_MEDIATRIX', new Date('2026-10-06T03:00:00.000Z'), 'MANUAL', new Date('2026-10-06T04:00:00.000Z'));
  assert.notEqual(older.snapshotId, captured.snapshotId);
  const row = counts.rows[0];
  await assert.rejects(() => owner.query('DELETE FROM app.ml_inventory_snapshot_counts WHERE snapshot_id=$1 AND component_type=$2 AND blood_type=$3', [captured.snapshotId, row.component_type, row.blood_type]), error => error.message === 'ML_INVENTORY_SNAPSHOT_IMMUTABLE');
  const missingRowStore = new PostgresMlInventorySnapshotStore({ async query(sql, values) {
    const result = await pool.query(sql, values);
    return sql.includes('FROM app.ml_inventory_snapshot_counts') && values[0] === captured.snapshotId ? { ...result, rows: result.rows.slice(1) } : result;
  } });
  const incomplete = await readInventoryEvidence(missingRowStore, 'INST_MEDIATRIX', '2026-10-07', now);
  assert.equal(incomplete.status, 'UNAVAILABLE');
  assert.equal(incomplete.snapshot, null);
  assert.equal(incomplete.unavailableReason, 'ML_SNAPSHOT_INVALID');
  evidence.census = 'PASS: forty persisted combinations, verified zero, fractional timestamps/digest, tenant isolation, future/stale states, immutability and fault-injected missing latest row without fallback';
  console.log(JSON.stringify(evidence));
} catch (error) {
  evidence.failure = 'Database integration failed at ' + stage;
  evidence.errorCode = typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'UNKNOWN';
  evidence.failureFrame = error.stack?.split('\n').find(line => line.includes('v5-census-integration.mjs:'))?.trim();
  throw new Error(evidence.failure);
} finally {
  if (pool) await pool.end();
  if (owner) await owner.end();
  if (created) docker('rm', '--force', container);
  await writeFile(process.env.BLOODLEDGER_CENSUS_EVIDENCE_PATH ?? '/tmp/bloodledger-lat-census-evidence.json', JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  await rm(work, { recursive: true, force: true });
}
