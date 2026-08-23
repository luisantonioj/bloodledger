import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ApiFailure } from "../build/src/errors.js";
import { createPoolFromEnvironment, PostgresScanRepository } from "../build/src/database.js";
import { PostgresApplicationWriteRepository } from "../build/src/database-application-write.js";

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
  const migrator = new Pool({ host:process.env.POSTGRES_HOST, port:Number(process.env.POSTGRES_PORT), database:process.env.POSTGRES_DB, user:process.env.POSTGRES_MIGRATOR_USER, password:process.env.POSTGRES_MIGRATOR_PASSWORD });
  try {
    await migrator.query(`INSERT INTO app.institutions(institution_id,display_name,category,status,classification) VALUES ('INST_MEDIATRIX','Synthetic Mediatrix Database Probe','HOSPITAL','ACTIVE','SIMULATION_ONLY'), ('INST_DIVINE_LOVE','Synthetic Divine Love Database Probe','HOSPITAL','ACTIVE','SIMULATION_ONLY')`);
    await migrator.query(`INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,classification) VALUES('USR_DIVINE_LOVE','synth_divine_love_probe','Synthetic Divine Love Probe','INST_DIVINE_LOVE','SCRYPT_V1',$1,$2,'ACTIVE','SIMULATION_ONLY')`, [randomBytes(16).toString("hex"), randomBytes(64).toString("hex")]);
    await migrator.query(`INSERT INTO app.user_role_assignments(user_id,role_id,policy_version,assigned_at) VALUES('USR_DIVINE_LOVE','ROLE-03','SYNTHETIC_WEB_ACCESS_V1','2026-08-20T00:00:00.000Z')`);
  } finally { await migrator.end(); }

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

  let ledgerCalls=0;
  const transferWriter = new PostgresApplicationWriteRepository(pool, { async submitRequest(input) { ledgerCalls+=1; return { asset:{ transferId:input.transferId,sourceInstitutionId:input.sourceInstitutionId,destinationInstitutionId:input.destinationInstitutionId,bloodType:input.bloodType,component:input.component,quantity:input.quantity,urgency:input.urgency,requestTime:input.requestTime,status:"PENDING",actorUserId:input.actorUserId,policyVersion:input.policyVersion,inventoryPolicyVersion:input.inventoryPolicyVersion,version:1,createdAt:input.eventTime,updatedAt:input.eventTime,correlationId:input.correlationId,lastTransactionId:"TX_SYNTH_TRANSFER_POSTGRES_001" }, committedAt:new Date(input.eventTime), ledgerReplayed:false }; } });
  const transferCommand={ transferId:"TRF_SYNTH_POSTGRES_001",destinationInstitutionId:"INST_DIVINE_LOVE",actorUserId:"USR_DIVINE_LOVE",bloodType:"A_POSITIVE",component:"RED_BLOOD_CELLS",quantity:2,urgency:"URGENT",requestTime:"2026-08-20T01:00:00.000Z",eventTime:"2026-08-20T01:00:00.000Z",correlationId:"CORR_"+"A".repeat(32),idempotencyKey:"IDEM_TRANSFER_POSTGRES_001",payloadSha256:"d".repeat(64),transferEventId:"TEVT_"+"B".repeat(40),auditEventId:"AUDT_"+"C".repeat(40) };
  const submittedTransfer=await transferWriter.submitTransferRequest(transferCommand);
  const replayedTransfer=await transferWriter.submitTransferRequest(transferCommand);
  assert.equal(submittedTransfer.replayed,false);assert.equal(replayedTransfer.replayed,true);assert.equal(ledgerCalls,1);
  await assert.rejects(transferWriter.submitTransferRequest({...transferCommand,payloadSha256:"e".repeat(64)}),(error)=>error instanceof ApiFailure&&error.code==="TRANSFER_IDEMPOTENCY_CONFLICT");
  const transferRows=await pool.query(`SELECT (SELECT count(*) FROM app.transfer_requests) requests,(SELECT count(*) FROM app.transfer_events) events,(SELECT count(*) FROM app.audit_events WHERE action_code='TRANSFER_REQUESTED') audits`);
  assert.deepEqual(Object.values(transferRows.rows[0]).map(Number),[1,1,1]);

  const rows = await pool.query(`
    SELECT
      (SELECT count(*) FROM app.scan_events) AS events,
      (SELECT count(*) FROM app.scan_event_attempts) AS attempts,
      (SELECT count(*) FROM app.inventory_projection) AS projections
  `);
  assert.deepEqual(Object.values(rows.rows[0]).map(Number), [1, 2, 1]);
  console.log("Sprint 4 scan and Sprint 5 transfer PostgreSQL replay/conflict/projection/audit probes passed");
} finally {
  await pool.end();
}
