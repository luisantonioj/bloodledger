#!/usr/bin/env node
// Private, explicitly invoked maintenance tool. Never sends credentials to Git, logs or a network service.
import {randomBytes,randomInt,createHash} from 'node:crypto';
import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {Pool} from 'pg';
import {databaseConfig} from '../../database/scripts/database-environment.mjs';
import {deriveVerifier,verifyPassword} from '../../services/api/build/src/session.js';
import {domainFingerprints} from '../../services/api/build/src/account-migration.js';
const [action,...argv]=process.argv.slice(2);const opts={};for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])throw Error('OPTIONS_INVALID');opts[argv[i].slice(2)]=argv[i+1];}
if(!['generate','check','apply'].includes(action))throw Error('Use generate, check or apply; see scripts/institution-accounts/SHARED-CREDENTIALS.md');
const file=resolve(opts.file??'build/accounts/shared-credentials.json');const rel=relative(process.cwd(),file);
if(!rel.startsWith('build/')||rel.includes('..'))throw Error('PRIVATE_BUILD_PATH_REQUIRED');
if(!['bloodledger_dev','bloodledger_credentials_test'].includes(databaseConfig.database))throw Error('LOCAL_DATABASE_TARGET_REQUIRED');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const pool=new Pool({...databaseConfig,max:1});const db=await pool.connect();
const accountSql="SELECT u.user_id AS account_id,u.username,u.institution_id FROM app.application_users u JOIN app.institutions i USING(institution_id) WHERE u.account_kind='PRIMARY' AND u.status='ACTIVE' AND i.status='ACTIVE' ORDER BY u.user_id";
const operatorSql="SELECT o.operator_id,o.account_id,o.institution_id,o.role_id,o.capability_profile FROM app.institution_operators o JOIN app.application_users u ON u.user_id=o.operator_id JOIN app.institutions i ON i.institution_id=o.institution_id WHERE o.status='ACTIVE' AND u.status='ACTIVE' AND i.status='ACTIVE' ORDER BY o.operator_id";
const mapping=async()=>({accounts:(await db.query(accountSql)).rows,operators:(await db.query(operatorSql)).rows});
function validate(bundle){
 if(bundle.format!=='BLOODLEDGER_SHARED_CREDENTIALS_V1'||bundle.classification!=='SIMULATION_ONLY'||bundle.pinPolicyVersion!=='SYNTHETIC_OPERATOR_PIN_6_V1'||!/^CREDS_[0-9A-F]{32}$/.test(bundle.bundleId)||!Array.isArray(bundle.accounts)||!Array.isArray(bundle.operators))throw Error('BUNDLE_INVALID');
 if(bundle.passwordPolicyVersion!==undefined&&bundle.passwordPolicyVersion!=='SYNTHETIC_ACCOUNT_PASSWORD_12_V1')throw Error('BUNDLE_PASSWORD_POLICY_INVALID');
 if(!bundle.accounts.length||!bundle.operators.length)throw Error('BUNDLE_EMPTY');
 const accounts=bundle.accounts.map(r=>r.account_id).sort(),operators=bundle.operators.map(r=>r.operator_id).sort();
 if(JSON.stringify(Object.keys(bundle.passwords).sort())!==JSON.stringify(accounts)||JSON.stringify(Object.keys(bundle.pins).sort())!==JSON.stringify(operators)||new Set(accounts).size!==accounts.length||new Set(operators).size!==operators.length)throw Error('BUNDLE_KEYS_INVALID');
 if(Object.values(bundle.passwords).some(v=>typeof v!=='string'||(bundle.passwordPolicyVersion==='SYNTHETIC_ACCOUNT_PASSWORD_12_V1'?v.length!==12:v.length<24||v.length>128))||Object.values(bundle.pins).some(v=>typeof v!=='string'||!/^\d{6}$/.test(v)))throw Error('BUNDLE_CREDENTIAL_FORMAT_INVALID');
 if(new Set(Object.values(bundle.passwords)).size!==accounts.length||new Set(Object.values(bundle.pins)).size!==operators.length)throw Error('DISTINCT_ACCOUNT_AND_OPERATOR_CREDENTIALS_REQUIRED');
 for(const o of bundle.operators)if(!accounts.includes(o.account_id))throw Error('BUNDLE_OPERATOR_SCOPE_INVALID');
}
async function verifyCurrent(bundle){
 for(const account of bundle.accounts){const r=(await db.query('SELECT password_salt,password_verifier FROM app.application_users WHERE user_id=$1',[account.account_id])).rows[0];if(!await verifyPassword(bundle.passwords[account.account_id],{saltHex:r.password_salt,verifierHex:r.password_verifier}))throw Error('APPLIED_CREDENTIAL_DRIFT');}
 for(const operator of bundle.operators){const r=(await db.query('SELECT pin_salt,pin_verifier FROM app.institution_operators WHERE operator_id=$1',[operator.operator_id])).rows[0];if(!await verifyPassword(bundle.pins[operator.operator_id],{saltHex:r.pin_salt,verifierHex:r.pin_verifier}))throw Error('APPLIED_CREDENTIAL_DRIFT');}
}
try{
 if(action==='generate'){
  const roster=await mapping();let previous;
  if(opts['preserve-pins-from']){
   const source=resolve(opts['preserve-pins-from']);if(!relative(process.cwd(),source).startsWith('build/'))throw Error('PRIVATE_BUILD_PATH_REQUIRED');
   if((await stat(source)).mode&0o077)throw Error('PRIVATE_FILE_MODE_0600_REQUIRED');
   const bytes=await readFile(source);if(!opts['previous-sha256']||digest(bytes)!==opts['previous-sha256'])throw Error('PREVIOUS_BUNDLE_SHA256_MISMATCH');
   previous=JSON.parse(bytes);validate(previous);
   if(JSON.stringify(roster)!==JSON.stringify({accounts:previous.accounts,operators:previous.operators}))throw Error('HOST_ACCOUNT_OPERATOR_MAPPING_MISMATCH_NO_WRITES');
  }
  const pins=previous?{...previous.pins}:{};for(const o of roster.operators){if(previous)continue;let pin;do{pin=String(randomInt(1_000_000)).padStart(6,'0');}while(Object.values(pins).includes(pin));pins[o.operator_id]=pin;}
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const password=()=>Array.from({length:12},()=>alphabet[randomInt(alphabet.length)]).join('');
  const bundle={format:'BLOODLEDGER_SHARED_CREDENTIALS_V1',classification:'SIMULATION_ONLY',bundleId:'CREDS_'+randomBytes(16).toString('hex').toUpperCase(),createdAt:new Date().toISOString(),pinPolicyVersion:'SYNTHETIC_OPERATOR_PIN_6_V1',passwordPolicyVersion:'SYNTHETIC_ACCOUNT_PASSWORD_12_V1',...(previous?{supersedesBundleId:previous.bundleId}:{}),...roster,passwords:Object.fromEntries(roster.accounts.map(a=>[a.account_id,password()])),pins};validate(bundle);
  await mkdir(dirname(file),{recursive:true,mode:0o700});const bytes=JSON.stringify(bundle,null,2)+'\n';await writeFile(file,bytes,{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({generated:true,file:rel,sha256:digest(bytes),accounts:roster.accounts.length,operators:roster.operators.length,pinLength:6,passwordLength:12,pinsPreserved:Boolean(previous)}));
 }else{
  const info=await stat(file);if(info.mode&0o077)throw Error('PRIVATE_FILE_MODE_0600_REQUIRED');const bytes=await readFile(file);const sha=digest(bytes);if(!opts.sha256||opts.sha256!==sha)throw Error('BUNDLE_SHA256_MISMATCH');const bundle=JSON.parse(bytes);validate(bundle);
  const roster=await mapping();if(JSON.stringify(roster)!==JSON.stringify({accounts:bundle.accounts,operators:bundle.operators}))throw Error('HOST_ACCOUNT_OPERATOR_MAPPING_MISMATCH_NO_WRITES');
  if(action==='check'){console.log(JSON.stringify({compatible:true,sha256:sha,accounts:bundle.accounts.length,operators:bundle.operators.length,pinLength:6,database:databaseConfig.database}));}
  else{
   if(opts['confirm-target']!==databaseConfig.database||!opts.backup)throw Error('TARGET_AND_BACKUP_REQUIRED');
   const backup=await stat(opts.backup);if(backup.mode&0o077)throw Error('PRIVATE_BACKUP_REQUIRED');const dump=await readFile(opts.backup);if(dump.length<100||dump.subarray(0,5).toString()!=='PGDMP')throw Error('CUSTOM_FORMAT_BACKUP_REQUIRED');
   await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['SHARED_CREDENTIAL_ROTATION']);
   await db.query('LOCK TABLE app.application_users,app.institution_operators,app.application_sessions,app.operator_verifications,app.account_audit IN SHARE ROW EXCLUSIVE MODE');
   if(JSON.stringify(await mapping())!==JSON.stringify(roster))throw Error('HOST_IDENTITY_DRIFT');
   const pending=await db.query("SELECT (SELECT count(*) FROM app.v2_commands WHERE status NOT IN ('COMMITTED','FAILED','CONFLICT'))+(SELECT count(*) FROM app.scan_events WHERE status<>'COMMITTED')+(SELECT count(*) FROM app.operational_stock_runs WHERE writer_lock) AS n");if(Number(pending.rows[0].n))throw Error('PENDING_COMMANDS_OR_POPULATION_LOCK');
   const prior=await db.query("SELECT payload_sha256 FROM app.account_audit WHERE action='APPLY_SHARED_CREDENTIALS' AND subject_id=$1",[bundle.bundleId]);
   if(prior.rowCount){if(prior.rows[0].payload_sha256!==sha)throw Error('BUNDLE_REPLAY_CONFLICT');await verifyCurrent(bundle);await db.query('COMMIT');console.log(JSON.stringify({applied:true,replayed:true,bundleId:bundle.bundleId}));}
   else{
    const before=await domainFingerprints(db);
    for(const name of Object.keys(before)){if(!/^[a-z0-9_]+$/.test(name))throw Error('TABLE_INVALID');await db.query(`LOCK TABLE app.${name} IN SHARE MODE`);}
    for(const account of bundle.accounts){const salt=randomBytes(16).toString('hex');await db.query("UPDATE app.application_users SET password_algorithm='SCRYPT_V1',password_salt=$2,password_verifier=$3,credential_version=credential_version+1 WHERE user_id=$1",[account.account_id,salt,await deriveVerifier(bundle.passwords[account.account_id],salt)]);}
    let operatorsUpdated=0;
    for(const operator of bundle.operators){
     const current=(await db.query('SELECT pin_salt,pin_verifier FROM app.institution_operators WHERE operator_id=$1',[operator.operator_id])).rows[0];
     if(await verifyPassword(bundle.pins[operator.operator_id],{saltHex:current.pin_salt,verifierHex:current.pin_verifier}))continue;
     const salt=randomBytes(16).toString('hex');await db.query('UPDATE app.institution_operators SET pin_salt=$2,pin_verifier=$3,version=version+1,failed_attempts=0,locked_until=NULL WHERE operator_id=$1',[operator.operator_id,salt,await deriveVerifier(bundle.pins[operator.operator_id],salt)]);operatorsUpdated++;
    }
    const accountIds=bundle.accounts.map(a=>a.account_id);
    const sessions=await db.query("UPDATE app.application_sessions SET revoked_at=coalesce(revoked_at,now()),safe_revocation_reason=coalesce(safe_revocation_reason,'SECURITY_REVOCATION') WHERE user_id=ANY($1) AND revoked_at IS NULL",[accountIds]);
    const grants=await db.query('UPDATE app.operator_verifications SET revoked_at=coalesce(revoked_at,now()) WHERE account_id=ANY($1) AND revoked_at IS NULL',[accountIds]);
    await verifyCurrent(bundle);if(JSON.stringify(await domainFingerprints(db))!==JSON.stringify(before))throw Error('DOMAIN_RECORD_DRIFT');
    const result={bundleId:bundle.bundleId,accounts:bundle.accounts.length,operators:bundle.operators.length,pinLength:6,operatorsUpdated,...(bundle.passwordPolicyVersion?{passwordLength:12}:{}),revokedSessions:sessions.rowCount,revokedVerifications:grants.rowCount,domainRecordsUnchanged:true};
    const maintenanceActor='USR_LOCAL_CREDENTIAL_MAINTENANCE';
    await db.query("INSERT INTO app.account_audit(audit_id,actor_id,actor_institution_id,subject_id,action,reason_code,correlation_id,idempotency_key,payload_sha256,result,created_at) VALUES($1,$2,$3,$4,'APPLY_SHARED_CREDENTIALS','USER_AUTHORIZED_LOCAL_MAINTENANCE',$5,$6,$7,$8,now())",['AUD_'+randomBytes(20).toString('hex').toUpperCase(),maintenanceActor,null,bundle.bundleId,'CORR_'+randomBytes(16).toString('hex').toUpperCase(),'IDEM_'+bundle.bundleId,sha,result]);
    await db.query('COMMIT');console.log(JSON.stringify({applied:true,replayed:false,...result,backupSha256:digest(dump)}));
   }
  }
 }
}catch(error){await db.query('ROLLBACK').catch(()=>{});console.error(error instanceof Error?error.message:'CREDENTIAL_SYNC_FAILED');process.exitCode=1;}finally{db.release();await pool.end();}
