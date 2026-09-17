import assert from "node:assert/strict";
import { createPoolFromEnvironment } from "../../services/api/build/src/database.js";
import { PostgresV2Projector } from "../../services/api/build/src/database-v2.js";
import { PostgresV2CommandStore } from "../../services/api/build/src/v2-command.js";

const pool = createPoolFromEnvironment();
const store = new PostgresV2CommandStore(pool);
const projector = new PostgresV2Projector(pool);
const actorUserId = "USR_SYNTH_VERIFY";
const actorInstitutionId = "INST_MEDIATRIX";
const baseTime = "2026-01-07T12:00:00.000Z";
let sequence = 0;

function correlation() {
  sequence += 1;
  return `CORR_${String(sequence).padStart(32, "0")}`;
}

async function command(operation, resourceId, payload, transactionId) {
  sequence += 1;
  const commandId = `CMD_PROJECTION_${String(sequence).padStart(3, "0")}`;
  const idempotencyKey = `IDEM_PROJECTION_${String(sequence).padStart(3, "0")}`;
  const acceptedAt = baseTime;
  const correlationId = payload.correlationId ?? correlation();
  const result = await store.enqueue({ commandId, idempotencyKey, resourceType: "TRANSFER", resourceId, operation, payload: { ...payload, correlationId }, correlationId, actorUserId, actorInstitutionId, acceptedAt });
  assert.equal(result.replayed, false);
  await store.markLedgerCommitted(commandId, transactionId, new Date(acceptedAt), { transactionId, operation });
  const committed = { ...result.command, ledgerTransactionId: transactionId, ledgerResult: { transactionId, operation } };
  await projector.project(committed, { transactionId, result: committed.ledgerResult });
  await store.markCommitted(commandId, new Date(acceptedAt));
  return committed;
}

async function state(componentId) {
  const result = await pool.query("SELECT inventory_status,ledger_version,reservation_id,reservation_purpose,ledger_transaction_id FROM app.v2_components WHERE component_id=$1", [componentId]);
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}

async function reservation(reservationId) {
  const result = await pool.query("SELECT status,version,prepared_evidence_id FROM app.v2_reservations WHERE reservation_id=$1", [reservationId]);
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}

async function replayAndRejectConflict(committed) {
  await projector.project(committed, { transactionId: committed.ledgerTransactionId, result: committed.ledgerResult });
  await assert.rejects(projector.project(committed, { transactionId: "TX_CONFLICTING_REUSE", result: null }), /V2_PROJECTION_RECEIPT_CONFLICT/);
}

try {
  const reserved = await command("RESERVE_COMPONENTS", "RES_PROJECTION_001", { reservationId: "RES_PROJECTION_001", purpose: "TRANSFER", transferId: "TRF_PROJECTION_001", sourceInstitutionId: actorInstitutionId, destinationInstitutionId: "INST_METRO_LIPA", bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", quantity: 1, selectedComponentIds: ["COMP_VERIFY_001"], expectedComponentVersions: [1], policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_001");
  assert.equal((await state("COMP_VERIFY_001")).inventory_status, "RESERVED");
  assert.equal(Number((await state("COMP_VERIFY_001")).ledger_version), 2);
  assert.equal((await reservation("RES_PROJECTION_001")).status, "ACTIVE");

  await command("PREPARE_RESERVATION", "RES_PROJECTION_001", { reservationId: "RES_PROJECTION_001", expectedVersion: 1, preparedAt: baseTime, preparedEvidenceDigest: "a".repeat(64), preparedEvidenceId: "EVD_PROJECTION_001", policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_002");
  assert.equal(Number((await state("COMP_VERIFY_001")).ledger_version), 2);
  assert.equal(Number((await reservation("RES_PROJECTION_001")).version), 2);
  assert.equal((await reservation("RES_PROJECTION_001")).prepared_evidence_id, "EVD_PROJECTION_001");

  await command("DISPATCH_RESERVATION", "RES_PROJECTION_001", { reservationId: "RES_PROJECTION_001", expectedVersion: 2, policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_003");
  await command("START_RESERVATION_TRANSIT", "RES_PROJECTION_001", { reservationId: "RES_PROJECTION_001", expectedVersion: 3, policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_004");
  await command("RECEIVE_RESERVATION", "RES_PROJECTION_001", { reservationId: "RES_PROJECTION_001", expectedVersion: 4, policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_005");
  await command("COMPROMISE_RESERVATION", "RES_PROJECTION_001", { reservationId: "RES_PROJECTION_001", expectedVersion: 5, reasonCode: "PACKAGE_DAMAGED", policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_006");
  const compromised = await state("COMP_VERIFY_001");
  assert.equal(compromised.inventory_status, "COMPROMISED");
  assert.equal(compromised.reservation_id, "RES_PROJECTION_001");
  assert.equal(Number(compromised.ledger_version), 6);
  assert.equal((await reservation("RES_PROJECTION_001")).status, "COMPROMISED");
  assert.equal(Number((await reservation("RES_PROJECTION_001")).version), 6);
  await replayAndRejectConflict(reserved);

  await command("RESERVE_LOCAL_RELEASE", "REL_PROJECTION_001", { reservationId: "RES_PROJECTION_002", purpose: "LOCAL_RELEASE", localReleaseId: "REL_PROJECTION_001", sourceInstitutionId: actorInstitutionId, bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", quantity: 1, selectedComponentIds: ["COMP_VERIFY_002"], expectedComponentVersions: [1], policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_007");
  await command("PREPARE_RESERVATION", "RES_PROJECTION_002", { reservationId: "RES_PROJECTION_002", expectedVersion: 1, preparedAt: baseTime, preparedEvidenceDigest: "b".repeat(64), preparedEvidenceId: "EVD_PROJECTION_002", policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_008");
  await command("COMPLETE_LOCAL_RELEASE", "RES_PROJECTION_002", { reservationId: "RES_PROJECTION_002", expectedVersion: 2, preparedAt: baseTime, policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_009");
  assert.equal((await state("COMP_VERIFY_002")).inventory_status, "RELEASED");
  assert.equal((await reservation("RES_PROJECTION_002")).status, "COMPLETED");

  await command("PLACE_RECONCILIATION_HOLD", "RECON_PROJECTION_001", { componentId: "COMP_VERIFY_003", caseId: "RECON_PROJECTION_001", observedStatus: "STATUS_MISMATCH", expectedVersion: 1, reasonCode: "PHYSICAL_COUNT_MISMATCH", policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_010");
  assert.equal((await state("COMP_VERIFY_003")).inventory_status, "RECONCILIATION_HOLD");
  await command("RESOLVE_RECONCILIATION_HOLD", "RECON_PROJECTION_001", { componentId: "COMP_VERIFY_003", caseId: "RECON_PROJECTION_001", expectedVersion: 2, resolutionCode: "COUNT_CONFIRMED", policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_011");
  assert.equal((await state("COMP_VERIFY_003")).inventory_status, "AVAILABLE");
  assert.equal((await pool.query("SELECT status FROM app.v2_reconciliation_cases WHERE case_id=$1", ["RECON_PROJECTION_001"])).rows[0].status, "RESOLVED");

  await command("EVALUATE_COMPONENT_EXPIRY", "COMP_VERIFY_004", { componentId: "COMP_VERIFY_004", expectedVersion: 1, evaluationTime: "2026-02-01T00:00:00.000Z", policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_012");
  assert.equal((await state("COMP_VERIFY_004")).inventory_status, "EXPIRED");

  await command("RESERVE_COMPONENTS", "RES_PROJECTION_003", { reservationId: "RES_PROJECTION_003", purpose: "TRANSFER", transferId: "TRF_PROJECTION_003", sourceInstitutionId: actorInstitutionId, destinationInstitutionId: "INST_METRO_LIPA", bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", quantity: 1, selectedComponentIds: ["COMP_VERIFY_005"], expectedComponentVersions: [1], policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_013");
  await command("CANCEL_RESERVATION", "RES_PROJECTION_003", { reservationId: "RES_PROJECTION_003", expectedVersion: 1, policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_014");
  assert.equal((await state("COMP_VERIFY_005")).inventory_status, "AVAILABLE");
  assert.equal((await reservation("RES_PROJECTION_003")).status, "CANCELLED");

  const transfer = await command("SUBMIT_TRANSFER", "TRF_PROJECTION_004", { transferId: "TRF_PROJECTION_004", sourceInstitutionId: actorInstitutionId, destinationInstitutionId: "INST_METRO_LIPA", bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", quantity: 1, urgency: "ROUTINE", requestTime: baseTime, policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", eventTime: baseTime }, "TX_PROJECTION_015");
  const transferRow = await pool.query("SELECT status,ledger_transaction_id FROM app.v2_transfer_requests WHERE transfer_id=$1", [transfer.payload.transferId]);
  assert.equal(transferRow.rows[0].status, "PENDING");
  assert.equal(transferRow.rows[0].ledger_transaction_id, "TX_PROJECTION_015");
  console.log("Real PostgreSQL V2 projection lifecycle, receipts, replay, and transfer persistence passed");
} finally {
  await pool.end();
}
