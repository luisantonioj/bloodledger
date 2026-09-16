// FR-14 / BL-ML-05: real PostgreSQL output mapped through the application repository.
import assert from "node:assert/strict";
import { createPoolFromEnvironment, PostgresScanRepository } from "../../services/api/build/src/database.js";
const pool = createPoolFromEnvironment();
try {
  const repository = new PostgresScanRepository(pool);
  const current = await repository.listForecasts("INST_MEDIATRIX", "2026-01-01");
  assert.equal(current.length, 4);
  assert.ok(current.every(row => !row.stale && row.horizonDate === "2026-01-01"));
  assert.ok(current.every(row => row.classification === "SIMULATION_ONLY" && row.recommendationEligibility === "DISABLED_UNAPPROVED_POLICY"));
  assert.ok(current.every(row => Number.isFinite(row.pointForecast) && row.lowerForecast <= row.pointForecast && row.pointForecast <= row.upperForecast));
  assert.ok((await repository.listForecasts("INST_MEDIATRIX", "2026-01-02")).every(row => row.stale));
  assert.deepEqual(await repository.listForecasts("INST_NO_FORECAST", "2026-01-01"), []);
  const counts = await pool.query("SELECT (SELECT count(*) FROM app.forecast_runs) AS runs, count(*) AS forecasts FROM app.demand_forecasts");
  assert.equal(Number(counts.rows[0].runs), 1);
  assert.equal(Number(counts.rows[0].forecasts), 4);
  console.log("PostgreSQL/API forecast mapping: current, stale, unavailable, safe labels and no duplicates passed");
} finally { await pool.end(); }
