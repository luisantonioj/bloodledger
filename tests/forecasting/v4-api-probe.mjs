// FR-14 / BL-ML-05: real PostgreSQL output mapped through the application repository.
import assert from "node:assert/strict";
import { createPoolFromEnvironment, PostgresScanRepository } from "../../services/api/build/src/database.js";
const pool = createPoolFromEnvironment();
try {
  const repository = new PostgresScanRepository(pool);
  const historical = await repository.listForecasts("INST_MEDIATRIX", "2026-01-01", "SYNTHETIC_FORECAST_V1");
  assert.equal(historical.length, 4);
  assert.ok(historical.every(row => !row.stale && row.horizonDate === "2026-01-01"));
  const current = await repository.listForecasts("INST_MEDIATRIX", "2026-01-08");
  assert.equal(current.length, 20);
  assert.ok(current.every(row => !row.stale && row.horizonDate === "2026-01-08"));
  assert.ok(current.every(row => row.classification === "SIMULATION_ONLY" && row.recommendationEligibility === "DISABLED_UNAPPROVED_POLICY"));
  assert.ok(current.every(row => Number.isFinite(row.pointForecast) && row.lowerForecast === null && row.upperForecast === null && row.uncertaintyStatus === "UNCERTAINTY_UNAVAILABLE"));
  assert.ok(current.every(row => row.datasetVersion === "SYNTHETIC_FORECAST_V4_RUNTIME_V1" && row.modelVersion === "bloodledger-weighted-average-7-1.0.0"));
  assert.ok((await repository.listForecasts("INST_MEDIATRIX", "2026-01-09")).every(row => row.stale));
  assert.deepEqual(await repository.listForecasts("INST_NO_FORECAST", "2026-01-01"), []);
  const counts = await pool.query("SELECT (SELECT count(*) FROM app.forecast_runs) AS runs, count(*) AS forecasts FROM app.demand_forecasts");
  assert.equal(Number(counts.rows[0].runs), 2);
  assert.equal(Number(counts.rows[0].forecasts), 24);
  console.log("PostgreSQL/API forecast mapping: current, stale, unavailable, safe labels and no duplicates passed");
} finally { await pool.end(); }
