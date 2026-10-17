// ADR-049 INBOUND_RECEIPT_LABEL_VERIFICATION_V1 probe on the disposable accounts database: a disposable
// in-transit TRANSFER reservation with two synthetic labels. Every unit must match by Donation No. and component
// before RCV_ evidence is issued; one label never covers the reservation (F2). Synthetic data only.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertReceiptEvidence, PostgresReceiptVerification } from '../build/src/receipt-verification.js';
import { donationLookupHmac } from '../build/src/donation-crypto.js';

export async function probeReceiptVerification({ admin, runtime }) {
  let assertions = 0;
  const check = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++; };
  const rejects = async (promise, code) => { await assert.rejects(promise, (error) => error.code === code, code); assertions++; };
  const scalar = async (sql, params = []) => Number(Object.values((await admin.query(sql, params)).rows[0])[0]);
  const keyring = { encryptionKey: randomBytes(32), lookupKey: randomBytes(32), encryptionKeyVersion: 'v1' };
  const labels = ['MM26-10-9911', 'MM26-10-9912'], reservationId = 'RES_RECEIPT_PROBE', transferId = 'TRF_RECEIPT_PROBE', commandId = 'CMD_RECEIPT_PROBE';
  const source = 'INST_MEDIATRIX', destination = 'INST_SYNTH_SECONDARY_REVIEW', correlation = 'CORR_' + 'C'.repeat(32);
  await admin.query("INSERT INTO app.v2_commands(command_id,idempotency_key,payload_sha256,resource_type,resource_id,operation,payload,status,next_attempt_at,ledger_transaction_id,correlation_id,actor_user_id,actor_institution_id,accepted_at,updated_at,classification) VALUES($1,'IDEM_RECEIPT_PROBE',repeat('c',64),'TRANSFER',$2,'SUBMIT_TRANSFER','{\"fixture\":true}','COMMITTED',now(),$3,$4,'USR_SYNTH_REVIEW_ROLE03',$5,now(),now(),'SIMULATION_ONLY')", [commandId, transferId, 'f'.repeat(64), correlation, destination]);
  await admin.query("INSERT INTO app.v2_transfer_requests(transfer_id,command_id,source_institution_id,destination_institution_id,blood_type,component_type,quantity,urgency,request_time,status,ledger_version,ledger_transaction_id,correlation_id,classification) VALUES($1,$2,$3,$4,'O_NEGATIVE','PLATELETS',2,'ROUTINE',now(),'IN_TRANSIT',3,$5,$6,'SIMULATION_ONLY')", [transferId, commandId, source, destination, 'f'.repeat(63) + '1', correlation]);
  await admin.query("INSERT INTO app.v2_reservations(reservation_id,purpose,transfer_id,institution_id,status,correlation_id,version,classification) VALUES($1,'TRANSFER',$2,$3,'IN_TRANSIT',$4,4,'SIMULATION_ONLY')", [reservationId, transferId, source, correlation]);
  for (const [index, label] of labels.entries()) {
    const hmac = donationLookupHmac(label, keyring), donation = `DON_RECEIPT_PROBE_${index}`;
    await admin.query("INSERT INTO app.v2_donations(donation_id,issuer_institution_id,donation_number_ciphertext,donation_number_nonce,donation_number_auth_tag,donation_number_key_version,donation_number_lookup_hmac,created_by_user_id,created_at,updated_at,classification) VALUES($1,'INST_MEDIATRIX','FABRICATED_TEST_CIPHERTEXT',repeat('a',32),repeat('b',32),'TEST_ONLY',$2,'USR_SYNTH_REVIEW_ROLE01',now(),now(),'SIMULATION_ONLY')", [donation, hmac]);
    await admin.query("INSERT INTO app.v2_components(component_id,donation_id,issuer_institution_id,donation_number_lookup_hmac,component_type,blood_type,collected_at,expires_at,institution_id,inventory_status,reservation_purpose,reservation_id,ledger_version,ledger_transaction_id,correlation_id,policy_version,created_at,updated_at,classification) VALUES($1,$2,'INST_MEDIATRIX',$3,'PLATELETS','O_NEGATIVE',now()-interval '1 day',now()+interval '4 days',$4,'IN_TRANSIT','TRANSFER',$5,4,$6,$7,'PERSISTENT_DEVELOPMENT_CORE_V1',now(),now(),'SIMULATION_ONLY')", [`COMP_RECEIPT_PROBE_${index}`, donation, hmac, source, reservationId, 'e'.repeat(64), correlation]);
  }
  const service = new PostgresReceiptVerification(runtime, keyring);
  const receiver = { userId: 'USR_SYNTH_REVIEW_ROLE03', displayName: 'Synthetic Receiver', institutionId: destination, institutionDisplayName: 'Synthetic Secondary', institutionCategory: 'HOSPITAL', roleId: 'ROLE-03', roleDisplayName: 'Verified operator', permissions: [], classification: 'SIMULATION_ONLY' };
  const body = (scannedLabels, expectedVersion = 4) => ({ expectedVersion, correlationId: 'CORR_' + randomBytes(16).toString('hex').toUpperCase(), scannedLabels });
  const pairs = (componentType, values = labels) => values.map((donationNumber) => ({ donationNumber, componentType }));
  const key = () => `IDEM_RECEIPT_${randomBytes(6).toString('hex').toUpperCase()}`;

  // F2: one label of two cannot receive the reservation; sibling components and missing components never match.
  await rejects(service.verify(receiver, reservationId, body(pairs('PLATELETS', [labels[0]])), key(), new Date()), 'RECEIPT_LABELS_MISMATCH');
  await rejects(service.verify(receiver, reservationId, body(pairs('FRESH_FROZEN_PLASMA')), key(), new Date()), 'RECEIPT_LABELS_MISMATCH');
  await rejects(service.verify(receiver, reservationId, body([...pairs('PLATELETS', [labels[0]]), { donationNumber: 'MM26-10-9999', componentType: 'PLATELETS' }]), key(), new Date()), 'RECEIPT_LABELS_MISMATCH');
  await rejects(service.verify(receiver, reservationId, body([{ donationNumber: labels[0] }, ...pairs('PLATELETS', [labels[1]])]), key(), new Date()), 'RECEIPT_VERIFICATION_INPUT_INVALID');
  await rejects(service.verify(receiver, reservationId, body(pairs('PLATELETS'), 3), key(), new Date()), 'RESERVATION_VERSION_CONFLICT');
  // Only the destination verifies: the source bank and other institutions see not found; a regulator is refused.
  await rejects(service.verify({ ...receiver, userId: 'USR_SYNTH_REVIEW_ROLE02', institutionId: source, roleId: 'ROLE-02' }, reservationId, body(pairs('PLATELETS')), key(), new Date()), 'V2_RESERVATION_NOT_FOUND');
  await rejects(service.verify({ ...receiver, roleId: 'ROLE-04' }, reservationId, body(pairs('PLATELETS')), key(), new Date()), 'AUTH_SCOPE_FORBIDDEN');
  check(await scalar('SELECT count(*) FROM app.v2_receipt_verifications'), 0, 'rejected verifications store nothing');

  const successKey = key(), success = body(pairs('PLATELETS').reverse());
  const evidence = await service.verify(receiver, reservationId, success, successKey, new Date());
  check(evidence.policyVersion, 'INBOUND_RECEIPT_LABEL_VERIFICATION_V1'); check(evidence.replayed, false); check(evidence.matchedUnits, 2); check(evidence.reservationVersion, 4);
  assert.match(evidence.evidenceId, /^RCV_[A-F0-9]{40}$/); assert.match(evidence.evidenceDigest, /^[0-9a-f]{64}$/); assertions += 2;
  assert.deepEqual(evidence.componentIds, ['COMP_RECEIPT_PROBE_0', 'COMP_RECEIPT_PROBE_1']); assertions++;
  const replay = await service.verify(receiver, reservationId, success, successKey, new Date(Date.now() + 60_000));
  check(replay.replayed, true); check(replay.evidenceId, evidence.evidenceId); check(replay.evidenceDigest, evidence.evidenceDigest);
  await rejects(service.verify(receiver, reservationId, body(pairs('PLATELETS', [labels[0]])), successKey, new Date()), 'RECEIPT_VERIFICATION_IDEMPOTENCY_CONFLICT');

  // The stored evidence binds this reservation, version and receiving institution, and nothing else.
  const stored = await service.findEvidence(evidence.evidenceId);
  assertReceiptEvidence(stored, { evidenceDigest: evidence.evidenceDigest, reservationId, expectedVersion: 4, institutionId: destination }); assertions++;
  assert.throws(() => assertReceiptEvidence(stored, { evidenceDigest: evidence.evidenceDigest, reservationId, expectedVersion: 5, institutionId: destination }), (error) => error.code === 'RECEIPT_EVIDENCE_INVALID'); assertions++;
  assert.throws(() => assertReceiptEvidence(stored, { evidenceDigest: evidence.evidenceDigest, reservationId, expectedVersion: 4, institutionId: source }), (error) => error.code === 'RECEIPT_EVIDENCE_INVALID'); assertions++;
  check(await service.findEvidence('RCV_' + '0'.repeat(40)), null);
  const rows = JSON.stringify((await admin.query('SELECT * FROM app.v2_receipt_verifications')).rows);
  assert.ok(!labels.some((label) => rows.includes(label)), 'label values must never be stored'); assertions++;
  check(await scalar('SELECT count(*) FROM app.v2_receipt_verifications'), 1);
  // Verification registers no stock and changes no custody state.
  check(await scalar("SELECT count(*) FROM app.v2_components WHERE reservation_id=$1 AND inventory_status='IN_TRANSIT' AND institution_id=$2", [reservationId, source]), 2);
  check(await scalar('SELECT version FROM app.v2_reservations WHERE reservation_id=$1', [reservationId]), 4);

  // Not in transit: a reservation in another state cannot be verified for receipt.
  await admin.query("UPDATE app.v2_reservations SET status='RECEIVED' WHERE reservation_id=$1", [reservationId]);
  await rejects(service.verify(receiver, reservationId, body(pairs('PLATELETS')), key(), new Date()), 'RESERVATION_TRANSITION_INVALID');

  // Remove the disposable rows so later preservation fingerprints in this harness stay exact.
  await admin.query('DELETE FROM app.v2_receipt_verifications WHERE reservation_id=$1', [reservationId]);
  await admin.query('DELETE FROM app.v2_components WHERE reservation_id=$1', [reservationId]);
  await admin.query("DELETE FROM app.v2_donations WHERE donation_id LIKE 'DON_RECEIPT_PROBE_%'");
  await admin.query('DELETE FROM app.v2_reservations WHERE reservation_id=$1', [reservationId]);
  await admin.query('DELETE FROM app.v2_transfer_requests WHERE transfer_id=$1', [transferId]);
  await admin.query('DELETE FROM app.v2_commands WHERE command_id=$1', [commandId]);
  console.log(`Receipt verification probe passed with ${assertions} assertions`);
}
