// FR-14 / BR-ALG-07: selected V5 attempt must be eligible at the trusted API instant.
import assert from "node:assert/strict";
import test from "node:test";
import { PostgresScanRepository } from "../src/database.js";

const dataset = "SYNTHETIC_FORECAST_V5_RUNTIME_V1";
const generatedAt = "2026-09-30T15:00:00.000Z";

function selectedAttempt(runStatus: "COMPLETED" | "UNAVAILABLE", generated = generatedAt) {
  const common = {
    run_key: "RUNKEY_SYNTHETIC_FRESHNESS", run_id: `RUN_${"A".repeat(32)}`,
    institution_id: "INST_MEDIATRIX", dataset_version: dataset,
    model_version: "bloodledger-v5-series-mean-1.0.0",
    run_status: runStatus, run_generated_at: generated,
    safe_error_code: runStatus === "UNAVAILABLE" ? "V5_MODEL_UNAVAILABLE" : null,
    run_lineage: { trainingCutoffDate: "2025-06-30", modelSha256: "a".repeat(64) },
    as_of_date_text: "2026-09-29", run_horizon_date_text: "2026-09-30",
  };
  if (runStatus === "UNAVAILABLE") return [{ ...common, forecast_id: null }];
  return ["A_POSITIVE", "B_POSITIVE", "O_POSITIVE", "AB_POSITIVE"].flatMap((bloodType, bloodIndex) =>
    ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS", "CRYOPRECIPITATE"].map((component, componentIndex) => ({
      ...common, forecast_id: `FC_${(bloodIndex * 5 + componentIndex + 1).toString(16).toUpperCase().padStart(40, "0")}`,
      blood_type: bloodType, component, horizon_date: "2026-09-30", forecast_horizon_date: "2026-09-30",
      stale_after_text: "2026-09-30", forecast_status: "AVAILABLE", point_forecast: 1,
      lower_forecast: null, upper_forecast: null, uncertainty_status: "UNCERTAINTY_UNAVAILABLE",
      uncertainty_note: null, generated_at: generated,
    })),
  );
}

test("FR-14 rejects a selected future-generated run and preserves latest unavailable precedence", async () => {
  let rows = selectedAttempt("COMPLETED");
  const pool = { query: async (_sql: string, parameters: string[]) => ({
    rows: parameters[3] < "2026-09-30" ? [] : rows,
  }) } as unknown as ConstructorParameters<typeof PostgresScanRepository>[0];
  const repository = new PostgresScanRepository(pool);
  const read = (instant: string) => repository.readForecasts("INST_MEDIATRIX", "2026-09-30", dataset, new Date(instant));
  const before = await read("2026-09-30T14:59:59.999Z");
  assert.equal(before.status, "UNAVAILABLE");
  assert.equal(before.unavailableReason, "V5_FORECAST_FUTURE_GENERATED");
  assert.deepEqual(before.forecasts, []);
  assert.equal(before.generatedAt, generatedAt);
  assert.equal((await read(generatedAt)).status, "CURRENT");
  assert.equal((await read(generatedAt)).forecasts.length, 20);
  assert.equal((await read("2026-09-30T16:00:00.000Z")).status, "STALE");
  rows = selectedAttempt("COMPLETED", "2026-09-29T12:00:00.000Z");
  assert.equal((await read("2026-09-29T15:59:59.999Z")).status, "UNAVAILABLE");
  assert.equal((await read("2026-09-29T16:00:00.000Z")).status, "CURRENT");
  rows = selectedAttempt("UNAVAILABLE", "2026-09-30T15:30:00.000Z");
  const unavailable = await read("2026-09-30T15:00:00.000Z");
  assert.equal(unavailable.status, "UNAVAILABLE");
  assert.equal(unavailable.unavailableReason, "V5_MODEL_UNAVAILABLE");
  assert.deepEqual(unavailable.forecasts, []);
});
