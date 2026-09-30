// FR-14 / BR-ALG-07: V5 is explicitly readable before activation.
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { readApiConfig } from "../src/config.js";
import { MemoryRepository } from "./test-support.js";

const environment = {
  SPRINT4_JWT_SECRET: "synthetic-v5-api-test-secret-only",
  SPRINT4_OPERATOR_CREDENTIAL: "synthetic-v5-credential",
  SPRINT4_OPERATOR_ID: "USR_SYNTH_CAPTURE",
};

test("FR-14 permits explicit V5 reads but rejects premature active selection", async () => {
  const config = readApiConfig(environment);
  assert.equal(config.activeForecastDatasetVersion, "SYNTHETIC_FORECAST_V4_RUNTIME_V1");
  assert.throws(() => readApiConfig({ ...environment, BLOODLEDGER_ACTIVE_FORECAST_DATASET_VERSION: "SYNTHETIC_FORECAST_V5_RUNTIME_V1" }), /not allowlisted/);
  const app = await buildApp(new MemoryRepository(), config, () => new Date("2026-09-30T04:00:00.000Z"));
  try {
    const unauthenticated = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-09-30&datasetVersion=SYNTHETIC_FORECAST_V5_RUNTIME_V1" });
    assert.equal(unauthenticated.statusCode, 401);
    const login = await app.inject({ method: "POST", url: "/api/v1/simulation/session", payload: { operatorId: environment.SPRINT4_OPERATOR_ID, credential: environment.SPRINT4_OPERATOR_CREDENTIAL } });
    assert.equal(login.statusCode, 200);
    const headers = { authorization: `Bearer ${login.json().token}` };
    const explicit = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-09-30&datasetVersion=SYNTHETIC_FORECAST_V5_RUNTIME_V1", headers });
    assert.equal(explicit.statusCode, 200);
    assert.equal(explicit.json().datasetVersion, "SYNTHETIC_FORECAST_V5_RUNTIME_V1");
    assert.equal(explicit.json().status, "UNAVAILABLE");
    const omitted = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-09-30", headers });
    assert.equal(omitted.json().datasetVersion, "SYNTHETIC_FORECAST_V4_RUNTIME_V1");
  } finally {
    await app.close();
  }
});

test("FR-14 uses the trusted instant for V5 generation and Manila target boundaries", async () => {
  const repository = new MemoryRepository();
  repository.forecasts = [{
    forecastId: `FC_${"A".repeat(40)}`,
    runKey: "synthetic",
    runId: `RUN_${"A".repeat(32)}`,
    institutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", component: "WHOLE_BLOOD",
    asOfDate: "2026-09-29", horizonDate: "2026-09-30", pointForecast: 1,
    lowerForecast: null, upperForecast: null, uncertaintyStatus: "UNCERTAINTY_UNAVAILABLE",
    uncertaintyNote: null, datasetVersion: "SYNTHETIC_FORECAST_V5_RUNTIME_V1",
    modelVersion: "bloodledger-v5-series-mean-1.0.0", forecastStatus: "AVAILABLE",
    classification: "SIMULATION_ONLY", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
    generatedAt: "2026-09-30T15:00:00.000Z", stale: false,
  }];
  let now = new Date("2026-09-30T04:00:00.000Z");
  const app = await buildApp(repository, readApiConfig(environment), () => now);
  try {
    const login = await app.inject({ method: "POST", url: "/api/v1/simulation/session", payload: { operatorId: environment.SPRINT4_OPERATOR_ID, credential: environment.SPRINT4_OPERATOR_CREDENTIAL } });
    const headers = { authorization: `Bearer ${login.json().token}` };
    const read = async () => (await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-09-30&datasetVersion=SYNTHETIC_FORECAST_V5_RUNTIME_V1", headers })).json();
    const before = await read();
    assert.equal(before.status, "UNAVAILABLE");
    assert.equal(before.unavailableReason, "V5_FORECAST_FUTURE_GENERATED");
    assert.deepEqual(before.forecasts, []);
    now = new Date("2026-09-30T15:00:00.000Z");
    assert.equal((await read()).status, "CURRENT");
    now = new Date("2026-09-30T16:00:00.000Z");
    assert.equal((await read()).status, "STALE");
  } finally {
    await app.close();
  }
});
