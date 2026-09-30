// FR-14 / BR-ALG-07: actual V5 producer -> PostgreSQL -> authenticated API.
import assert from "node:assert/strict";
import { buildApp } from "../../services/api/build/src/app.js";
import { createPoolFromEnvironment, PostgresScanRepository } from "../../services/api/build/src/database.js";

const dataset = "SYNTHETIC_FORECAST_V5_RUNTIME_V1";
const config = {
  host: "127.0.0.1", port: 3000,
  jwtSecret: "synthetic-v5-api-probe-secret-only",
  operatorId: "USR_SYNTH_VERIFY", operatorCredential: "synthetic-v5-api-fixture",
  workerConfigured: false, activeForecastDatasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1",
};
const pool = createPoolFromEnvironment();
const repository = new PostgresScanRepository(pool);
const app = await buildApp(repository, config, () => new Date("2026-09-30T04:00:00.000Z"));
try {
  const unauthenticated = await app.inject({ method: "GET", url: `/api/v1/demand-forecasts?businessDate=2026-09-30&datasetVersion=${dataset}` });
  assert.equal(unauthenticated.statusCode, 401);
  const login = await app.inject({ method: "POST", url: "/api/v1/simulation/session", payload: { operatorId: config.operatorId, credential: config.operatorCredential } });
  assert.equal(login.statusCode, 200);
  const headers = { authorization: `Bearer ${login.json().token}` };
  const query = (date, version = dataset) => app.inject({ method: "GET", url: `/api/v1/demand-forecasts?businessDate=${date}&datasetVersion=${version}`, headers });
  const current = (await query("2026-09-30")).json();
  assert.equal(current.status, "CURRENT");
  assert.equal(current.forecasts.length, 20);
  assert.equal(current.trainingCutoffDate, "2025-06-30");
  assert.equal(current.lineage.modelSha256, "ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86");
  assert.ok(current.forecasts.every((row) => row.institutionId === "INST_MEDIATRIX" && row.lowerForecast === null && row.upperForecast === null));
  const unavailable = (await query("2026-09-29")).json();
  assert.equal(unavailable.status, "UNAVAILABLE");
  assert.equal(unavailable.unavailableReason, "V5_MODEL_UNAVAILABLE");
  assert.deepEqual(unavailable.forecasts, []);
  assert.equal(unavailable.asOfDate, "2026-09-28");
  const absent = (await query("2026-10-01")).json();
  assert.equal(absent.status, "UNAVAILABLE");
  assert.deepEqual(absent.forecasts, []);
  const v4Default = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-09-30", headers });
  assert.equal(v4Default.json().datasetVersion, "SYNTHETIC_FORECAST_V4_RUNTIME_V1");
  const wrongInstitution = await repository.readForecasts("INST_OTHER", "2026-09-30", dataset, "2026-09-30");
  assert.equal(wrongInstitution.status, "UNAVAILABLE");
  assert.deepEqual(wrongInstitution.forecasts, []);
  const historic = await repository.readForecasts("INST_MEDIATRIX", "2026-09-30", dataset, "2026-10-01");
  assert.equal(historic.status, "STALE");
  assert.ok(historic.forecasts.every((row) => row.stale));
  console.log("V5 producer -> database -> authenticated API: current, unavailable, no fallback, scope and expiry passed");
} finally {
  await app.close();
  await pool.end();
}
