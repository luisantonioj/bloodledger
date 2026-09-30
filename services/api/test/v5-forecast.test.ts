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
