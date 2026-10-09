// Testing phase / FR-14 / BR-ALG-07. Real HTTP, no Playwright route interception.
// Optional owner-only JSON file: {username,password}; never write session artifacts.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const baseURL = process.env.BLOODLEDGER_BROWSER_BASE_URL ?? 'http://127.0.0.1:5174';
const businessDate = process.env.BLOODLEDGER_BROWSER_BUSINESS_DATE ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
assert.match(businessDate, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(new Date(businessDate).toISOString().slice(0, 10), businessDate);
const forecastPath = '/api/v1/demand-forecasts?businessDate=' + businessDate + '&datasetVersion=SYNTHETIC_FORECAST_V5_RUNTIME_V1';
const credentialPath = process.env.BLOODLEDGER_BROWSER_CREDENTIAL_PATH;
const outputPath = process.env.BLOODLEDGER_BROWSER_EVIDENCE_PATH ?? '/tmp/bloodledger-v5-live-browser.json';
const evidence = { classification: 'SIMULATION_ONLY', interception: false, baseURL, businessDate, browser: null, health: null, unauthenticatedForecastStatus: null, cookieFlow: 'BLOCKED: external synthetic web credentials unavailable', v5Success: 'BLOCKED: external pinned model and isolated test binding/setup required', humanUat: 'NOT_RUN' };
const browser = await chromium.launch({ headless: true });
try {
  evidence.browser = browser.version();
  const context = await browser.newContext();
  const page = await context.newPage();
  const health = await context.request.get(baseURL + '/healthz');
  const healthBody = await health.json();
  evidence.health = { httpStatus: health.status(), status: healthBody.status, database: healthBody.database };
  const denied = await context.request.get(baseURL + forecastPath);
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
    await page.getByLabel('Business date').fill(businessDate);
    await page.getByLabel('Forecast version').selectOption('SYNTHETIC_FORECAST_V5_RUNTIME_V1');
    await page.getByText('V5 simulation preview', { exact: true }).first().waitFor();
    const data = await context.request.get(baseURL + forecastPath);
    assert.equal(data.status(), 200);
    const body = await data.json();
    evidence.cookieFlow = 'PASS: official HttpOnly cookie session; explicit authenticated V5 read';
    evidence.v5Response = { status: body.status, datasetVersion: body.datasetVersion, returnedSeries: body.forecasts.length, unavailableReason: body.unavailableReason };
    assert.equal(body.datasetVersion, 'SYNTHETIC_FORECAST_V5_RUNTIME_V1');
    if (body.status === 'CURRENT' || body.status === 'STALE') {
      assert.equal(body.forecasts.length, 20);
      assert.ok(body.forecasts.every(item => item.lowerForecast === null && item.upperForecast === null && item.recommendationEligibility === 'DISABLED_UNAPPROVED_POLICY'));
      await page.locator('.forecast-table tbody tr').nth(19).waitFor();
      assert.equal(await page.locator('.forecast-table tbody tr').count(), 20);
      evidence.v5Success = 'PASS: twenty authenticated HTTP and rendered forecast series (' + body.status + ')';
    } else {
      assert.equal(body.status, 'UNAVAILABLE');
      assert.equal(body.forecasts.length, 0);
      await page.getByText('Forecast unavailable', { exact: true }).waitFor();
      assert.equal(await page.locator('.forecast-table tbody tr').count(), 0);
      evidence.v5Success = 'BLOCKED: selected runtime evidence unavailable';
    }
    // No screenshot, trace, storage state, credential or raw response output.
  }
  await context.close();
} finally {
  await browser.close();
  await writeFile(outputPath, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
}
console.log(JSON.stringify(evidence));
