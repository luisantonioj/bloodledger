// FR-12 / FR-14 / BR-ALG-07: real producer -> isolated DB -> official cookie -> Chromium.
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { chromium } from '@playwright/test';
import { buildApp } from '../../services/api/build/src/app.js';
import { createPoolFromEnvironment, PostgresScanRepository } from '../../services/api/build/src/database.js';
import { PostgresSessionRepository } from '../../services/api/build/src/database-session.js';
import { PostgresApplicationReadRepository } from '../../services/api/build/src/database-application-read.js';
import { PostgresV2CommandStore } from '../../services/api/build/src/v2-command.js';
import { PostgresMlInventorySnapshotStore } from '../../services/api/build/src/census-worker.js';
import { provisionSyntheticAccount } from '../../services/api/build/src/synthetic-account.js';

const modelPath = process.env.BLOODLEDGER_V5_MODEL_TEST_PATH;
async function blocked(reason) {
  const evidence = { classification: 'SIMULATION_ONLY', cookieFlow: 'BLOCKED', v5Success: 'BLOCKED', reason };
  console.log(JSON.stringify(evidence));
  await writeFile(process.env.BLOODLEDGER_BROWSER_EVIDENCE_PATH ?? '/tmp/bloodledger-pr21-cookie-evidence.json', JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  process.exit(2);
}
if (!modelPath) await blocked('External pinned model path required');
let modelBytes;
try { modelBytes = await readFile(modelPath); }
catch (error) {
  if (['ENOENT', 'EACCES'].includes(error.code)) await blocked('External pinned model unavailable');
  throw error;
}
assert.equal(createHash('sha256').update(modelBytes).digest('hex'), '1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764');
const forecastingImage = 'sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1';
try { execFileSync('docker', ['info'], { stdio: 'pipe' }); }
catch { await blocked('Docker runtime unavailable'); }
for (const image of [forecastingImage, 'postgres:17.10']) {
  try { execFileSync('docker', ['image', 'inspect', image], { stdio: 'pipe' }); }
  catch { await blocked(image === forecastingImage ? 'Pinned forecasting image unavailable' : 'PostgreSQL image unavailable'); }
}
try { const preflightBrowser = await chromium.launch({ headless: true }); await preflightBrowser.close(); }
catch { await blocked('Pinned Chromium runtime unavailable'); }
const root = resolve('.');
const work = await mkdtemp(resolve(tmpdir(), 'bloodledger-pr21-'));
const container = 'bloodledger-pr21-' + randomBytes(6).toString('hex');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const evidence = { classification: 'SIMULATION_ONLY', interception: false, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.version, database: 'postgres:17.10', browser: null, forecastingImage, businessDate: null, cookieFlow: 'NOT_RUN', v5Success: 'NOT_RUN', census: 'NOT_RUN', isolation: 'NOT_RUN', failureTransitions: 'NOT_RUN', humanUat: 'NOT_RUN', binding: 'DISPOSABLE_TEST_ONLY', ledger: 'SYNTHETIC_COMMITTED_PROJECTION_FIXTURE' };
let created = false, app, pool, owner, browser;
try {
  const dbEnv = { POSTGRES_USER: 'postgres', POSTGRES_DB: 'bloodledger_dev', POSTGRES_MIGRATOR_USER: 'bloodledger_migrator', POSTGRES_APP_USER: 'bloodledger_app', POSTGRES_PASSWORD: randomBytes(24).toString('hex'), POSTGRES_MIGRATOR_PASSWORD: randomBytes(24).toString('hex'), POSTGRES_APP_PASSWORD: randomBytes(24).toString('hex'), POSTGRES_HOST: '127.0.0.1' };
  const envPath = resolve(work, 'db.env');
  await writeFile(envPath, Object.entries(dbEnv).map(([k, v]) => k + '=' + v).join('\n') + '\n', { mode: 0o600 });
  docker('run', '--detach', '--name', container, '--env-file', envPath, '--publish', '127.0.0.1::5432', '-v', root + '/database/bootstrap:/docker-entrypoint-initdb.d:ro', 'postgres:17.10'); created = true;
  const port = docker('port', container, '5432/tcp').trim().split(':').at(-1);
  Object.assign(process.env, dbEnv, { POSTGRES_PORT: port, POSTGRES_HOST_PORT: port });
  owner = new Pool({ host: '127.0.0.1', port: Number(port), database: dbEnv.POSTGRES_DB, user: 'postgres', password: dbEnv.POSTGRES_PASSWORD });
  for (let attempt = 0; ; attempt++) {
    try { const ready = await owner.query("SELECT 1 FROM pg_roles WHERE rolname='bloodledger_app'"); if (!ready.rowCount) throw new Error('bootstrap pending'); break; }
    catch { if (attempt >= 40) throw new Error('Disposable database bootstrap unavailable'); await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  execFileSync(process.execPath, ['database/scripts/migrate.mjs'], { env: process.env, stdio: 'pipe' });
  await owner.query(await readFile('tests/forecasting/v4-verification-fixture.sql', 'utf8'));
  // Wall clock is used by default; historical dates use a test-only injected instant.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const businessDate = process.env.BLOODLEDGER_BROWSER_BUSINESS_DATE ?? today;
  assert.match(businessDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(businessDate).toISOString().slice(0, 10), businessDate);
  let clock = businessDate === today ? new Date() : new Date(businessDate + 'T04:00:00.000Z');
  const originDate = new Date(businessDate + 'T00:00:00.000Z'); originDate.setUTCDate(originDate.getUTCDate() - 1);
  const origin = originDate.toISOString().slice(0, 10);
  evidence.businessDate = businessDate;
  await owner.query("UPDATE app.v2_components SET expires_at=$1 WHERE component_id LIKE 'COMP_VERIFY_%'", [new Date(clock.getTime() + 86400000 * 30)]);
  const binding = { schemaVersion: 'SYNTHETIC_V5_INSTITUTION_BINDING_V1', bindingId: 'V5_BIND_COOKIE_ISOLATED', researchInstitutionId: 'SIM_INSTITUTION_01', institutionId: 'INST_MEDIATRIX', modelSha256: 'ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86', enabled: true };
  await writeFile(resolve(work, 'binding.json'), JSON.stringify(binding), { mode: 0o600 });
  const canonical = Object.fromEntries(Object.keys(binding).sort().map(key => [key, binding[key]]));
  const hash = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  const producer = (id, model, generatedAt) => docker('run', '--rm', '--network', 'container:' + container, '--env-file', envPath, '-e', 'POSTGRES_PORT=5432', '-e', 'BLOODLEDGER_V5_APPROVED_BINDING_SHA256=' + hash, '--user', `${process.getuid()}:${process.getgid()}`, '-v', root + '/services/forecasting:/workspace/repository:ro', '-v', work + ':/workspace/tmp', '-v', resolve(modelPath) + ':/workspace/model.json:ro', '-w', '/workspace/repository', '-e', 'PYTHONPATH=src', '--entrypoint', 'python', evidence.forecastingImage, '-m', 'bloodledger_forecasting.runtime_v5_cli', '--model', model, '--binding', '/workspace/tmp/binding.json', '--institution-id', 'INST_MEDIATRIX', '--request-id', id, '--origin-date', origin, '--generated-at', generatedAt, '--output', '/workspace/tmp/' + id + '.json', '--persist');
  producer('V5_REQ_COOKIE_SUCCESS', '/workspace/model.json', origin + 'T12:00:00.000Z');
  pool = createPoolFromEnvironment();
  const snapshots = new PostgresMlInventorySnapshotStore(pool);
  const captured = await snapshots.capture('INST_MEDIATRIX', clock, 'MANUAL', clock);
  const persistedSnapshot = await snapshots.get(captured.snapshotId, 'INST_MEDIATRIX');
  assert.equal(persistedSnapshot.capturedAt, captured.capturedAt);
  assert.equal(persistedSnapshot.scheduledFor, captured.scheduledFor);
  assert.equal(persistedSnapshot.sourceProjectionDigest, captured.sourceProjectionDigest);
  const password = randomBytes(24).toString('hex');
  await provisionSyntheticAccount(owner, { institutionId: 'INST_MEDIATRIX', institutionDisplayName: 'Synthetic Mediatrix Verification', institutionCategory: 'HOSPITAL', userId: 'USR_SYNTH_COOKIE', username: 'synth_cookie_probe', userDisplayName: 'Synthetic Cookie Probe', roleId: 'ROLE-01', password });
  const otherPassword = randomBytes(24).toString('hex');
  await provisionSyntheticAccount(owner, { institutionId: 'INST_METRO_LIPA', institutionDisplayName: 'Synthetic Destination Verification', institutionCategory: 'HOSPITAL', userId: 'USR_SYNTH_COOKIE_OTHER', username: 'synth_cookie_other', userDisplayName: 'Synthetic Cookie Other', roleId: 'ROLE-03', password: otherPassword });
  const repository = new PostgresScanRepository(pool);
  const config = { host: '127.0.0.1', port: 0, jwtSecret: randomBytes(32).toString('hex'), operatorId: 'USR_SYNTH_VERIFY', operatorCredential: randomBytes(24).toString('hex'), workerConfigured: false, webCookieSecure: false, webDist: resolve('apps/web/dist'), activeForecastDatasetVersion: 'SYNTHETIC_FORECAST_V4_RUNTIME_V1' };
  app = await buildApp(repository, config, () => clock, new PostgresSessionRepository(pool), new PostgresApplicationReadRepository(pool), undefined, { store: new PostgresV2CommandStore(pool), mlInventory: snapshots });
  const baseURL = await app.listen({ host: '127.0.0.1', port: 0 });
  config.webOrigin = baseURL;
  // Recreate with the allocated loopback origin for the official same-origin login check.
  await app.close();
  config.webOrigin = baseURL;
  app = await buildApp(repository, config, () => clock, new PostgresSessionRepository(pool), new PostgresApplicationReadRepository(pool), undefined, { store: new PostgresV2CommandStore(pool), mlInventory: snapshots });
  await app.listen({ host: '127.0.0.1', port: Number(new URL(baseURL).port) });
  browser = await chromium.launch({ headless: true }); evidence.browser = browser.version();
  const context = await browser.newContext(); const page = await context.newPage();
  const forecastPath = '/api/v1/demand-forecasts?businessDate=' + businessDate + '&datasetVersion=SYNTHETIC_FORECAST_V5_RUNTIME_V1';
  assert.equal((await context.request.get(baseURL + forecastPath)).status(), 401);
  await page.goto(baseURL + '/analytics');
  await page.getByLabel('Username').fill('synth_cookie_probe');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  assert.ok((await context.cookies()).some(cookie => cookie.name === 'bloodledger_session' && cookie.httpOnly));
  await page.getByLabel('Business date').fill(businessDate);
  // Default remains V4 even when V5 records are available.
  assert.equal(await page.getByLabel('Forecast version').inputValue(), 'SYNTHETIC_FORECAST_V4_RUNTIME_V1');
  assert.equal((await (await context.request.get(baseURL + '/api/v1/demand-forecasts?businessDate=' + businessDate)).json()).datasetVersion, 'SYNTHETIC_FORECAST_V4_RUNTIME_V1');
  await page.getByLabel('Forecast version').selectOption('SYNTHETIC_FORECAST_V5_RUNTIME_V1');
  await page.locator('.forecast-table tbody tr').nth(19).waitFor();
  assert.equal(await page.locator('.forecast-table tbody tr').count(), 20);
  const response = await context.request.get(baseURL + forecastPath); assert.equal(response.status(), 200);
  const body = await response.json(); assert.equal(body.status, 'CURRENT'); assert.equal(body.forecasts.length, 20);
  assert.ok(body.forecasts.every(item => item.lowerForecast === null && item.upperForecast === null));
  const produced = JSON.parse(await readFile(resolve(work, 'V5_REQ_COOKIE_SUCCESS.json'), 'utf8'));
  assert.equal(body.runId, produced.run.runId);
  assert.deepEqual(body.forecasts.map(item => [item.bloodType, item.component]).sort(), produced.forecasts.map(item => [item.bloodType, item.component]).sort());
  // PostgreSQL's authoritative numeric(12,6) column rounds saved means.
  for (const item of body.forecasts) {
    const expected = produced.forecasts.find(row => row.bloodType === item.bloodType && row.component === item.component);
    assert.ok(Math.abs(item.pointForecast - expected.pointForecast) <= 0.00000051);
  }
  evidence.cookieFlow = 'PASS'; evidence.v5Success = 'PASS: twenty real rendered series';
  const inventoryResponse = await context.request.get(baseURL + '/api/v2/analytics/inventory-evidence?businessDate=' + businessDate);
  const inventoryBody = await inventoryResponse.json();
  evidence.inventoryHttp = { status: inventoryResponse.status(), evidenceStatus: inventoryBody.status, reason: inventoryBody.unavailableReason, coverage: inventoryBody.snapshot?.coverage, series: inventoryBody.snapshot?.groups.flatMap(group => group.bloodTypes).length };
  assert.equal(inventoryBody.status, 'CURRENT');
  await page.getByText('Current synthetic inventory evidence', { exact: true }).waitFor();
  assert.equal(await page.locator('.inventory-evidence tbody tr').count(), 40);
  assert.ok(await page.getByText('0 (verified)', { exact: true }).count() > 0);
  evidence.cookieFlow = 'PASS'; evidence.v5Success = 'PASS: twenty real rendered series'; evidence.census = 'PASS: complete forty persisted series and verified zeros';
  assert.equal((await context.request.get(baseURL + '/api/v2/analytics/inventory-evidence?businessDate=' + businessDate + '&institutionId=INST_METRO_LIPA')).status(), 400);
  const other = await browser.newContext();
  assert.equal((await other.request.post(baseURL + '/api/v1/auth/session', { headers: { origin: baseURL }, data: { username: 'synth_cookie_other', password: otherPassword } })).status(), 200);
  const foreignForecast = await (await other.request.get(baseURL + forecastPath)).json(); assert.equal(foreignForecast.status, 'UNAVAILABLE'); assert.equal(foreignForecast.forecasts.length, 0);
  const foreignInventory = await (await other.request.get(baseURL + '/api/v2/analytics/inventory-evidence?businessDate=' + businessDate)).json(); assert.equal(foreignInventory.institutionId, 'INST_METRO_LIPA'); assert.equal(foreignInventory.snapshot, null);
  await other.close(); evidence.isolation = 'PASS';
  // Run the standalone live probe against this same real, isolated server.
  const credentialPath = resolve(work, 'web-credential.json');
  await writeFile(credentialPath, JSON.stringify({ username: 'synth_cookie_probe', password }), { mode: 0o600 });
  const runLiveProbe = async () => {
    const path = resolve(work, 'live-evidence.json');
    await promisify(execFile)(process.execPath, ['tests/frontend/v5-live-browser.mjs'], { env: { ...process.env, BLOODLEDGER_BROWSER_BASE_URL: baseURL, BLOODLEDGER_BROWSER_BUSINESS_DATE: businessDate, BLOODLEDGER_BROWSER_CREDENTIAL_PATH: credentialPath, BLOODLEDGER_BROWSER_EVIDENCE_PATH: path }, timeout: 120000 });
    return JSON.parse(await readFile(path, 'utf8'));
  };
  assert.match((await runLiveProbe()).v5Success, /^PASS:/);
  evidence.liveProbe = 'PASS: authenticated twenty-series HTTP and browser assertions';
  producer('V5_REQ_COOKIE_UNAVAILABLE', '/workspace/tmp/missing-model.json', new Date(clock.getTime() - 1000).toISOString());
  await page.getByRole('button', { name: 'Refresh forecast' }).click();
  await page.getByText('Forecast unavailable', { exact: true }).waitFor(); assert.equal(await page.locator('.forecast-table tbody tr').count(), 0);
  await page.getByText('Current synthetic inventory evidence', { exact: true }).waitFor();
  assert.equal((await runLiveProbe()).v5Success, 'BLOCKED: selected runtime evidence unavailable');
  evidence.liveProbe += '; unavailable latest stays BLOCKED';
  clock = new Date(businessDate + 'T16:00:00.000Z');
  assert.equal((await context.request.post(baseURL + '/api/v1/auth/session', { headers: { origin: baseURL }, data: { username: 'synth_cookie_probe', password } })).status(), 200);
  await page.getByRole('button', { name: 'Refresh forecast' }).click();
  await page.getByText('Stale inventory evidence — historical counts only', { exact: true }).waitFor();
  const logout = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/session') && response.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  assert.equal((await logout).status(), 204);
  await page.getByLabel('Username').waitFor();
  assert.equal(await page.locator('.inventory-evidence').count(), 0);
  assert.equal((await context.request.get(baseURL + forecastPath)).status(), 401);
  assert.equal((await context.request.get(baseURL + '/api/v2/analytics/inventory-evidence?businessDate=' + businessDate)).status(), 401);
  await context.close(); evidence.failureTransitions = 'PASS: unavailable latest clears forecast, inventory independent, midnight stale, logout denied';
  console.log(JSON.stringify(evidence));
} catch (error) {
  evidence.failure = 'Integration assertion failed; inspect safe command diagnostics';
  // Child process stderr can contain connection configuration; keep it out of evidence.
  throw new Error(error instanceof assert.AssertionError ? 'Integration assertion failed' : error instanceof Error ? error.message.split('\n')[0] : 'Integration failed');
} finally {
  if (browser) await browser.close(); if (app) await app.close(); if (pool) await pool.end(); if (owner) await owner.end();
  if (created) docker('rm', '--force', container);
  await writeFile(process.env.BLOODLEDGER_BROWSER_EVIDENCE_PATH ?? '/tmp/bloodledger-pr21-cookie-evidence.json', JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  await rm(work, { recursive: true, force: true });
}
