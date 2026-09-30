// Testing phase / FR-14 / BR-ALG-07. Real HTTP, no Playwright route interception.
// Optional owner-only JSON file: {username,password}; never write session artifacts.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const baseURL = process.env.BLOODLEDGER_BROWSER_BASE_URL ?? 'http://127.0.0.1:5174';
const credentialPath = process.env.BLOODLEDGER_BROWSER_CREDENTIAL_PATH;
const outputPath = process.env.BLOODLEDGER_BROWSER_EVIDENCE_PATH ?? '/tmp/bloodledger-v5-live-browser.json';
const evidence = { classification: 'SIMULATION_ONLY', interception: false, baseURL, browser: null, health: null, unauthenticatedForecastStatus: null, cookieFlow: 'BLOCKED: external synthetic web credentials unavailable', v5Success: 'BLOCKED: external pinned model and isolated test binding/setup required', humanUat: 'NOT_RUN' };
const browser = await chromium.launch({ headless: true });
try {
  evidence.browser = browser.version();
  const context = await browser.newContext();
  const page = await context.newPage();
  const health = await context.request.get('http://127.0.0.1:3000/healthz');
  evidence.health = await health.json();
  const denied = await context.request.get(baseURL + '/api/v1/demand-forecasts?businessDate=2026-10-01&datasetVersion=SYNTHETIC_FORECAST_V5_RUNTIME_V1');
  evidence.unauthenticatedForecastStatus = denied.status();
  assert.equal(denied.status(), 401);
  await page.goto(baseURL + '/analytics');
  await page.getByLabel('Username').waitFor();
  if (credentialPath) {
    const credential = JSON.parse(await readFile(credentialPath, 'utf8'));
    await page.getByLabel('Username').fill(credential.username);
    await page.getByLabel('Password', { exact: true }).fill(credential.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'Analytics', exact: true }).waitFor();
    assert.ok((await context.cookies()).some(cookie => cookie.name === 'bloodledger_session' && cookie.httpOnly));
    await page.getByRole('link', { name: 'Analytics', exact: true }).click();
    await page.getByLabel('Forecast version').selectOption('SYNTHETIC_FORECAST_V5_RUNTIME_V1');
    await page.getByText('V5 simulation preview', { exact: true }).first().waitFor();
    const data = await context.request.get(baseURL + '/api/v1/demand-forecasts?businessDate=2026-10-01&datasetVersion=SYNTHETIC_FORECAST_V5_RUNTIME_V1');
    assert.equal(data.status(), 200);
    const body = await data.json();
    evidence.cookieFlow = 'PASS: official HttpOnly cookie session; explicit authenticated V5 read';
    evidence.v5Response = { status: body.status, datasetVersion: body.datasetVersion, returnedSeries: body.forecasts.length, unavailableReason: body.unavailableReason };
    // No screenshot, trace, storage state, credential or raw response output.
  }
  await context.close();
} finally {
  await browser.close();
  await writeFile(outputPath, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
}
console.log(JSON.stringify(evidence));
