// FR-01/12, TP-STOCK-01: versioned Jopia baseline; never runs on retained data.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {runner} from 'node-pg-migrate';
import {provisionSyntheticAccount} from '../build/src/synthetic-account.js';
import {applyAccountMigration,previewAccountMigration,domainFingerprints,OPERATOR_ROSTER,JOPIA_TWO_ACCOUNT_BASELINE} from '../build/src/account-migration.js';
import {accountPolicy} from '../build/src/institution-access.js';
if(process.env.POSTGRES_DB!=='bloodledger_accounts_test')throw new Error('ISOLATED_ACCOUNTS_TEST_REQUIRED');
const database='bloodledger_jopia_accounts_test';
const control=new Pool({host:'127.0.0.1',database:'bloodledger_accounts_test',user:'postgres'});
let pool;
try{
  await control.query(`CREATE DATABASE ${database} OWNER bloodledger_migrator`);
  pool=new Pool({host:'127.0.0.1',database,user:'bloodledger_migrator'});
  const client=await pool.connect();
  try{await runner({dbClient:client,direction:'up',dir:new URL('../../../database/migrations',import.meta.url).pathname,ignorePattern:'README\\.md',migrationsSchema:'public',migrationsTable:'pgmigrations',log:()=>{}});}finally{client.release();}
  const actors=[{userId:'USR_MEDIATRIX_TECH',institutionId:'INST_MEDIATRIX',roleId:'ROLE-02',institutionDisplayName:'Synthetic Mediatrix'},{userId:'USR_DIVINE_LOVE',institutionId:'INST_DIVINE_LOVE',roleId:'ROLE-03',institutionDisplayName:'Synthetic Divine Love'}];
  for(const actor of actors)await provisionSyntheticAccount(pool,{...actor,institutionCategory:'HOSPITAL',username:'synth_'+actor.userId.slice(4).toLowerCase(),userDisplayName:'Synthetic Existing Actor',password:randomBytes(24).toString('hex')});
  const identities=(await pool.query('SELECT user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier FROM app.application_users ORDER BY user_id')).rows;
  const roles=(await pool.query('SELECT * FROM app.user_role_assignments ORDER BY user_id')).rows;
  const target='a'.repeat(64);
  await assert.rejects(previewAccountMigration(pool,target),/PRINCIPAL/);
  await assert.rejects(previewAccountMigration(pool,target,'UNKNOWN'),/BASELINE_VERSION/);
  const manifest=await previewAccountMigration(pool,target,JOPIA_TWO_ACCOUNT_BASELINE);
  assert.equal(manifest.legacyBaselineVersion,JOPIA_TWO_ACCOUNT_BASELINE);
  await pool.query("UPDATE app.application_users SET institution_id='INST_MEDIATRIX' WHERE user_id='USR_DIVINE_LOVE'");
  await assert.rejects(previewAccountMigration(pool,target,JOPIA_TWO_ACCOUNT_BASELINE),/PRINCIPAL/);
  await pool.query("UPDATE app.application_users SET institution_id='INST_DIVINE_LOVE' WHERE user_id='USR_DIVINE_LOVE'");
  await provisionSyntheticAccount(pool,{...actors[0],userId:'USR_UNREVIEWED_NO_ROLE',username:'synth_unreviewed_no_role',institutionCategory:'HOSPITAL',userDisplayName:'Synthetic Unreviewed Actor',password:randomBytes(24).toString('hex')});
  await pool.query("DELETE FROM app.user_role_assignments WHERE user_id='USR_UNREVIEWED_NO_ROLE'");
  await assert.rejects(previewAccountMigration(pool,target,JOPIA_TWO_ACCOUNT_BASELINE),/PRINCIPAL/);
  await pool.query("DELETE FROM app.application_users WHERE user_id='USR_UNREVIEWED_NO_ROLE'");
  const credentials={passwords:Object.fromEntries(accountPolicy.accounts.map(a=>[a.accountId,randomBytes(24).toString('hex')])),pins:Object.fromEntries(OPERATOR_ROSTER.map(o=>[o.operatorId,'12345678']))};
  await assert.rejects(applyAccountMigration(pool,{...manifest,legacyBaselineVersion:undefined},target,credentials),/MANIFEST/);
  const before=await domainFingerprints(pool);
  const results=await Promise.all([applyAccountMigration(pool,manifest,target,credentials),applyAccountMigration(pool,manifest,target,credentials)]);
  assert.equal(results.filter(r=>r.replayed).length,1);
  assert.deepEqual(await domainFingerprints(pool),before);
  assert.deepEqual((await pool.query('SELECT user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier FROM app.application_users WHERE user_id=ANY($1::text[]) ORDER BY user_id',[actors.map(a=>a.userId)])).rows,identities);
  assert.deepEqual((await pool.query('SELECT * FROM app.user_role_assignments WHERE user_id=ANY($1::text[]) ORDER BY user_id',[actors.map(a=>a.userId)])).rows,roles);
  assert.equal((await pool.query("SELECT count(*)::int n FROM app.application_users WHERE account_kind='PRIMARY' AND status='ACTIVE'")).rows[0].n,6);
  assert.equal((await pool.query("SELECT count(*)::int n FROM app.application_users WHERE user_id=ANY($1::text[]) AND account_kind='RETIRED' AND status='RETIRED'",[actors.map(a=>a.userId)])).rows[0].n,2);
  assert.equal((await pool.query('SELECT count(*)::int n FROM app.institution_operators')).rows[0].n,OPERATOR_ROSTER.length);
  console.log('Jopia versioned two-account migration: preservation, mapping/version rejection, concurrent apply and replay PASS');
}finally{await pool?.end();await control.query(`DROP DATABASE IF EXISTS ${database}`);await control.end();}
