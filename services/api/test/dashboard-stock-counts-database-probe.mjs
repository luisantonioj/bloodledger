// PA-REV-03 DASHBOARD_EXACT_STOCK_V1 probe on the disposable accounts database: every component status lands in
// exactly one exact count, label expiry is evaluated at the read time, other institutions and released units are
// excluded, and queued commands are reported but never counted. Synthetic data only.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PostgresBloodBankReader } from '../build/src/blood-bank-reads.js';
import { assembleStockCounts } from '../build/src/dashboard-stock-counts.js';

export async function probeDashboardStockCounts({ admin, runtime }) {
  let assertions = 0;
  const check = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++; };
  const bank = 'INST_SYNTH_SECONDARY_REVIEW', other = 'INST_MEDIATRIX', now = new Date();
  const reader = new PostgresBloodBankReader(runtime);
  const before = assembleStockCounts(bank, await reader.stockCounts(bank, now), now);
  // Reserved and in-custody statuses must reference a reservation (v2_components_reservation).
  await admin.query("INSERT INTO app.v2_commands(command_id,idempotency_key,payload_sha256,resource_type,resource_id,operation,payload,status,next_attempt_at,ledger_transaction_id,correlation_id,actor_user_id,actor_institution_id,accepted_at,updated_at,classification) VALUES('CMD_STOCK_PROBE_T','IDEM_STOCK_PROBE_T',repeat('e',64),'TRANSFER','TRF_STOCK_PROBE','SUBMIT_TRANSFER','{\"fixture\":true}','COMMITTED',now(),$1,$2,'USR_SYNTH_REVIEW_ROLE03',$3,now(),now(),'SIMULATION_ONLY')", [randomBytes(32).toString('hex'), 'CORR_' + 'E'.repeat(32), bank]);
  await admin.query("INSERT INTO app.v2_transfer_requests(transfer_id,command_id,source_institution_id,destination_institution_id,blood_type,component_type,quantity,urgency,request_time,status,ledger_version,ledger_transaction_id,correlation_id,classification) VALUES('TRF_STOCK_PROBE','CMD_STOCK_PROBE_T',$1,$2,'O_NEGATIVE','PLATELETS',1,'ROUTINE',now(),'PENDING',1,$3,$4,'SIMULATION_ONLY')", [bank, other, randomBytes(32).toString('hex'), 'CORR_' + 'E'.repeat(32)]);
  await admin.query("INSERT INTO app.v2_reservations(reservation_id,purpose,transfer_id,institution_id,status,correlation_id,version,classification) VALUES('RES_STOCK_PROBE','TRANSFER','TRF_STOCK_PROBE',$1,'ACTIVE',$2,1,'SIMULATION_ONLY')", [bank, 'CORR_' + 'E'.repeat(32)]);
  const reserved = new Set(['RESERVED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'COMPROMISED']);
  let index = 0;
  const unit = async (institution, status, expiresInHours, bloodType = 'O_NEGATIVE', component = 'PLATELETS') => {
    const id = `COMP_STOCK_PROBE_${index}`, donation = `DON_STOCK_PROBE_${index++}`;
    await admin.query("INSERT INTO app.v2_donations(donation_id,issuer_institution_id,donation_number_ciphertext,donation_number_nonce,donation_number_auth_tag,donation_number_key_version,donation_number_lookup_hmac,created_by_user_id,created_at,updated_at,classification) VALUES($1,'INST_MEDIATRIX','FABRICATED_TEST_CIPHERTEXT',repeat('a',32),repeat('b',32),'TEST_ONLY',$2,'USR_SYNTH_REVIEW_ROLE01',now(),now(),'SIMULATION_ONLY')", [donation, randomBytes(32).toString('hex')]);
    await admin.query("INSERT INTO app.v2_components(component_id,donation_id,issuer_institution_id,donation_number_lookup_hmac,component_type,blood_type,collected_at,expires_at,institution_id,inventory_status,reservation_purpose,reservation_id,ledger_version,ledger_transaction_id,correlation_id,policy_version,created_at,updated_at,classification) VALUES($1,$2,'INST_MEDIATRIX',$3,$4,$5,now()-interval '2 days',$6,$7,$8,$11,$12,1,$9,$10,'PERSISTENT_DEVELOPMENT_CORE_V1',now(),now(),'SIMULATION_ONLY')", [id, donation, randomBytes(32).toString('hex'), component, bloodType, new Date(now.getTime() + expiresInHours * 3_600_000), institution, status, randomBytes(32).toString('hex'), 'CORR_' + 'E'.repeat(32), reserved.has(status) ? 'TRANSFER' : null, reserved.has(status) ? 'RES_STOCK_PROBE' : null]);
  };
  // Seeded at the probe bank: two usable, one reserved, one each label-expired (available and reserved), and one per other status.
  await unit(bank, 'AVAILABLE', 48); await unit(bank, 'AVAILABLE', 1); await unit(bank, 'RESERVED', 24);
  await unit(bank, 'AVAILABLE', -1); await unit(bank, 'RESERVED', -2);
  await unit(bank, 'DISPATCHED', 24); await unit(bank, 'IN_TRANSIT', 24); await unit(bank, 'RECEIVED', 24);
  await unit(bank, 'EXPIRED', -5); await unit(bank, 'RECONCILIATION_HOLD', 24); await unit(bank, 'COMPROMISED', 24); await unit(bank, 'RELEASED', 24);
  await unit(other, 'AVAILABLE', 48); // another institution's unit is never counted here
  await admin.query("INSERT INTO app.v2_commands(command_id,idempotency_key,payload_sha256,resource_type,resource_id,operation,payload,status,next_attempt_at,correlation_id,actor_user_id,actor_institution_id,accepted_at,updated_at,classification) VALUES('CMD_STOCK_PROBE_Q','IDEM_STOCK_PROBE_Q',repeat('e',64),'TRANSFER','TRF_STOCK_PROBE_Q','SUBMIT_TRANSFER','{\"fixture\":true}','QUEUED',now(),$1,'USR_SYNTH_REVIEW_ROLE03',$2,now(),now(),'SIMULATION_ONLY')", ['CORR_' + 'E'.repeat(32), bank]);

  const after = assembleStockCounts(bank, await reader.stockCounts(bank, now), now);
  const cell = (result) => result.rows.find((row) => row.bloodType === 'O_NEGATIVE' && row.componentType === 'PLATELETS');
  const delta = (field) => cell(after)[field] - cell(before)[field];
  check(delta('available'), 2); check(delta('reserved'), 1); check(delta('labelExpiredPendingEvaluation'), 2);
  check(delta('outgoingInTransit'), 2); check(delta('received'), 1); check(delta('expired'), 1); check(delta('onHold'), 1); check(delta('compromised'), 1);
  check(after.totals.usable - before.totals.usable, 3, 'usable = available + reserved, label-current only');
  check(after.pendingCommands - before.pendingCommands, 1, 'a queued command is reported');
  check(after.totals.available - before.totals.available, 2, 'the queued command adds nothing to the counts');
  check(after.rows.length, 40);
  // The 1-hour unit becomes label-expired when evaluated two hours later; the ledger status is unchanged.
  const later = new Date(now.getTime() + 2 * 3_600_000);
  const shifted = assembleStockCounts(bank, await reader.stockCounts(bank, later), later);
  check(cell(shifted).available - cell(before).available, 1); check(cell(shifted).labelExpiredPendingEvaluation - cell(before).labelExpiredPendingEvaluation, 3);
  // Independent SQL agrees on the label-current available count for the whole institution.
  const direct = Number((await admin.query("SELECT count(*) FROM app.v2_components WHERE institution_id=$1 AND inventory_status='AVAILABLE' AND expires_at>$2", [bank, now])).rows[0].count);
  check(after.totals.available, direct);

  await admin.query("DELETE FROM app.v2_components WHERE component_id LIKE 'COMP_STOCK_PROBE_%'");
  await admin.query("DELETE FROM app.v2_donations WHERE donation_id LIKE 'DON_STOCK_PROBE_%'");
  await admin.query("DELETE FROM app.v2_reservations WHERE reservation_id='RES_STOCK_PROBE'");
  await admin.query("DELETE FROM app.v2_transfer_requests WHERE transfer_id='TRF_STOCK_PROBE'");
  await admin.query("DELETE FROM app.v2_commands WHERE command_id IN ('CMD_STOCK_PROBE_Q','CMD_STOCK_PROBE_T')");
  console.log(`Dashboard stock-count probe passed with ${assertions} assertions`);
}
