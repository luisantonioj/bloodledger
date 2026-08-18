import assert from "node:assert/strict";
import { ApiFailure } from "../build/src/errors.js";
import { createPoolFromEnvironment, PostgresScanRepository } from "../build/src/database.js";

const pool = createPoolFromEnvironment();
const repository = new PostgresScanRepository(pool);
const principal = {
  actorUserId: "USR_SYNTH_CAPTURE",
  institutionId: "INST_MEDIATRIX",
  role: "INVENTORY_OPERATOR",
};
const capture = {
  captureMethod: "SYNTHETIC_QR_FALLBACK",
  capturePolicyVersion: "SYNTHETIC_CAPTURE_V1",
  capturedAt: "2026-08-17T11:59:00.000Z",
  confirmedAt: "2026-08-17T11:59:30.000Z",
  unit: {
    unitId: "UNIT_SYNTH_S4_POSTGRES_001",
    bloodType: "A_POSITIVE",
    component: "RED_BLOOD_CELLS",
    collectedAt: "2026-08-17T00:00:00.000Z",
    expiresAt: "2026-08-20T00:00:00.000Z"
  },
  ocrEvidence: null
};
const receivedAt = new Date("2026-08-17T12:00:00.000Z");

try {
  await pool.query(`
    INSERT INTO app.forecast_runs (
      run_id, run_key, payload_sha256, dataset_version, generator_version,
      dataset_sha256, code_sha256, config_sha256, model_artifact_sha256,
      model_version, model_name, target_name, input_start_date, input_end_date,
      horizon_date, generated_at, classification, run_status, safe_error_code,
      lineage, selection_evidence
    ) VALUES (
      'FRUN_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', repeat('a', 64), repeat('b', 64),
      'SYNTHETIC_FORECAST_V1', 'failed-probe', repeat('c', 64), repeat('d', 64),
      repeat('e', 64), repeat('f', 64), 'failed-probe', 'failed-probe',
      'requested_units', '2025-01-01', '2025-12-31', '2026-01-01',
      '2026-01-01T00:00:00.000Z', 'SIMULATION_ONLY', 'FAILED',
      'SYNTHETIC_PROBE_FAILURE', '{}'::jsonb, '{}'::jsonb
    );
    INSERT INTO app.demand_forecasts (
      forecast_id, run_id, institution_id, blood_type, component, horizon_date,
      point_forecast, lower_forecast, upper_forecast, uncertainty_note,
      forecast_status, stale_after, classification, recommendation_eligibility,
      generated_at
    ) VALUES (
      'FCST_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      'FRUN_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'INST_MEDIATRIX', 'A_POSITIVE',
      'RED_BLOOD_CELLS', '2026-01-01', 3, 2, 4, 'failed-run-probe',
      'AVAILABLE', '2026-01-01', 'SIMULATION_ONLY',
      'DISABLED_UNAPPROVED_POLICY', '2026-01-01T00:00:00.000Z'
    );
  `);
  assert.deepEqual(await repository.listForecasts("INST_MEDIATRIX", "2026-01-01"), []);

  const first = await repository.acceptScan(principal, "IDEM_SCAN_POSTGRES_001", capture, receivedAt);
  const replay = await repository.acceptScan(principal, "IDEM_SCAN_POSTGRES_001", capture, new Date("2026-08-17T12:01:00.000Z"));
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(first.event.eventId, replay.event.eventId);
  await assert.rejects(
    repository.acceptScan(
      principal,
      "IDEM_SCAN_POSTGRES_001",
      { ...capture, unit: { ...capture.unit, unitId: "UNIT_SYNTH_S4_POSTGRES_CONFLICT" } },
      receivedAt,
    ),
    (error) => error instanceof ApiFailure && error.code === "SCAN_IDEMPOTENCY_CONFLICT",
  );

  const claimed = await repository.claimLedger("WORKER_POSTGRES_PROBE", receivedAt);
  assert.equal(claimed?.eventId, first.event.eventId);
  assert.equal(claimed?.attemptCount, 1);
  await repository.markLedgerCommitted(claimed, "TX_SYNTH_S4_POSTGRES_001", new Date("2026-08-17T12:00:01.000Z"));
  const pending = await repository.claimProjection(new Date("2026-08-17T12:00:02.000Z"));
  assert.equal(pending?.status, "LEDGER_COMMITTED_PROJECTION_PENDING");
  await repository.projectCommitted(pending, new Date("2026-08-17T12:00:02.000Z"));
  const committed = await repository.findScan(first.event.eventId, "INST_MEDIATRIX");
  assert.equal(committed?.status, "COMMITTED");

  const rows = await pool.query(`
    SELECT
      (SELECT count(*) FROM app.scan_events) AS events,
      (SELECT count(*) FROM app.scan_event_attempts) AS attempts,
      (SELECT count(*) FROM app.inventory_projection) AS projections
  `);
  assert.deepEqual(Object.values(rows.rows[0]).map(Number), [1, 2, 1]);
  console.log("Sprint 4 PostgreSQL intake/replay/conflict/claim/projection probe passed");
} finally {
  await pool.end();
}
