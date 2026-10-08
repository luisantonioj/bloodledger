import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { accountPolicy, type AccountPolicyEntry } from "./institution-access.js";
import { identityTransaction } from "./operator-verification.js";
import { deriveVerifier, verifyPassword } from "./session.js";
import { sha256 } from "./hash.js";

export const MIGRATION_ID = "INSTITUTION_ACCOUNTS_20261008_V1";
export const OPERATOR_ROSTER = [
  {operatorId:"USR_SYNTH_REVIEW_ROLE01",institutionId:"INST_MEDIATRIX",roleId:"ROLE-01",profile:"ROLE"},
  {operatorId:"USR_SYNTH_REVIEW_ROLE02",institutionId:"INST_MEDIATRIX",roleId:"ROLE-02",profile:"ROLE"},
  {operatorId:"USR_OP_6F506CBEB691D1F2F7C946A678C97A5E",institutionId:"INST_SYNTH_MEDIX",roleId:"ROLE-01",profile:"ROLE"},
  {operatorId:"USR_OP_BA806C9407FF05B6F3ECDA4D9CF4FCD9",institutionId:"INST_SYNTH_MEDIX",roleId:"ROLE-02",profile:"ROLE"},
  {operatorId:"USR_OP_B5115DC956C435754793A206CE37267C",institutionId:"INST_SYNTH_NLVILLA",roleId:"ROLE-01",profile:"ROLE"},
  {operatorId:"USR_OP_019748F191695C0648054E1DEAB1CFD5",institutionId:"INST_SYNTH_NLVILLA",roleId:"ROLE-02",profile:"ROLE"},
  {operatorId:"USR_OP_442D31C531892E2145033E6F18136B58",institutionId:"INST_SYNTH_METROLIPA",roleId:"ROLE-03",profile:"ROLE"},
  {operatorId:"USR_OP_655989F204F82E3BE56E4A6E95F4A625",institutionId:"INST_SYNTH_PRC",roleId:"ROLE-04",profile:"PRC_REVIEWER"},
  ...["INST_MEDIATRIX","INST_SYNTH_MEDIX","INST_SYNTH_NLVILLA","INST_SYNTH_METROLIPA"].map((institutionId,index)=>({operatorId:["USR_OP_B34296A58AEDF282FCDC718CB10686F7", "USR_OP_8DCF098530EA28C167A1A4F2DB52FB40", "USR_OP_47E1C0ECF9AB14D6770C30F69BE4A732", "USR_OP_09AAB77EE876646C281E156C8B9C3D41"][index]!,institutionId,roleId:"ROLE-06",profile:"INSTITUTION_ADMIN"})),
];
const LEGACY_INSTITUTIONS=["INST_MEDIATRIX","INST_MEDIATRIX","INST_SYNTH_SECONDARY_REVIEW","INST_SYNTH_REGULATOR_REVIEW","INST_SYNTH_SYSTEM_REVIEW","INST_SYNTH_SECONDARY_REVIEW"];
export interface PrivateAccountCredentials { passwords:Record<string,string>; pins:Record<string,string> }
export const JOPIA_TWO_ACCOUNT_BASELINE = "JOPIA_RETAINED_TWO_ACCOUNT_V1";
const JOPIA_LEGACY = [
  {userId:"USR_MEDIATRIX_TECH",institutionId:"INST_MEDIATRIX",roleId:"ROLE-02"},
  {userId:"USR_DIVINE_LOVE",institutionId:"INST_DIVINE_LOVE",roleId:"ROLE-03"},
];
export interface MigrationPreview { migrationId:string;targetDigest:string;mappingDigest:string;baselineFingerprints:Record<string,string>;identityFingerprints:Record<string,string>;manifestSha256:string;classification:"SIMULATION_ONLY";legacyBaselineVersion?:typeof JOPIA_TWO_ACCOUNT_BASELINE }
function migrationMapping(version?:string):Record<string,unknown>{
  if(version!==undefined&&version!==JOPIA_TWO_ACCOUNT_BASELINE)throw new Error("ACCOUNT_BASELINE_VERSION_INVALID");
  const original={accounts:accountPolicy.accounts,operators:OPERATOR_ROSTER,legacyInstitutions:LEGACY_INSTITUTIONS};
  return version?{accounts:accountPolicy.accounts,operators:OPERATOR_ROSTER,legacyBaselineVersion:version,legacyActors:JOPIA_LEGACY}:original;
}
export async function domainFingerprints(client:Pick<Pool,"query">):Promise<Record<string,string>>{
  const names=await client.query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema='app' AND table_type='BASE TABLE' ORDER BY table_name");
  const output:Record<string,string>={};
  for(const {table_name:name} of names.rows){
    if(["institutions","application_users","user_role_assignments","application_sessions","institution_account_migrations","institution_operators","operator_attempt_windows","operator_verifications","account_audit"].includes(name)||name.startsWith("onboarding_"))continue;
    // Names come from PostgreSQL's catalog, never from user input.
    if(!/^[a-z0-9_]+$/.test(name))throw new Error("ACCOUNT_FINGERPRINT_TABLE_INVALID");
    const rows=await client.query(`SELECT to_jsonb(t) AS row FROM app.${name} t`);
    output[name]=sha256(rows.rows.map(row=>sha256(row.row)).sort());
  }
  return output;
}
async function identityFingerprints(client:Pick<Pool,"query">):Promise<Record<string,string>>{
  const result:Record<string,string>={};
  for(const name of ["institutions","application_users","user_role_assignments","application_sessions"]){
    const rows=await client.query(`SELECT to_jsonb(t) AS row FROM app.${name} t`);
    result[name]=sha256(rows.rows.map(row=>sha256(row.row)).sort());
  }
  return result;
}
async function assertLegacy(client:Pick<Pool,"query">,version?:string):Promise<void>{
  migrationMapping(version);
  if(version===JOPIA_TWO_ACCOUNT_BASELINE){
    const rows=await client.query("SELECT u.user_id,u.institution_id,u.status,u.account_kind,r.role_id FROM app.application_users u JOIN app.user_role_assignments r USING(user_id) ORDER BY u.user_id");
    const userCount=(await client.query<{count:number}>("SELECT count(*)::int AS count FROM app.application_users")).rows[0]!.count;
    if(userCount!==2||rows.rows.length!==2||JOPIA_LEGACY.some(expected=>!rows.rows.some(row=>row.user_id===expected.userId&&row.institution_id===expected.institutionId&&row.role_id===expected.roleId&&row.status==="ACTIVE"&&row.account_kind==="LEGACY")))throw new Error("ACCOUNT_RETAINED_PRINCIPAL_MAPPING_MISMATCH");
    return;
  }
  const extra=await client.query("SELECT 1 FROM app.application_users u JOIN app.institutions i USING(institution_id) WHERE u.status='ACTIVE' AND u.account_kind='LEGACY' AND i.category<>'SYSTEM' AND u.user_id NOT IN ('USR_SYNTH_REVIEW_ROLE01','USR_SYNTH_REVIEW_ROLE02','USR_SYNTH_REVIEW_ROLE03','USR_SYNTH_REVIEW_ROLE04','USR_SYNTH_REVIEW_ROLE06') LIMIT 1");
  if(extra.rows.length)throw new Error("ACCOUNT_UNREVIEWED_INTERACTIVE_PRINCIPAL");
  for(let n=1;n<=6;n++){
    const id=`USR_SYNTH_REVIEW_ROLE0${n}`;
    const rows=await client.query<Record<string,unknown>>("SELECT u.institution_id,u.status,u.account_kind,r.role_id FROM app.application_users u JOIN app.user_role_assignments r USING(user_id) WHERE u.user_id=$1",[id]);
    const row=rows.rows[0];if(!row||row.institution_id!==LEGACY_INSTITUTIONS[n-1]||row.role_id!==`ROLE-0${n}`||row.status!=="ACTIVE"||row.account_kind!=="LEGACY")throw new Error("ACCOUNT_RETAINED_PRINCIPAL_MAPPING_MISMATCH");
  }
}
export async function previewAccountMigration(pool:Pool,targetDigest:string,legacyBaselineVersion?:typeof JOPIA_TWO_ACCOUNT_BASELINE):Promise<MigrationPreview>{
  if(!/^[0-9a-f]{64}$/.test(targetDigest))throw new Error("ACCOUNT_TARGET_REQUIRED");
  return identityTransaction(pool,async client=>{
    await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await assertLegacy(client,legacyBaselineVersion);
    const baselineFingerprints=await domainFingerprints(client);
    const mappingDigest=sha256(migrationMapping(legacyBaselineVersion));
    const unsigned={migrationId:MIGRATION_ID,targetDigest,mappingDigest,baselineFingerprints,identityFingerprints:await identityFingerprints(client),classification:"SIMULATION_ONLY" as const,...(legacyBaselineVersion?{legacyBaselineVersion}:{})};
    return {...unsigned,manifestSha256:sha256(unsigned)};
  });
}
async function insertUser(client:PoolClient,account:AccountPolicyEntry,userId:string,username:string,password:string,kind:string,roleId:string):Promise<void>{
  const prior=await client.query<Record<string,unknown>>("SELECT * FROM app.application_users WHERE user_id=$1 OR username=$2 FOR UPDATE",[userId,username]);
  if(prior.rows.length){
    const row=prior.rows[0];if(prior.rows.length!==1||row.user_id!==userId||row.institution_id!==account.institutionId||row.username!==username||row.account_kind!==kind||!await verifyPassword(password,{saltHex:String(row.password_salt),verifierHex:String(row.password_verifier)} as Parameters<typeof verifyPassword>[1]))throw new Error("ACCOUNT_CREDENTIAL_OR_ID_CONFLICT");
  }else{
    const salt=randomBytes(16).toString("hex");
    await client.query("INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,account_kind) VALUES($1,$2,$3,$4,'SCRYPT_V1',$5,$6,'ACTIVE',$7)",[userId,username,kind==="PRIMARY"?"Synthetic Institution Account":"Synthetic Operator",account.institutionId,salt,await deriveVerifier(password,salt),kind]);
  }
  await client.query("INSERT INTO app.user_role_assignments(user_id,role_id,policy_version) VALUES($1,$2,'SYNTHETIC_WEB_ACCESS_V1') ON CONFLICT(user_id) DO NOTHING",[userId,roleId]);
}
export async function applyAccountMigration(pool:Pool,manifest:MigrationPreview,targetDigest:string,credentials:PrivateAccountCredentials,now=new Date()):Promise<{replayed:boolean;status:string}>{
  const {manifestSha256,...unsigned}=manifest;
  if(sha256(unsigned)!==manifestSha256||manifest.targetDigest!==targetDigest||manifest.mappingDigest!==sha256(migrationMapping(manifest.legacyBaselineVersion))||manifest.classification!=="SIMULATION_ONLY"||manifest.migrationId!==MIGRATION_ID)throw new Error("ACCOUNT_MANIFEST_OR_TARGET_MISMATCH");
  for(const account of accountPolicy.accounts)if(typeof credentials.passwords[account.accountId]!=="string"||credentials.passwords[account.accountId].length<12||credentials.passwords[account.accountId].length>128)throw new Error("ACCOUNT_PRIVATE_PASSWORD_REQUIRED");
  for(const operator of OPERATOR_ROSTER)if(!/^[0-9]{8}$/.test(credentials.pins[operator.operatorId]??""))throw new Error("ACCOUNT_PRIVATE_PIN_REQUIRED");
  return identityTransaction(pool,async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[MIGRATION_ID]);
    const prior=await client.query<Record<string,unknown>>("SELECT * FROM app.institution_account_migrations WHERE migration_id=$1",[MIGRATION_ID]);
    if(prior.rows[0]){
      if(prior.rows[0].target_digest!==targetDigest||prior.rows[0].mapping_digest!==manifest.mappingDigest||prior.rows[0].status!=="APPLIED")throw new Error("ACCOUNT_MIGRATION_CONFLICT");
      return {replayed:true,status:"APPLIED"};
    }
    // Prevent writes racing the frozen domain fingerprints or account disposition.
    await client.query("LOCK TABLE app.application_users,app.institutions,app.application_sessions,app.user_role_assignments IN SHARE ROW EXCLUSIVE MODE");
    const domainNames=Object.keys(manifest.baselineFingerprints);
    for(const name of domainNames){if(!/^[a-z0-9_]+$/.test(name))throw new Error("ACCOUNT_TABLE_INVALID");await client.query(`LOCK TABLE app.${name} IN SHARE MODE`);}
    await assertLegacy(client,manifest.legacyBaselineVersion);
    if(sha256(await domainFingerprints(client))!==sha256(manifest.baselineFingerprints))throw new Error("ACCOUNT_DOMAIN_DRIFT");
    if(sha256(await identityFingerprints(client))!==sha256(manifest.identityFingerprints))throw new Error("ACCOUNT_IDENTITY_DRIFT");
    // Retire all legacy operational interactive access; retained references never change.
    await client.query("UPDATE app.application_users SET account_kind=CASE WHEN user_id IN ('USR_SYNTH_REVIEW_ROLE01','USR_SYNTH_REVIEW_ROLE02') THEN 'OPERATOR' ELSE 'RETIRED' END,status=CASE WHEN user_id IN ('USR_SYNTH_REVIEW_ROLE01','USR_SYNTH_REVIEW_ROLE02') THEN 'ACTIVE' ELSE 'RETIRED' END,credential_version=credential_version+1 WHERE user_id IN ('USR_SYNTH_REVIEW_ROLE01','USR_SYNTH_REVIEW_ROLE02','USR_SYNTH_REVIEW_ROLE03','USR_SYNTH_REVIEW_ROLE04','USR_SYNTH_REVIEW_ROLE06')");
    await client.query("UPDATE app.application_users SET account_kind='INTERNAL' WHERE user_id='USR_SYNTH_REVIEW_ROLE05'");
    if(manifest.legacyBaselineVersion===JOPIA_TWO_ACCOUNT_BASELINE)await client.query("UPDATE app.application_users SET account_kind='RETIRED',status='RETIRED',credential_version=credential_version+1 WHERE user_id=ANY($1::text[])",[JOPIA_LEGACY.map(actor=>actor.userId)]);
    for(const account of accountPolicy.accounts){
      const category=["PRC","DOH"].includes(account.category)?"REGULATOR":"HOSPITAL";
      const display={INST_MEDIATRIX:"Synthetic Mediatrix",INST_SYNTH_MEDIX:"Synthetic Medix",INST_SYNTH_NLVILLA:"Synthetic NL Villa",INST_SYNTH_METROLIPA:"Synthetic Metro Lipa",INST_SYNTH_PRC:"Synthetic PRC",INST_SYNTH_DOH:"Synthetic DOH"}[account.institutionId]??"Synthetic Institution";
      await client.query("INSERT INTO app.institutions(institution_id,display_name,category,status,account_model,account_category) VALUES($1,$2,$3,'ACTIVE','INSTITUTION_V1',$4) ON CONFLICT(institution_id) DO NOTHING",[account.institutionId,display,category,account.category]);
      const inst=await client.query<Record<string,unknown>>("SELECT category,status,account_category FROM app.institutions WHERE institution_id=$1 FOR UPDATE",[account.institutionId]);
      if(inst.rows[0].category!==category||inst.rows[0].status!=="ACTIVE"||(inst.rows[0].account_category&&inst.rows[0].account_category!==account.category))throw new Error("ACCOUNT_INSTITUTION_CONFLICT");
      await client.query("UPDATE app.institutions SET account_model='INSTITUTION_V1',account_category=$2,version=version+1 WHERE institution_id=$1",[account.institutionId,account.category]);
      await insertUser(client,account,account.accountId,account.username,credentials.passwords[account.accountId],"PRIMARY",account.readRoleId);
    }
    for(const operator of OPERATOR_ROSTER){
      const account=accountPolicy.accounts.find(a=>a.institutionId===operator.institutionId)!;
      const retainedOperator=(await client.query("SELECT 1 FROM app.application_users WHERE user_id=$1",[operator.operatorId])).rows.length>0;
      if(!operator.operatorId.startsWith("USR_SYNTH_REVIEW_")||!retainedOperator)await insertUser(client,account,operator.operatorId,`synth_op_${operator.operatorId.slice(7).toLowerCase()}`,randomBytes(32).toString("base64url"),"OPERATOR",operator.roleId);
      const salt=randomBytes(16).toString("hex");
      await client.query("INSERT INTO app.institution_operators(operator_id,account_id,institution_id,role_id,capability_profile,status,pin_salt,pin_verifier) VALUES($1,$2,$3,$4,$5,'ACTIVE',$6,$7)",[operator.operatorId,account.accountId,operator.institutionId,operator.roleId,operator.profile,salt,await deriveVerifier(credentials.pins[operator.operatorId],salt)]);
    }
    await client.query("UPDATE app.application_sessions s SET revoked_at=COALESCE(revoked_at,$1),safe_revocation_reason=COALESCE(safe_revocation_reason,'SECURITY_REVOCATION') FROM app.application_users u WHERE s.user_id=u.user_id AND u.account_kind IN ('OPERATOR','RETIRED','PRIMARY')",[now]);
    if(sha256(await domainFingerprints(client))!==sha256(manifest.baselineFingerprints))throw new Error("ACCOUNT_DOMAIN_PRESERVATION_FAILED");
    await client.query("INSERT INTO app.institution_account_migrations(migration_id,target_digest,mapping_digest,baseline_fingerprints,status,applied_at) VALUES($1,$2,$3,$4,'APPLIED',$5)",[MIGRATION_ID,targetDigest,manifest.mappingDigest,manifest.baselineFingerprints,now]);
    return {replayed:false,status:"APPLIED"};
  });
}
export async function rollbackAccountMigration(pool:Pool,targetDigest:string,now=new Date()):Promise<void>{
  await identityTransaction(pool,async client=>{
    const rows=await client.query<Record<string,unknown>>("SELECT * FROM app.institution_account_migrations WHERE migration_id=$1 FOR UPDATE",[MIGRATION_ID]);
    if(!rows.rows[0]||rows.rows[0].target_digest!==targetDigest)throw new Error("ACCOUNT_TARGET_MISMATCH");
    if(rows.rows[0].status==='ROLLED_BACK')return;
    const institutions=accountPolicy.accounts.map(a=>a.institutionId);
    const accounts=(await client.query<{user_id:string}>("SELECT user_id FROM app.application_users WHERE institution_id=ANY($1::text[]) AND account_kind='PRIMARY'",[institutions])).rows.map(r=>r.user_id);
    await client.query("UPDATE app.application_users SET status='SUSPENDED',credential_version=credential_version+1 WHERE account_kind='PRIMARY' AND user_id=ANY($1::text[])",[accounts]);
    await client.query("UPDATE app.application_sessions s SET revoked_at=COALESCE(revoked_at,$1),safe_revocation_reason=COALESCE(safe_revocation_reason,'SECURITY_REVOCATION') FROM app.application_users u WHERE s.user_id=u.user_id AND u.user_id=ANY($2::text[])",[now,accounts]);
    await client.query("UPDATE app.operator_verifications SET revoked_at=COALESCE(revoked_at,$1) WHERE account_id=ANY($2::text[])",[now,accounts]);
    await client.query("UPDATE app.institution_account_migrations SET status='ROLLED_BACK',rolled_back_at=$2 WHERE migration_id=$1",[MIGRATION_ID,now]);
  });
}
