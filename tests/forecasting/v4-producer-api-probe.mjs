// Issue #9 / FR-14: actual producer attempts, not hand-crafted unavailable rows.
import assert from "node:assert/strict";
import { buildApp } from "../../services/api/build/src/app.js";
import { createPoolFromEnvironment, PostgresScanRepository } from "../../services/api/build/src/database.js";
const config = { host: "127.0.0.1", port: 3000, jwtSecret: ["synthetic", "producer", "verification", "only"].join("-"), operatorId: "USR_SYNTH_VERIFY", operatorCredential: "synthetic-producer-fixture", workerConfigured: false, activeForecastDatasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1" };
const pool = createPoolFromEnvironment();
const repository = new PostgresScanRepository(pool);
const app = await buildApp(repository, config, () => new Date("2026-01-09T03:00:00Z"));
try {
  const login = await app.inject({ method: "POST", url: "/api/v1/simulation/session", payload: {operatorId: config.operatorId, credential: config.operatorCredential} });
  assert.equal(login.statusCode, 200);
  const headers = { authorization: `Bearer ${login.json().token}` };
  for (const [origin, horizon] of [["2026-01-07", "2026-01-08"], ["2026-01-08", "2026-01-09"]]) {
    const response = await app.inject({ method: "GET", url: `/api/v1/demand-forecasts?businessDate=${horizon}`, headers });
    assert.equal(response.statusCode, 200);
    const result = response.json();
    assert.equal(result.status, "UNAVAILABLE");
    assert.equal(result.asOfDate, origin);
    assert.equal(result.horizonDate, horizon);
    assert.equal(result.datasetVersion, config.activeForecastDatasetVersion);
    assert.deepEqual(result.forecasts, []);
  }
  const stored = await pool.query("SELECT r.run_id, r.horizon_date::text, count(f.forecast_id)::integer AS rows FROM app.forecast_runs r LEFT JOIN app.demand_forecasts f ON f.run_id=r.run_id WHERE r.dataset_version=$1 AND r.run_status='UNAVAILABLE' GROUP BY r.run_id", [config.activeForecastDatasetVersion]);
  assert.equal(stored.rows.length, 2);
  assert.ok(stored.rows.every(row => row.rows === 0));
  // The database must enforce scope even when a caller bypasses the producer.
  await assert.rejects(pool.query(`
    INSERT INTO app.demand_forecasts (
      forecast_id, run_id, institution_id, blood_type, component, horizon_date,
      point_forecast, lower_forecast, upper_forecast, uncertainty_note,
      uncertainty_status, forecast_status, stale_after, classification,
      recommendation_eligibility, generated_at
    ) SELECT $1, run_id, 'INST_WRONG_SCOPE', blood_type, component, horizon_date,
      point_forecast, lower_forecast, upper_forecast, uncertainty_note,
      uncertainty_status, forecast_status, stale_after, classification,
      recommendation_eligibility, generated_at
      FROM app.demand_forecasts WHERE institution_id='INST_SYNTHETIC_DESTINATION' LIMIT 1
  `, ["FC_" + "F".repeat(40)]), error => error.code === "23503" && error.constraint === "demand_forecasts_run_institution");
  const destination = await repository.readForecasts("INST_SYNTHETIC_DESTINATION", "2026-01-08");
  assert.equal(destination.status, "CURRENT");
  assert.equal(destination.forecasts.length, 20);
  assert.ok(destination.forecasts.every(row => row.institutionId === "INST_SYNTHETIC_DESTINATION"));
  const history = await repository.readForecasts("INST_MEDIATRIX", "2026-01-01", "SYNTHETIC_FORECAST_V1");
  assert.equal(history.forecasts.length, 4);
  console.log("Producer -> PostgreSQL -> authenticated API: null suppresses prior success, requested dates retained, institution isolation and V1 history passed");
} finally { await app.close(); await pool.end(); }
