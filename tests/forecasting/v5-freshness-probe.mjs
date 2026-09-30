// FR-14 / BR-ALG-07: latest persisted attempt across authenticated API time boundaries.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { buildApp } from "../../services/api/build/src/app.js";
import { createPoolFromEnvironment, PostgresScanRepository } from "../../services/api/build/src/database.js";

const pool = createPoolFromEnvironment();
const repository = new PostgresScanRepository(pool);
const dataset = "SYNTHETIC_FORECAST_V5_RUNTIME_V1";
const config = {
  host: "127.0.0.1", port: 3000,
  jwtSecret: randomBytes(32).toString("hex"), operatorId: "USR_SYNTH_VERIFY",
  operatorCredential: randomBytes(16).toString("hex"), workerConfigured: false,
  activeForecastDatasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1",
};

async function readAt(instant, version = dataset) {
  const app = await buildApp(repository, config, () => new Date(instant));
  try {
    const login = await app.inject({ method: "POST", url: "/api/v1/simulation/session", payload: { operatorId: config.operatorId, credential: config.operatorCredential } });
    assert.equal(login.statusCode, 200);
    const response = await app.inject({
      method: "GET", url: `/api/v1/demand-forecasts?businessDate=2026-09-30&datasetVersion=${version}`,
      headers: { authorization: `Bearer ${login.json().token}` },
    });
    assert.equal(response.statusCode, 200);
    return response.json();
  } finally {
    await app.close();
  }
}

try {
  const previous = await pool.query("SELECT count(*)::int AS count FROM app.forecast_runs WHERE institution_id='INST_MEDIATRIX' AND dataset_version=$1 AND horizon_date='2026-09-30'::date AND run_status='COMPLETED'", [dataset]);
  assert.ok(previous.rows[0].count >= 2, "older successful run and newer future-generated run must both exist");
  const before = await readAt("2026-09-30T04:00:00.000Z");
  assert.equal(before.status, "UNAVAILABLE");
  assert.equal(before.unavailableReason, "V5_FORECAST_FUTURE_GENERATED");
  assert.equal(before.generatedAt, "2026-09-30T15:00:00.000Z");
  assert.deepEqual(before.forecasts, []);
  const exact = await readAt("2026-09-30T15:00:00.000Z");
  assert.equal(exact.status, "CURRENT");
  assert.equal(exact.forecasts.length, 20);
  const expired = await readAt("2026-09-30T16:00:00.000Z");
  assert.equal(expired.status, "STALE");
  assert.ok(expired.forecasts.every((forecast) => forecast.stale));
  assert.equal((await readAt("2026-09-30T04:00:00.000Z", "SYNTHETIC_FORECAST_V4_RUNTIME_V1")).datasetVersion, "SYNTHETIC_FORECAST_V4_RUNTIME_V1");
  assert.equal((await repository.readForecasts("INST_OTHER", "2026-09-30", dataset, new Date("2026-09-30T15:00:00.000Z"))).status, "UNAVAILABLE");
  console.log("V5 authenticated future, exact generation, expiry, prior success precedence, scope and V4 isolation passed");
} finally {
  await pool.end();
}
