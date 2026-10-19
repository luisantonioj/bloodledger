// PA-DEF-07 SYNTHETIC_STOCK_CHECKPOINT_V1 probe on the disposable accounts database. Synthetic data only.
// A checkpoint counts only label-valid (unexpired) AVAILABLE/RESERVED stock, the first capture of a slot stands,
// a closed window is refused, and only active blood banks are scheduled.
import assert from 'node:assert/strict';
import { CensusWorker, PostgresCensusStore, STOCK_CHECKPOINT_POLICY_VERSION, checkpointInstitutionIds, checkpointSlots } from '../build/src/census-worker.js';
import { DOH_CENSUS_DISPLAY_ORDER } from '../build/src/report-policy.js';

export async function probeStockCheckpoints({ admin, runtime }) {
  let assertions = 0;
  const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
  const slot = checkpointSlots(new Date())[0], minutes = (value) => new Date(slot.getTime() + value * 60_000);
  const correlation = 'CORR_' + 'D'.repeat(32);
  const addUnit = async (suffix, expiresAt) => {
    await admin.query("INSERT INTO app.v2_donations(donation_id,issuer_institution_id,donation_number_ciphertext,donation_number_nonce,donation_number_auth_tag,donation_number_key_version,donation_number_lookup_hmac,created_by_user_id,created_at,updated_at,classification) VALUES($1,'INST_MEDIATRIX','FABRICATED_TEST_CIPHERTEXT',repeat('a',32),repeat('b',32),'TEST_ONLY',$2,'USR_SYNTH_REVIEW_ROLE01',now(),now(),'SIMULATION_ONLY')", [`DON_CHECKPOINT_${suffix}`, suffix.toLowerCase().padEnd(64, '0').slice(0, 64).replace(/[^0-9a-f]/g, 'a')]);
    await admin.query("INSERT INTO app.v2_components(component_id,donation_id,issuer_institution_id,donation_number_lookup_hmac,component_type,blood_type,collected_at,expires_at,institution_id,inventory_status,ledger_version,correlation_id,policy_version,created_at,updated_at,classification) VALUES($1,$2,'INST_MEDIATRIX',$3,'WHOLE_BLOOD','AB_NEGATIVE',$4,$5,'INST_MEDIATRIX','AVAILABLE',1,$6,'PERSISTENT_DEVELOPMENT_CORE_V1',now(),now(),'SIMULATION_ONLY')", [`COMP_CHECKPOINT_${suffix}`, `DON_CHECKPOINT_${suffix}`, suffix.toLowerCase().padEnd(64, '0').slice(0, 64).replace(/[^0-9a-f]/g, 'a'), new Date(slot.getTime() - 3 * 86_400_000), expiresAt, correlation]);
  };
  // Two label-valid units and one already past its printed expiry at the slot.
  await addUnit('C1', new Date(slot.getTime() + 10 * 86_400_000));
  await addUnit('C2', new Date(slot.getTime() + 10 * 86_400_000));
  await addUnit('C3', new Date(slot.getTime() - 3_600_000));

  const expected = async (at, unexpiredOnly) => Number((await admin.query(`SELECT count(*) FROM app.v2_components WHERE institution_id='INST_MEDIATRIX' AND inventory_status IN ('AVAILABLE','RESERVED') ${unexpiredOnly ? 'AND expires_at > $1' : 'AND $1::timestamptz IS NOT NULL'}`, [at])).rows[0].count);
  const total = (snapshot) => snapshot.groups.flatMap((group) => group.bloodTypes).reduce((sum, row) => sum + row.reportableCount, 0);
  const abNegativeWholeBlood = (snapshot) => snapshot.groups.find((group) => group.componentType === 'WHOLE_BLOOD').bloodTypes.find((row) => row.bloodType === 'AB_NEGATIVE').reportableCount;

  const store = new PostgresCensusStore(runtime, STOCK_CHECKPOINT_POLICY_VERSION, DOH_CENSUS_DISPLAY_ORDER);
  const first = await store.capture('INST_MEDIATRIX', slot, 'SCHEDULED', minutes(5));
  check(total(first), await expected(minutes(5), true), 'a checkpoint counts only unexpired AVAILABLE/RESERVED stock');
  assert.ok(await expected(minutes(5), false) > total(first), 'the expired fixture unit is excluded'); assertions++;
  check(abNegativeWholeBlood(first) >= 2, true, 'both label-valid fixture units are counted');
  check(first.reportPolicyVersion, STOCK_CHECKPOINT_POLICY_VERSION);

  // Stock changes inside the window; the slot keeps its first record and no second row is written.
  await addUnit('C4', new Date(slot.getTime() + 10 * 86_400_000));
  const again = await store.capture('INST_MEDIATRIX', slot, 'MANUAL', minutes(10));
  check(again.snapshotId, first.snapshotId); check(total(again), total(first));
  check(Number((await admin.query('SELECT count(*) FROM app.v2_census_snapshots WHERE snapshot_id=$1', [first.snapshotId])).rows[0].count), 1);

  // A closed window is refused, so present stock is never written under a past slot.
  await assert.rejects(store.capture('INST_MEDIATRIX', slot, 'MANUAL', minutes(31)), /CHECKPOINT_WINDOW_CLOSED/); assertions++;
  await assert.rejects(store.capture('INST_MEDIATRIX', checkpointSlots(slot)[1], 'SCHEDULED', minutes(5)), /CHECKPOINT_WINDOW_CLOSED/); assertions++;

  // Only active blood banks are scheduled.
  const banks = await checkpointInstitutionIds(runtime);
  check(banks.includes('INST_MEDIATRIX'), true);
  const categories = (await admin.query("SELECT DISTINCT account_category, status FROM app.institutions WHERE institution_id = ANY($1)", [banks])).rows;
  check(categories.every((row) => row.account_category === 'BLOOD_BANK' && row.status === 'ACTIVE'), true);
  // The scheduler outside any window records nothing.
  check((await new CensusWorker(store, banks, 30 * 60_000).runDueSlots(minutes(45))).length, 0);

  // Census records are immutable (V2_CENSUS_IMMUTABLE) and stay; remove only the fixture units so later
  // harness assertions see the original stock.
  await admin.query("DELETE FROM app.v2_components WHERE component_id LIKE 'COMP_CHECKPOINT_%'");
  await admin.query("DELETE FROM app.v2_donations WHERE donation_id LIKE 'DON_CHECKPOINT_%'");
  return assertions;
}
