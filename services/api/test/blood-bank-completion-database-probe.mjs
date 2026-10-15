// ADR-046/047 blood-bank completion probe on the disposable accounts database: real sessions and routes for
// the summary, network availability, request history and request decision state; the outbound verification
// service with synthetic labels on a disposable reservation. Synthetic data only.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PostgresOutboundVerification } from '../build/src/outbound-verification.js';
import { donationLookupHmac } from '../build/src/donation-crypto.js';

export async function probeBloodBankCompletion({ admin, runtime, app, sessions }) {
  let assertions = 0;
  const check = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++; };
  const read = (cookie, url) => app.inject({ method: 'GET', url, headers: { cookie } });
  const scalar = async (sql, params = []) => Number(Object.values((await admin.query(sql, params)).rows[0])[0]);

  // Summary: complete own-institution counts; label-expired stock separate; Expiring Soon policy-blocked.
  const summary = (await read(sessions.INST_MEDIATRIX, '/api/v2/dashboard/summary')).json();
  check(summary.policyVersion, 'BLOOD_BANK_SUMMARY_V1'); check(summary.scope, 'INSTITUTION');
  check(summary.inventory.available, await scalar("SELECT count(*) FROM app.v2_components WHERE institution_id='INST_MEDIATRIX' AND inventory_status='AVAILABLE' AND expires_at>now()"));
  check(summary.inventory.reserved, await scalar("SELECT count(*) FROM app.v2_components WHERE institution_id='INST_MEDIATRIX' AND inventory_status='RESERVED' AND expires_at>now()"));
  check(summary.requests.incomingAwaitingDecision, await scalar("SELECT count(*) FROM app.v2_transfer_requests t WHERE source_institution_id='INST_MEDIATRIX' AND status='PENDING' AND NOT EXISTS (SELECT 1 FROM app.v2_reservations r WHERE r.transfer_id=t.transfer_id)"));
  assert.deepEqual(summary.expiringSoon, { availability: 'POLICY_BLOCKED', count: null, blocker: 'RQ-03' }); assertions++;
  for (const denied of [sessions.DOH, sessions.PRC, sessions.REQUESTOR]) check((await read(denied, '/api/v2/dashboard/summary')).statusCode, 403);

  // Network availability: hospital roles only; complete city aggregate of label-current AVAILABLE units.
  const network = (await read(sessions.INST_MEDIATRIX, '/api/v2/network-availability')).json();
  check(network.scope, 'CITY_AGGREGATE'); check(network.policyVersion, 'NETWORK_AVAILABILITY_V1');
  check(network.rows.reduce((sum, row) => sum + row.availableUnits, 0), await scalar("SELECT count(*) FROM app.v2_components c JOIN app.institutions i USING(institution_id) WHERE c.inventory_status='AVAILABLE' AND c.expires_at>now() AND i.status='ACTIVE'"));
  check((await read(sessions.REQUESTOR, '/api/v2/network-availability')).statusCode, 200);
  check((await read(sessions.DOH, '/api/v2/network-availability')).statusCode, 403);

  // Request history: complete aggregate within a Manila date range; invalid ranges refused.
  const today = new Date().toISOString().slice(0, 10), yearAgo = new Date(Date.now() - 360 * 86_400_000).toISOString().slice(0, 10);
  const history = (await read(sessions.INST_MEDIATRIX, `/api/v2/analytics/request-history?from=${yearAgo}&to=${today}`)).json();
  check(history.policyVersion, 'REQUEST_HISTORY_AGGREGATE_V1'); check(history.departmentAvailability, 'NOT_RECORDED');
  check(history.rows.reduce((sum, row) => sum + row.requestCount, 0), await scalar("SELECT count(*) FROM app.v2_transfer_requests WHERE (source_institution_id='INST_MEDIATRIX' OR destination_institution_id='INST_MEDIATRIX') AND (request_time AT TIME ZONE 'Asia/Manila')::date BETWEEN $1::date AND $2::date", [yearAgo, today]));
  for (const query of ['from=2026-01-10&to=2026-01-01', 'from=2025-01-01&to=2026-06-01', 'from=2026-02-30&to=2026-03-01', '']) check((await read(sessions.INST_MEDIATRIX, `/api/v2/analytics/request-history?${query}`)).statusCode, 400);

  // Request decision state: a request is awaiting a decision only while it has no reservation.
  const transfers = (await read(sessions.INST_MEDIATRIX, '/api/v2/transfers')).json();
  for (const request of transfers.requests ?? []) {
    check(request.decision_state, request.reservation_id ? 'RESERVATION_RECORDED' : request.status === 'PENDING' ? 'AWAITING_DECISION' : request.status);
  }

  // Outbound verification on a disposable LOCAL_RELEASE reservation with two synthetic labels.
  const keyring = { encryptionKey: randomBytes(32), lookupKey: randomBytes(32), encryptionKeyVersion: 'v1' };
  const labels = ['MM26-10-9901', 'MM26-10-9902'], reservationId = 'RES_OUTBOUND_PROBE', correlation = 'CORR_' + 'B'.repeat(32);
  await admin.query("INSERT INTO app.v2_reservations(reservation_id,purpose,local_release_id,institution_id,status,correlation_id,version,classification) VALUES($1,'LOCAL_RELEASE','REL_OUTBOUND_PROBE','INST_MEDIATRIX','ACTIVE',$2,1,'SIMULATION_ONLY')", [reservationId, correlation]);
  for (const [index, label] of labels.entries()) {
    const hmac = donationLookupHmac(label, keyring), donation = `DON_OUTBOUND_PROBE_${index}`;
    await admin.query("INSERT INTO app.v2_donations(donation_id,issuer_institution_id,donation_number_ciphertext,donation_number_nonce,donation_number_auth_tag,donation_number_key_version,donation_number_lookup_hmac,created_by_user_id,created_at,updated_at,classification) VALUES($1,'INST_MEDIATRIX','FABRICATED_TEST_CIPHERTEXT',repeat('a',32),repeat('b',32),'TEST_ONLY',$2,'USR_SYNTH_REVIEW_ROLE01',now(),now(),'SIMULATION_ONLY')", [donation, hmac]);
    await admin.query("INSERT INTO app.v2_components(component_id,donation_id,issuer_institution_id,donation_number_lookup_hmac,component_type,blood_type,collected_at,expires_at,institution_id,inventory_status,reservation_purpose,reservation_id,ledger_version,ledger_transaction_id,correlation_id,policy_version,created_at,updated_at,classification) VALUES($1,$2,'INST_MEDIATRIX',$3,'PLATELETS','O_NEGATIVE',now()-interval '1 day',now()+interval '4 days','INST_MEDIATRIX','RESERVED','LOCAL_RELEASE',$4,2,$5,$6,'PERSISTENT_DEVELOPMENT_CORE_V1',now(),now(),'SIMULATION_ONLY')", [`COMP_OUTBOUND_PROBE_${index}`, donation, hmac, reservationId, 'e'.repeat(64), correlation]);
  }
  const service = new PostgresOutboundVerification(runtime, keyring);
  const operator = { userId: 'USR_SYNTH_REVIEW_ROLE02', displayName: 'Synthetic Operator', institutionId: 'INST_MEDIATRIX', institutionDisplayName: 'Synthetic Mediatrix', institutionCategory: 'HOSPITAL', roleId: 'ROLE-02', roleDisplayName: 'Verified operator', permissions: [], classification: 'SIMULATION_ONLY' };
  const body = (scannedLabels, expectedVersion = 1) => ({ expectedVersion, correlationId: 'CORR_' + randomBytes(16).toString('hex').toUpperCase(), scannedLabels });
  const key = () => `IDEM_OUTBOUND_${randomBytes(6).toString('hex').toUpperCase()}`;
  const rejects = async (promise, code) => { await assert.rejects(promise, (error) => error.code === code, code); assertions++; };
  await rejects(service.verify(operator, reservationId, body([labels[0], 'MM26-10-9999']), key(), new Date()), 'OUTBOUND_LABELS_MISMATCH');
  await rejects(service.verify(operator, reservationId, body([labels[0]]), key(), new Date()), 'OUTBOUND_LABELS_MISMATCH');
  await rejects(service.verify(operator, reservationId, body([labels[0], labels[0]]), key(), new Date()), 'OUTBOUND_LABEL_DUPLICATE');
  await rejects(service.verify(operator, reservationId, body(labels, 2), key(), new Date()), 'RESERVATION_VERSION_CONFLICT');
  await rejects(service.verify({ ...operator, institutionId: 'INST_SYNTH_MEDIX' }, reservationId, body(labels), key(), new Date()), 'V2_RESERVATION_NOT_FOUND');
  await rejects(service.verify({ ...operator, roleId: 'ROLE-03' }, reservationId, body(labels), key(), new Date()), 'AUTH_SCOPE_FORBIDDEN');
  const successKey = key(), successBody = body([...labels].reverse());
  const evidence = await service.verify(operator, reservationId, successBody, successKey, new Date());
  check(evidence.replayed, false); check(evidence.matchedUnits, 2); assert.match(evidence.evidenceId, /^EVD_[A-F0-9]{40}$/); assert.match(evidence.evidenceDigest, /^[0-9a-f]{64}$/); assertions += 2;
  assert.deepEqual(evidence.componentIds, ['COMP_OUTBOUND_PROBE_0', 'COMP_OUTBOUND_PROBE_1']); assertions++;
  const replay = await service.verify(operator, reservationId, successBody, successKey, new Date(Date.now() + 60_000));
  check(replay.replayed, true); check(replay.evidenceId, evidence.evidenceId); check(replay.evidenceDigest, evidence.evidenceDigest);
  await rejects(service.verify(operator, reservationId, body([labels[0], 'MM26-10-9999']), successKey, new Date()), 'OUTBOUND_VERIFICATION_IDEMPOTENCY_CONFLICT');
  const stored = JSON.stringify((await admin.query('SELECT * FROM app.v2_outbound_verifications')).rows);
  assert.ok(!labels.some((label) => stored.includes(label)), 'label values must never be stored'); assertions++;
  check(await scalar('SELECT count(*) FROM app.v2_outbound_verifications'), 1);
  // Remove the disposable reservation so later preservation fingerprints in this harness stay exact.
  await admin.query("DELETE FROM app.v2_outbound_verifications WHERE reservation_id=$1", [reservationId]);
  await admin.query("DELETE FROM app.v2_components WHERE reservation_id=$1", [reservationId]);
  await admin.query("DELETE FROM app.v2_donations WHERE donation_id LIKE 'DON_OUTBOUND_PROBE_%'");
  await admin.query("DELETE FROM app.v2_reservations WHERE reservation_id=$1", [reservationId]);
  console.log(`Blood-bank completion probe passed with ${assertions} assertions`);
}
