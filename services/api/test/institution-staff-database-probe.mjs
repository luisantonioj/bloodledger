// PA-STAFF-01 / FR-12: disposable PostgreSQL only. No retained accounts or ledger writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Client,Pool} from 'pg';
import {runner} from 'node-pg-migrate';
import {InstitutionStaff} from '../build/src/institution-staff.js';
import {staffLedgerAuthorization} from '../build/src/staff-ledger-authorization.js';
const database='bloodledger_staff_test',connection={host:'127.0.0.1',port:56541,database};
const admin=new Client({...connection,user:'postgres'});await admin.connect();let runtime;
let checks=0;
const equal=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const rejected=async(promise,code)=>{await assert.rejects(promise,e=>e.code===code);checks++;};
const corr='CORR_'+'A'.repeat(32),now=new Date(),key=n=>'IDEM_STAFF_PROBE_'+n;
try{
 equal((await admin.query('SELECT current_database() AS name')).rows[0].name,database);
 await admin.query('CREATE ROLE bloodledger_migrator LOGIN;CREATE ROLE bloodledger_app LOGIN;GRANT bloodledger_migrator TO postgres;ALTER DATABASE bloodledger_staff_test OWNER TO bloodledger_migrator;SET ROLE bloodledger_migrator');
 const applied=await runner({dbClient:admin,direction:'up',dir:new URL('../../../database/migrations',import.meta.url).pathname,ignorePattern:'README\\.md',migrationsSchema:'public',migrationsTable:'pgmigrations',log:()=>{}});await admin.query('RESET ROLE');
 for(const [tag,category] of [['BANK','BLOOD_BANK'],['REQUESTER','REQUESTOR'],['OTHER','BLOOD_BANK'],['PRC','PRC']]){
  const institution='INST_STAFF_'+tag,account='USR_STAFF_ACCOUNT_'+tag,actor='USR_STAFF_ADMIN_'+tag,session='SESS_'+tag.charCodeAt(0).toString(16).toUpperCase().repeat(20);
  await admin.query("INSERT INTO app.institutions(institution_id,display_name,category,status,account_category,account_model) VALUES($1,'Synthetic Staff Fixture','HOSPITAL','ACTIVE',$2,'INSTITUTION_V1')",[institution,category]);
  for(const [id,kind] of [[account,'PRIMARY'],[actor,'OPERATOR']])await admin.query("INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,account_kind) VALUES($1,$2,'Synthetic Staff Fixture',$3,'SCRYPT_V1',repeat('0',32),repeat('0',128),'ACTIVE',$4)",[id,'synth_staff_'+id.toLowerCase(),institution,kind]);
  await admin.query("INSERT INTO app.institution_operators(operator_id,account_id,institution_id,role_id,capability_profile,status,pin_salt,pin_verifier) VALUES($1,$2,$3,'ROLE-06','INSTITUTION_ADMIN','ACTIVE',repeat('0',32),repeat('0',128))",[actor,account,institution]);
  await admin.query("INSERT INTO app.application_sessions(session_id,user_id,token_digest,issued_at,expires_at,policy_version) VALUES($1,$2,$3,$4,$5,'SYNTHETIC_WEB_ACCESS_V1')",[session,account,createHash('sha256').update(tag).digest('hex'),new Date(now.getTime()-60000),new Date(now.getTime()+600000)]);
 }
 runtime=new Pool({...connection,user:'bloodledger_app'});const service=new InstitutionStaff(runtime,'synthetic-disposable-staff-audit-key');
 function principal(tag){return {userId:'USR_STAFF_ADMIN_'+tag,operatorId:'USR_STAFF_ADMIN_'+tag,accountId:'USR_STAFF_ACCOUNT_'+tag,institutionId:'INST_STAFF_'+tag,accountCategory:tag==='BANK'||tag==='OTHER'?'BLOOD_BANK':tag==='REQUESTER'?'REQUESTOR':'PRC',roleId:'ROLE-06',operatorVersion:1,verificationSessionId:'SESS_'+tag.charCodeAt(0).toString(16).toUpperCase().repeat(20),administrativeCapabilities:['operators:manage']};}
 const bank=principal('BANK'),requester=principal('REQUESTER'),body={jobTitle:'Synthetic laboratory lead',institutionId:bank.institutionId,accessProfile:'ROLE',permissionSet:'ROLE-01',pin:'12743658',expectedVersion:1,correlationId:corr};
 await rejected(service.change(bank,bank.operatorId,'revoke',{expectedVersion:1,correlationId:corr},key('LAST'),now),'STAFF_LAST_ADMINISTRATOR');
 const staff=await service.create(bank,body,key('CREATE'),now);equal(staff.roleId,'ROLE-01');equal(staff.version,1);equal(staff.jobTitle,body.jobTitle);assert.match(staff.operatorId,/^USR_STAFF_[0-9A-F]{32}$/);checks++;
 equal(await service.create(bank,body,key('CREATE'),now),staff);
 await rejected(service.create(bank,{...body,pin:'12743659'},key('CREATE'),now),'STAFF_IDEMPOTENCY_CONFLICT');
 await rejected(service.create(bank,{...body,permissionSet:'ROLE-03'},key('BAD_ROLE'),now),'STAFF_PERMISSION_SET_INVALID');
 await rejected(service.create(bank,body,key('STALE'),now),'STAFF_VERSION_CONFLICT');
 await rejected(service.create(principal('PRC'),{...body,institutionId:'INST_STAFF_PRC'},key('PRC'),now),'STAFF_NOT_AUTHORIZED');
 await rejected(service.change(principal('OTHER'),staff.operatorId,'revoke',{expectedVersion:1,correlationId:corr},key('FOREIGN'),now),'STAFF_NOT_FOUND');
 const client=await runtime.connect();await client.query('BEGIN');
 const command={actorUserId:staff.operatorId,actorInstitutionId:bank.institutionId},payload={actorUserId:staff.operatorId,policyVersion:'SYNTHETIC_INSTITUTION_CORE_V1'};
 equal(Boolean((await staffLedgerAuthorization(client,command,payload))?.institution_staff_v1),true);await client.query('ROLLBACK');client.release();
 const revoke=await service.change(bank,staff.operatorId,'revoke',{expectedVersion:1,correlationId:corr},key('REVOKE'),now);equal(revoke.status,'REVOKED');
 const locked=await runtime.connect();await locked.query('BEGIN');await rejected(staffLedgerAuthorization(locked,command,payload),'STAFF_LEDGER_NOT_AUTHORIZED');await locked.query('ROLLBACK');locked.release();
 const approvalBody={expectedVersion:2,correlationId:corr},approval=await service.approveReset(bank,staff.operatorId,approvalBody,key('APPROVE'),now);
 equal(await service.approveReset(bank,staff.operatorId,approvalBody,key('APPROVE'),now),approval);
 await rejected(service.approveReset(bank,staff.operatorId,{...approvalBody,correlationId:'CORR_'+'B'.repeat(32)},key('APPROVE'),now),'STAFF_IDEMPOTENCY_CONFLICT');
 const resetBody={expectedVersion:2,correlationId:corr,pin:'84736251'},account={...bank,userId:bank.accountId};
 await rejected(service.consumeReset(account,'SESS_'+'F'.repeat(40),staff.operatorId,approval.approvalId,resetBody,key('RESET'),now),'STAFF_APPROVAL_INVALID');
 await rejected(service.consumeReset(account,bank.verificationSessionId,staff.operatorId,approval.approvalId,resetBody,key('RESET'),new Date(now.getTime()+120001)),'STAFF_APPROVAL_EXPIRED');
 const verified=await service.consumeReset(account,bank.verificationSessionId,staff.operatorId,approval.approvalId,resetBody,key('RESET'),now),reset=await service.change(verified,staff.operatorId,'reset-pin',resetBody,key('RESET'),now);equal(reset.status,'REVOKED');equal(reset.version,3);
 equal(await service.change(await service.consumeReset(account,bank.verificationSessionId,staff.operatorId,approval.approvalId,resetBody,key('RESET'),now),staff.operatorId,'reset-pin',resetBody,key('RESET'),now),reset);
 await rejected(service.consumeReset(account,bank.verificationSessionId,staff.operatorId,approval.approvalId,{...resetBody,pin:'98765432'},key('RESET'),now),'STAFF_APPROVAL_INVALID');
 equal((await service.change(bank,staff.operatorId,'restore',{expectedVersion:3,correlationId:corr},key('RESTORE'),now)).status,'ACTIVE');
 await rejected(service.change(bank,staff.operatorId,'restore',{expectedVersion:4,correlationId:corr},key('BAD_RESTORE'),now),'STAFF_TRANSITION_INVALID');
 const req=await service.create(requester,{...body,institutionId:requester.institutionId,permissionSet:'ROLE-03'},key('REQUESTER'),now);equal(req.roleId,'ROLE-03');
 const secondAdmin=await service.create(bank,{...body,jobTitle:'Synthetic administrator',accessProfile:'INSTITUTION_ADMIN',permissionSet:null,expectedVersion:2},key('ADMIN'),now);
 // Two attempts racing to remove both administrators must leave one active administrator.
 const secondPrincipal={...bank,userId:secondAdmin.operatorId,operatorId:secondAdmin.operatorId};
 const race=await Promise.allSettled([service.change(bank,secondAdmin.operatorId,'revoke',{expectedVersion:1,correlationId:corr},key('RACE_A'),now),service.change(secondPrincipal,bank.operatorId,'revoke',{expectedVersion:1,correlationId:corr},key('RACE_B'),now)]);
 equal(race.filter(r=>r.status==='fulfilled').length,1);equal(race.filter(r=>r.status==='rejected').every(r=>['STAFF_LAST_ADMINISTRATOR','AUTH_SESSION_REVOKED'].includes(r.reason.code)),true);equal(Number((await admin.query("SELECT count(*) AS n FROM app.institution_operators WHERE institution_id=$1 AND capability_profile='INSTITUTION_ADMIN' AND status='ACTIVE'",[bank.institutionId])).rows[0].n),1);
 equal(Number((await admin.query('SELECT count(*) AS n FROM app.v2_commands')).rows[0].n),0);
 equal(Number((await admin.query('SELECT count(*) AS n FROM app.v2_components')).rows[0].n),0);
 equal(Number((await admin.query("SELECT count(*) AS n FROM app.account_audit WHERE result::text LIKE '%12743658%' OR result::text LIKE '%84736251%'")).rows[0].n),0);
 console.log(JSON.stringify({passed:true,checks,migrations:applied.length,raceLastAdministratorGuard:true,pinResetPreservesRevoked:true,retainedDataUsed:false,liveCommands:0}));
}finally{if(runtime)await runtime.end();await admin.end();}
