// PA-REV-01/02 (ADR-053) probe on the disposable accounts database. Partial approval projects the requested and
// approved quantities and the reason; a receipt discrepancy stores counts only, blocks nothing on-chain, and resolves
// by a matching recount or by compromise. Synthetic data only.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PostgresReceiptVerification } from '../build/src/receipt-verification.js';
import { PostgresV2Projector, PostgresV2ProjectionReader } from '../build/src/database-v2.js';
import { donationLookupHmac } from '../build/src/donation-crypto.js';

export async function probePanelRevisions({ admin, runtime }) {
  let assertions = 0;
  const check = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++; };
  const rejects = async (promise, code) => { await assert.rejects(promise, (error) => error.code === code, code); assertions++; };
  const source = 'INST_MEDIATRIX', destination = 'INST_SYNTH_SECONDARY_REVIEW', correlation = 'CORR_' + 'D'.repeat(32);
  const keyring = { encryptionKey: randomBytes(32), lookupKey: randomBytes(32), encryptionKeyVersion: 'v1' };
  const command = (commandId, transferId, operation, payload, status = 'COMMITTED') => admin.query("INSERT INTO app.v2_commands(command_id,idempotency_key,payload_sha256,resource_type,resource_id,operation,payload,status,next_attempt_at,ledger_transaction_id,correlation_id,actor_user_id,actor_institution_id,accepted_at,updated_at,classification) VALUES($1,$2,repeat('d',64),'TRANSFER',$3,$4,$5,$6,now(),$7,$8,'USR_SYNTH_REVIEW_ROLE02',$9,now(),now(),'SIMULATION_ONLY')", [commandId, `IDEM_${commandId.slice(4)}`, transferId, operation, JSON.stringify(payload), status, randomBytes(32).toString('hex'), correlation, source]);
  const transfer = (transferId, commandId, quantity, status) => admin.query("INSERT INTO app.v2_transfer_requests(transfer_id,command_id,source_institution_id,destination_institution_id,blood_type,component_type,quantity,urgency,request_time,status,ledger_version,ledger_transaction_id,correlation_id,classification) VALUES($1,$2,$3,$4,'O_NEGATIVE','PLATELETS',$5,'ROUTINE',now(),$6,1,$7,$8,'SIMULATION_ONLY')", [transferId, commandId, source, destination, quantity, status, randomBytes(32).toString('hex'), correlation]);
  const component = async (componentId, label, status, reservationId = null, version = 1) => {
    const hmac = donationLookupHmac(label, keyring), donation = `DON_${componentId.slice(5)}`;
    await admin.query("INSERT INTO app.v2_donations(donation_id,issuer_institution_id,donation_number_ciphertext,donation_number_nonce,donation_number_auth_tag,donation_number_key_version,donation_number_lookup_hmac,created_by_user_id,created_at,updated_at,classification) VALUES($1,'INST_MEDIATRIX','FABRICATED_TEST_CIPHERTEXT',repeat('a',32),repeat('b',32),'TEST_ONLY',$2,'USR_SYNTH_REVIEW_ROLE01',now(),now(),'SIMULATION_ONLY')", [donation, hmac]);
    await admin.query("INSERT INTO app.v2_components(component_id,donation_id,issuer_institution_id,donation_number_lookup_hmac,component_type,blood_type,collected_at,expires_at,institution_id,inventory_status,reservation_purpose,reservation_id,ledger_version,ledger_transaction_id,correlation_id,policy_version,created_at,updated_at,classification) VALUES($1,$2,'INST_MEDIATRIX',$3,'PLATELETS','O_NEGATIVE',now()-interval '1 day',now()+interval '4 days',$4,$5,$6,$7,$8,$9,$10,'PERSISTENT_DEVELOPMENT_CORE_V1',now(),now(),'SIMULATION_ONLY')", [componentId, donation, hmac, source, status, reservationId ? 'TRANSFER' : null, reservationId, version, 'e'.repeat(64), correlation]);
  };
  const projector = new PostgresV2Projector(admin), reader = new PostgresV2ProjectionReader(runtime);

  // PA-REV-01: 2 of 3 requested units, projected through the real projector.
  await command('CMD_PANEL_SUBMIT', 'TRF_PANEL_PARTIAL', 'SUBMIT_TRANSFER', { fixture: true });
  await transfer('TRF_PANEL_PARTIAL', 'CMD_PANEL_SUBMIT', 3, 'PENDING');
  await component('COMP_PANEL_P0', 'MM26-11-9901', 'AVAILABLE'); await component('COMP_PANEL_P1', 'MM26-11-9902', 'AVAILABLE');
  const reservePayload = { reservationId: 'RES_PANEL_PARTIAL', transferId: 'TRF_PANEL_PARTIAL', purpose: 'TRANSFER', quantity: 2, requestedQuantity: 3, partialReasonCode: 'INSUFFICIENT_ELIGIBLE_STOCK', partialPolicyVersion: 'SYNTHETIC_PARTIAL_APPROVAL_REASONS_V1', selectedComponentIds: ['COMP_PANEL_P0', 'COMP_PANEL_P1'], expectedComponentVersions: [1, 1] };
  await command('CMD_PANEL_RESERVE', 'TRF_PANEL_PARTIAL', 'RESERVE_COMPONENTS', reservePayload, 'LEDGER_COMMITTED_PROJECTION_PENDING');
  const reserveCommand = { commandId: 'CMD_PANEL_RESERVE', operation: 'RESERVE_COMPONENTS', resourceType: 'TRANSFER', resourceId: 'TRF_PANEL_PARTIAL', payload: reservePayload, actorUserId: 'USR_SYNTH_REVIEW_ROLE02', actorInstitutionId: source, correlationId: correlation, acceptedAt: new Date().toISOString(), ledgerTransactionId: 'a'.repeat(64) };
  await projector.project(reserveCommand, { transactionId: 'a'.repeat(64), result: null });
  await projector.project(reserveCommand, { transactionId: 'a'.repeat(64), result: null });
  const partial = await reader.getReservation('RES_PANEL_PARTIAL', destination, 'ROLE-03');
  check(partial.requestedQuantity, 3); check(partial.approvedQuantity, 2); check(partial.shortfallQuantity, 1);
  assert.deepEqual(partial.partialApproval, { reasonCode: 'INSUFFICIENT_ELIGIBLE_STOCK', policyVersion: 'SYNTHETIC_PARTIAL_APPROVAL_REASONS_V1' }); assertions++;
  check(partial.receiptDiscrepancy, null); check(partial.components.length, 2, 'only the approved units are reserved');
  await assert.rejects(admin.query("UPDATE app.v2_reservations SET partial_reason_code='PATIENT_NAME' WHERE reservation_id='RES_PANEL_PARTIAL'"), /v2_reservation_partial_reason/); assertions++;
  await assert.rejects(admin.query("UPDATE app.v2_reservations SET requested_quantity=0,partial_reason_code=NULL,partial_policy_version=NULL WHERE reservation_id='RES_PANEL_PARTIAL'"), /v2_reservation_quantities/); assertions++;

  // PA-REV-02: an in-transit transfer of two units; the receiver scans one.
  const labels = ['MM26-11-9911', 'MM26-11-9912'], reservationId = 'RES_PANEL_DISPUTE';
  await command('CMD_PANEL_DISPUTE', 'TRF_PANEL_DISPUTE', 'SUBMIT_TRANSFER', { fixture: true });
  await transfer('TRF_PANEL_DISPUTE', 'CMD_PANEL_DISPUTE', 2, 'IN_TRANSIT');
  await admin.query("INSERT INTO app.v2_reservations(reservation_id,purpose,transfer_id,institution_id,status,correlation_id,version,classification) VALUES($1,'TRANSFER','TRF_PANEL_DISPUTE',$2,'IN_TRANSIT',$3,4,'SIMULATION_ONLY')", [reservationId, source, correlation]);
  for (const [index, label] of labels.entries()) await component(`COMP_PANEL_D${index}`, label, 'IN_TRANSIT', reservationId, 4);
  const service = new PostgresReceiptVerification(runtime, keyring);
  const receiver = { userId: 'USR_SYNTH_REVIEW_ROLE03', institutionId: destination, roleId: 'ROLE-03' };
  const body = (values, expectedVersion = 4) => ({ expectedVersion, correlationId: 'CORR_' + randomBytes(16).toString('hex').toUpperCase(), scannedLabels: values.map((donationNumber) => ({ donationNumber, componentType: 'PLATELETS' })) });
  const key = () => `IDEM_PANEL_${randomBytes(6).toString('hex').toUpperCase()}`;
  await rejects(service.recordDiscrepancy(receiver, reservationId, body(labels), key(), new Date()), 'RECEIPT_LABELS_MATCH');
  await rejects(service.recordDiscrepancy({ ...receiver, institutionId: source, roleId: 'ROLE-02', userId: 'USR_SYNTH_REVIEW_ROLE02' }, reservationId, body([labels[0]]), key(), new Date()), 'V2_RESERVATION_NOT_FOUND');
  await rejects(service.recordDiscrepancy({ ...receiver, roleId: 'ROLE-04' }, reservationId, body([labels[0]]), key(), new Date()), 'AUTH_SCOPE_FORBIDDEN');
  await rejects(service.recordDiscrepancy(receiver, reservationId, body([labels[0]], 3), key(), new Date()), 'RESERVATION_VERSION_CONFLICT');
  const disputeKey = key(), disputeBody = body([labels[0], 'MM26-11-9999']);
  const recorded = await service.recordDiscrepancy(receiver, reservationId, disputeBody, disputeKey, new Date());
  check(recorded.status, 'OPEN'); check(recorded.expectedUnits, 2); check(recorded.matchedUnits, 1); check(recorded.missingUnits, 1); check(recorded.unmatchedLabels, 1); check(recorded.replayed, false);
  assert.match(recorded.discrepancyId, /^RDS_[A-F0-9]{40}$/); assertions++;
  check((await service.recordDiscrepancy(receiver, reservationId, disputeBody, disputeKey, new Date())).replayed, true);
  await rejects(service.recordDiscrepancy(receiver, reservationId, body([labels[1]]), disputeKey, new Date()), 'RECEIPT_DISCREPANCY_IDEMPOTENCY_CONFLICT');
  await rejects(service.recordDiscrepancy(receiver, reservationId, body([labels[1]]), key(), new Date()), 'RECEIPT_DISCREPANCY_OPEN');
  const rows = JSON.stringify((await admin.query('SELECT * FROM app.v2_receipt_discrepancies')).rows);
  assert.ok(![...labels, 'MM26-11-9999'].some((label) => rows.includes(label)), 'label values must never be stored'); assertions++;
  // Both involved institutions see the open discrepancy; it changes no custody state.
  check((await reader.getReservation(reservationId, source, 'ROLE-02')).receiptDiscrepancy.status, 'OPEN');
  check((await reader.getReservation(reservationId, destination, 'ROLE-03')).receiptDiscrepancy.missingUnits, 1);
  check(Number((await admin.query("SELECT count(*) FROM app.v2_components WHERE reservation_id=$1 AND inventory_status='IN_TRANSIT'", [reservationId])).rows[0].count), 2);

  // A recount that matches every unit resolves it as RECOUNT_MATCHED.
  await service.verify(receiver, reservationId, body([...labels].reverse()), key(), new Date());
  const recount = (await reader.getReservation(reservationId, destination, 'ROLE-03')).receiptDiscrepancy;
  check(recount.status, 'RESOLVED'); check(recount.resolutionCode, 'RECOUNT_MATCHED');

  // A second dispute resolved by compromise through the real projector.
  const second = await service.recordDiscrepancy(receiver, reservationId, body([labels[1]]), key(), new Date());
  check(second.status, 'OPEN');
  const compromisePayload = { reservationId, expectedVersion: 4, reasonCode: 'HANDLING_OR_CUSTODY_DEVIATION_REPORTED' };
  await command('CMD_PANEL_COMPROMISE', 'TRF_PANEL_DISPUTE', 'COMPROMISE_RESERVATION', compromisePayload, 'LEDGER_COMMITTED_PROJECTION_PENDING');
  await projector.project({ commandId: 'CMD_PANEL_COMPROMISE', operation: 'COMPROMISE_RESERVATION', resourceType: 'TRANSFER', resourceId: reservationId, payload: compromisePayload, actorUserId: 'USR_SYNTH_REVIEW_ROLE03', actorInstitutionId: destination, correlationId: correlation, acceptedAt: new Date().toISOString(), ledgerTransactionId: 'c'.repeat(64) }, { transactionId: 'c'.repeat(64), result: null });
  const compromised = await reader.getReservation(reservationId, destination, 'ROLE-03');
  check(compromised.status, 'COMPROMISED'); check(compromised.receiptDiscrepancy.discrepancyId, second.discrepancyId); check(compromised.receiptDiscrepancy.resolutionCode, 'COMPROMISED');
  check(Number((await admin.query("SELECT count(*) FROM app.v2_receipt_discrepancies WHERE status='OPEN'")).rows[0].count), 0);

  // The runtime role may only resolve discrepancies, never delete them or rewrite their counts.
  await assert.rejects(runtime.query("DELETE FROM app.v2_receipt_discrepancies"), /permission denied/); assertions++;
  await assert.rejects(runtime.query("UPDATE app.v2_receipt_discrepancies SET matched_units=2"), /permission denied/); assertions++;

  // Remove the disposable rows so later preservation fingerprints in this harness stay exact.
  await admin.query("DELETE FROM app.v2_receipt_verifications WHERE reservation_id=$1", [reservationId]);
  await admin.query("DELETE FROM app.v2_receipt_discrepancies WHERE reservation_id=$1", [reservationId]);
  await admin.query("DELETE FROM app.v2_projection_receipts WHERE command_id LIKE 'CMD_PANEL_%'");
  await admin.query("DELETE FROM app.v2_components WHERE component_id LIKE 'COMP_PANEL_%'");
  await admin.query("DELETE FROM app.v2_donations WHERE donation_id LIKE 'DON_PANEL_%'");
  await admin.query("DELETE FROM app.v2_reservations WHERE reservation_id LIKE 'RES_PANEL_%'");
  await admin.query("DELETE FROM app.v2_transfer_requests WHERE transfer_id LIKE 'TRF_PANEL_%'");
  await admin.query("DELETE FROM app.v2_commands WHERE command_id LIKE 'CMD_PANEL_%'");
  console.log(`Panel revisions probe passed with ${assertions} assertions`);
}
