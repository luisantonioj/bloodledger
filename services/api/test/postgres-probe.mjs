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
    expiresAt: "2026-08-25T00:00:00.000Z"
  },
  ocrEvidence: null
};
const receivedAt = new Date("2026-08-17T12:00:00.000Z");

try {
  const migrator = new Pool({ host:process.env.POSTGRES_HOST, port:Number(process.env.POSTGRES_PORT), database:process.env.POSTGRES_DB, user:process.env.POSTGRES_MIGRATOR_USER, password:process.env.POSTGRES_MIGRATOR_PASSWORD });
  try {
    await migrator.query(`INSERT INTO app.institutions(institution_id,display_name,category,status,classification) VALUES ('INST_MEDIATRIX','Synthetic Mediatrix Database Probe','HOSPITAL','ACTIVE','SIMULATION_ONLY'), ('INST_DIVINE_LOVE','Synthetic Divine Love Database Probe','HOSPITAL','ACTIVE','SIMULATION_ONLY')`);
    await migrator.query(`INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,classification) VALUES('USR_DIVINE_LOVE','synth_divine_love_probe','Synthetic Divine Love Probe','INST_DIVINE_LOVE','SCRYPT_V1',$1,$2,'ACTIVE','SIMULATION_ONLY'),('USR_MEDIATRIX_ADMIN','synth_mediatrix_admin_probe','Synthetic Mediatrix Admin Probe','INST_MEDIATRIX','SCRYPT_V1',$3,$4,'ACTIVE','SIMULATION_ONLY')`, [randomBytes(16).toString("hex"), randomBytes(64).toString("hex"), randomBytes(16).toString("hex"), randomBytes(64).toString("hex")]);
    await migrator.query(`INSERT INTO app.user_role_assignments(user_id,role_id,policy_version,assigned_at) VALUES('USR_DIVINE_LOVE','ROLE-03','SYNTHETIC_WEB_ACCESS_V1','2026-08-20T00:00:00.000Z'),('USR_MEDIATRIX_ADMIN','ROLE-02','SYNTHETIC_WEB_ACCESS_V1','2026-08-20T00:00:00.000Z')`);
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

  const secondCapture={...capture,unit:{...capture.unit,unitId:"UNIT_SYNTH_S4_POSTGRES_002",expiresAt:"2026-08-24T00:00:00.000Z"}};
  const second=await repository.acceptScan(principal,"IDEM_SCAN_POSTGRES_002",secondCapture,new Date("2026-08-17T12:02:00.000Z"));
  const secondClaim=await repository.claimLedger("WORKER_POSTGRES_PROBE",new Date("2026-08-17T12:02:00.000Z"));
  assert.equal(secondClaim?.eventId,second.event.eventId);
  await repository.markLedgerCommitted(secondClaim,"TX_SYNTH_S4_POSTGRES_002",new Date("2026-08-17T12:02:01.000Z"));
  const secondProjection=await repository.claimProjection(new Date("2026-08-17T12:02:02.000Z"));
  await repository.projectCommitted(secondProjection,new Date("2026-08-17T12:02:02.000Z"));

  let requestLedgerCalls=0,approvalLedgerCalls=0,rejectionLedgerCalls=0,cancellationLedgerCalls=0;
  const transferWriter = new PostgresApplicationWriteRepository(pool, {
    async submitRequest(input) {
      requestLedgerCalls+=1;
      return { asset:{ transferId:input.transferId,sourceInstitutionId:input.sourceInstitutionId,destinationInstitutionId:input.destinationInstitutionId,bloodType:input.bloodType,component:input.component,quantity:input.quantity,urgency:input.urgency,requestTime:input.requestTime,status:"PENDING",actorUserId:input.actorUserId,policyVersion:input.policyVersion,inventoryPolicyVersion:input.inventoryPolicyVersion,version:1,createdAt:input.eventTime,updatedAt:input.eventTime,correlationId:input.correlationId,lastTransactionId:"TX_"+input.transferId }, committedAt:new Date(input.eventTime), ledgerReplayed:false };
    },
    async approveTransfer(input) {
      approvalLedgerCalls+=1;
      return { asset:{ transferId:input.transferId,status:"APPROVED",selectedUnitIds:input.selectedUnitIds,actorUserId:input.actorUserId,version:input.expectedVersion+1,updatedAt:input.eventTime,correlationId:input.correlationId,lastTransactionId:"TX_SYNTH_TRANSFER_APPROVAL_POSTGRES_001" }, committedAt:new Date(input.eventTime), ledgerReplayed:false };
    },
    async rejectTransfer(input) {
      rejectionLedgerCalls+=1;
      return { asset:{ transferId:input.transferId,status:"REJECTED",reasonCode:input.reasonCode,actorUserId:input.actorUserId,version:input.expectedVersion+1,updatedAt:input.eventTime,correlationId:input.correlationId,lastTransactionId:"TX_SYNTH_TRANSFER_REJECTION_POSTGRES_001" }, committedAt:new Date(input.eventTime), ledgerReplayed:false };
    },
    async cancelTransfer(input) {
      cancellationLedgerCalls+=1;
      return { asset:{ transferId:input.transferId,status:"CANCELLED",reasonCode:input.reasonCode,actorUserId:input.actorUserId,version:input.expectedVersion+1,updatedAt:input.eventTime,correlationId:input.correlationId,lastTransactionId:"TX_SYNTH_TRANSFER_CANCELLATION_POSTGRES_001" }, committedAt:new Date(input.eventTime), ledgerReplayed:false };
    }
  });
  const transferCommand={ transferId:"TRF_SYNTH_POSTGRES_001",destinationInstitutionId:"INST_DIVINE_LOVE",actorUserId:"USR_DIVINE_LOVE",bloodType:"A_POSITIVE",component:"RED_BLOOD_CELLS",quantity:2,urgency:"URGENT",requestTime:"2026-08-20T01:00:00.000Z",eventTime:"2026-08-20T01:00:00.000Z",correlationId:"CORR_"+"A".repeat(32),idempotencyKey:"IDEM_TRANSFER_POSTGRES_001",payloadSha256:"d".repeat(64),transferEventId:"TEVT_"+"B".repeat(40),auditEventId:"AUDT_"+"C".repeat(40) };
  const submittedTransfer=await transferWriter.submitTransferRequest(transferCommand);
  const replayedTransfer=await transferWriter.submitTransferRequest(transferCommand);
  assert.equal(submittedTransfer.replayed,false);assert.equal(replayedTransfer.replayed,true);assert.equal(requestLedgerCalls,1);
  await assert.rejects(transferWriter.submitTransferRequest({...transferCommand,payloadSha256:"e".repeat(64)}),(error)=>error instanceof ApiFailure&&error.code==="TRANSFER_IDEMPOTENCY_CONFLICT");
  const rejectionCommand={ transferId:transferCommand.transferId,sourceInstitutionId:"INST_MEDIATRIX",actorUserId:"USR_MEDIATRIX_ADMIN",expectedVersion:1,reasonCode:"INSUFFICIENT_STOCK",eventTime:"2026-08-20T01:05:00.000Z",correlationId:"CORR_"+"D".repeat(32),idempotencyKey:"IDEM_TRANSFER_REJECT_POSTGRES_001",payloadSha256:"f".repeat(64),transferEventId:"TEVT_"+"D".repeat(40),auditEventId:"AUDT_"+"E".repeat(40) };
  const rejectedTransfer=await transferWriter.rejectTransfer(rejectionCommand);
  const replayedRejection=await transferWriter.rejectTransfer(rejectionCommand);
  assert.equal(rejectedTransfer?.status,"REJECTED");assert.equal(rejectedTransfer?.ledgerVersion,2);assert.equal(replayedRejection?.replayed,true);assert.equal(replayedRejection?.projectedAt,rejectedTransfer?.projectedAt);assert.equal(rejectionLedgerCalls,1);
  await assert.rejects(transferWriter.rejectTransfer({...rejectionCommand,reasonCode:"POLICY_REJECTED"}),(error)=>error instanceof ApiFailure&&error.code==="TRANSFER_IDEMPOTENCY_CONFLICT");
  const approvalRequest={...transferCommand,transferId:"TRF_SYNTH_POSTGRES_APPROVAL_001",quantity:2,idempotencyKey:"IDEM_TRANSFER_POSTGRES_APPROVAL_001",payloadSha256:"1".repeat(64),transferEventId:"TEVT_"+"1".repeat(40),auditEventId:"AUDT_"+"2".repeat(40)};
  await transferWriter.submitTransferRequest(approvalRequest);
  const approvalCommand={transferId:approvalRequest.transferId,sourceInstitutionId:"INST_MEDIATRIX",actorUserId:"USR_MEDIATRIX_ADMIN",expectedVersion:1,eventTime:"2026-08-20T01:10:00.000Z",correlationId:"CORR_"+"3".repeat(32),idempotencyKey:"IDEM_TRANSFER_APPROVE_POSTGRES_001",payloadSha256:"2".repeat(64),transferEventId:"TEVT_"+"3".repeat(40),auditEventId:"AUDT_"+"4".repeat(40)};
  const approvedTransfer=await transferWriter.approveTransfer(approvalCommand);
  const replayedApproval=await transferWriter.approveTransfer(approvalCommand);
  assert.equal(approvedTransfer?.status,"APPROVED");assert.deepEqual(approvedTransfer?.selectedUnitIds,["UNIT_SYNTH_S4_POSTGRES_002","UNIT_SYNTH_S4_POSTGRES_001"]);assert.equal(replayedApproval?.replayed,true);assert.deepEqual(replayedApproval?.selectedUnitIds,approvedTransfer?.selectedUnitIds);assert.equal(approvalLedgerCalls,1);
  await assert.rejects(transferWriter.approveTransfer({...approvalCommand,expectedVersion:2}),(error)=>error instanceof ApiFailure&&error.code==="TRANSFER_IDEMPOTENCY_CONFLICT");
  const reserved=await pool.query("SELECT unit_id,inventory_status,ledger_transaction_id FROM app.inventory_projection ORDER BY expires_at,unit_id");
  assert.deepEqual(reserved.rows.map(row=>[row.unit_id,row.inventory_status]),[["UNIT_SYNTH_S4_POSTGRES_002","RESERVED"],["UNIT_SYNTH_S4_POSTGRES_001","RESERVED"]]);
  assert.equal(new Set(reserved.rows.map(row=>row.ledger_transaction_id)).size,1);

  const insufficientRequest={...transferCommand,transferId:"TRF_SYNTH_POSTGRES_INSUFFICIENT_001",quantity:1,idempotencyKey:"IDEM_TRANSFER_POSTGRES_INSUFFICIENT_001",payloadSha256:"5".repeat(64),transferEventId:"TEVT_"+"5".repeat(40),auditEventId:"AUDT_"+"5".repeat(40)};
  await transferWriter.submitTransferRequest(insufficientRequest);
  const insufficientApproval={...approvalCommand,transferId:insufficientRequest.transferId,idempotencyKey:"IDEM_TRANSFER_APPROVE_INSUFFICIENT_001",payloadSha256:"6".repeat(64),transferEventId:"TEVT_"+"6".repeat(40),auditEventId:"AUDT_"+"6".repeat(40)};
  await assert.rejects(transferWriter.approveTransfer(insufficientApproval),(error)=>error instanceof ApiFailure&&error.code==="TRF_INSUFFICIENT_STOCK");
  assert.equal(approvalLedgerCalls,1);

  const cancellationCommand={transferId:approvalRequest.transferId,actorInstitutionId:"INST_MEDIATRIX",actorRoleId:"ROLE-02",actorUserId:"USR_MEDIATRIX_ADMIN",expectedVersion:2,reasonCode:"REQUEST_WITHDRAWN",eventTime:"2026-08-20T01:15:00.000Z",correlationId:"CORR_"+"7".repeat(32),idempotencyKey:"IDEM_TRANSFER_CANCEL_POSTGRES_001",payloadSha256:"7".repeat(64),transferEventId:"TEVT_"+"7".repeat(40),auditEventId:"AUDT_"+"7".repeat(40)};
  const cancelledTransfer=await transferWriter.cancelTransfer(cancellationCommand);
  const replayedCancellation=await transferWriter.cancelTransfer(cancellationCommand);
  assert.equal(cancelledTransfer?.status,"CANCELLED");assert.equal(cancelledTransfer?.ledgerVersion,3);assert.deepEqual(cancelledTransfer?.releasedUnitIds,["UNIT_SYNTH_S4_POSTGRES_002","UNIT_SYNTH_S4_POSTGRES_001"]);assert.equal(replayedCancellation?.replayed,true);assert.deepEqual(replayedCancellation?.releasedUnitIds,cancelledTransfer?.releasedUnitIds);assert.equal(cancellationLedgerCalls,1);
  await assert.rejects(transferWriter.cancelTransfer({...cancellationCommand,reasonCode:"REQUEST_CHANGED"}),(error)=>error instanceof ApiFailure&&error.code==="TRANSFER_IDEMPOTENCY_CONFLICT");
  const released=await pool.query("SELECT unit_id,inventory_status,ledger_transaction_id FROM app.inventory_projection ORDER BY expires_at,unit_id");
  assert.deepEqual(released.rows.map(row=>[row.unit_id,row.inventory_status]),[["UNIT_SYNTH_S4_POSTGRES_002","AVAILABLE"],["UNIT_SYNTH_S4_POSTGRES_001","AVAILABLE"]]);
  assert.equal(new Set(released.rows.map(row=>row.ledger_transaction_id)).size,1);
  assert.equal(released.rows[0].ledger_transaction_id,"TX_SYNTH_TRANSFER_CANCELLATION_POSTGRES_001");

  const transferRows=await pool.query(`SELECT (SELECT count(*) FROM app.transfer_requests) requests,(SELECT count(*) FROM app.transfer_events) events,(SELECT count(*) FROM app.audit_events WHERE action_code='TRANSFER_REQUESTED') requested_audits,(SELECT count(*) FROM app.audit_events WHERE action_code='TRANSFER_REJECTED') rejected_audits,(SELECT count(*) FROM app.audit_events WHERE action_code='TRANSFER_APPROVED') approved_audits,(SELECT count(*) FROM app.audit_events WHERE action_code='TRANSFER_CANCELLED') cancelled_audits`);
  assert.deepEqual(Object.values(transferRows.rows[0]).map(Number),[3,6,3,1,1,1]);

  const rows = await pool.query(`
    SELECT
      (SELECT count(*) FROM app.scan_events) AS events,
      (SELECT count(*) FROM app.scan_event_attempts) AS attempts,
      (SELECT count(*) FROM app.inventory_projection) AS projections
  `);
  assert.deepEqual(Object.values(rows.rows[0]).map(Number), [2, 4, 2]);
  console.log("Sprint 4 scan and Sprint 5 transfer request/approval/rejection/cancellation PostgreSQL replay/conflict/projection/audit probes passed");
} finally {
  await pool.end();
}
