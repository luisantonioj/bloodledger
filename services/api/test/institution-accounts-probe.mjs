import assert from 'node:assert/strict';
import { seedPreservationFixture } from './institution-accounts-fixture.mjs';
import { randomBytes,randomInt } from 'node:crypto';
import { Pool } from 'pg';
import { provisionSyntheticAccount } from '../build/src/synthetic-account.js';
import { applyAccountMigration,previewAccountMigration,rollbackAccountMigration,domainFingerprints,OPERATOR_ROSTER } from '../build/src/account-migration.js';
import { accountPolicy } from '../build/src/institution-access.js';
import { buildApp } from '../build/src/app.js';
import { MemoryRepository } from '../build/test/test-support.js';
import { PostgresSessionRepository } from '../build/src/database-session.js';
import { PostgresOperatorVerification } from '../build/src/operator-verification.js';
import { PostgresV2CommandStore } from '../build/src/v2-command.js';
import { PostgresV2ProjectionReader } from '../build/src/database-v2.js';
import { PostgresDevelopmentReader } from '../build/src/development-read.js';
import { PostgresApplicationReadRepository } from '../build/src/database-application-read.js';
import { sha256 } from '../build/src/hash.js';

const database=process.env.POSTGRES_DB;
if(database!=='bloodledger_accounts_test')throw new Error('ISOLATED_ACCOUNTS_TEST_REQUIRED');
const common={host:'127.0.0.1',port:Number(process.env.POSTGRES_HOST_PORT??5432),database};
const admin=new Pool({...common,user:process.env.POSTGRES_MIGRATOR_USER,password:process.env.POSTGRES_MIGRATOR_PASSWORD});
const runtime=new Pool({...common,user:process.env.POSTGRES_APP_USER,password:process.env.POSTGRES_APP_PASSWORD});
const origin='http://127.0.0.1:5174',now=new Date();
const password=()=>randomBytes(24).toString('base64url');
const credentials={passwords:Object.fromEntries(accountPolicy.accounts.map(a=>[a.accountId,password()])),pins:Object.fromEntries(OPERATOR_ROSTER.map(o=>[o.operatorId,String(randomInt(0,100000000)).padStart(8,'0')]))};
const oldPasswords={};
let app;let assertions=0;
function check(actual,expected){assert.equal(actual,expected);assertions++;}
const fixtureInstitution=['INST_MEDIATRIX','INST_MEDIATRIX','INST_SYNTH_SECONDARY_REVIEW','INST_SYNTH_REGULATOR_REVIEW','INST_SYNTH_SYSTEM_REVIEW','INST_SYNTH_SECONDARY_REVIEW'];
const fixtureName=['Synthetic Mediatrix','Synthetic Mediatrix','Synthetic Recipient','Synthetic Regulator','Synthetic System','Synthetic Recipient'];
try{
  for(let n=1;n<=6;n++){
    const username=`synth_review_role0${n}`;oldPasswords[username]=password();
    await provisionSyntheticAccount(admin,{institutionId:fixtureInstitution[n-1],institutionDisplayName:fixtureName[n-1],institutionCategory:n===4?'REGULATOR':n===5?'SYSTEM':'HOSPITAL',userId:`USR_SYNTH_REVIEW_ROLE0${n}`,username,userDisplayName:`Synthetic Role ${n}`,roleId:`ROLE-0${n}`,password:oldPasswords[username]});
  }
  const snapshotId=await seedPreservationFixture(admin);
  check((await admin.query("SELECT count(*)::int n FROM app.synthetic_inventory_completed_units")).rows[0].n,522);
  check((await admin.query("SELECT count(*)::int n FROM app.v2_components")).rows[0].n,9);
  const config={host:'127.0.0.1',port:3000,jwtSecret:randomBytes(32).toString('hex'),operatorId:'USR_SYNTH_CAPTURE',operatorCredential:password(),workerConfigured:false,webOrigin:origin,webCookieSecure:false,activeWriteApiVersion:'v2'};
  const store=new PostgresV2CommandStore(runtime),projection=new PostgresV2ProjectionReader(runtime);
  app=await buildApp(new MemoryRepository(),config,()=>new Date(),new PostgresSessionRepository(runtime),new PostgresApplicationReadRepository(runtime),undefined,{store,projection,developmentRead:new PostgresDevelopmentReader(runtime)},new PostgresOperatorVerification(runtime));
  const login=async(username,pass)=>app.inject({method:'POST',url:'/api/v1/auth/session',headers:{origin},payload:{username,password:pass}});
  const cookie=r=>String(r.headers['set-cookie']).split(';')[0];
  const oldLogin=await login('synth_review_role02',oldPasswords.synth_review_role02);check(oldLogin.statusCode,200);const oldCookie=cookie(oldLogin);
  const target=sha256({database,classification:'SIMULATION_ONLY',fixture:'REPRESENTATIVE_NO_LIVE_LEDGER'});
  const preview=await previewAccountMigration(admin,target),before=await domainFingerprints(admin);
  await assert.rejects(applyAccountMigration(admin,preview,'0'.repeat(64),credentials),/TARGET/);
  const originalName=(await admin.query("SELECT display_name FROM app.application_users WHERE user_id='USR_SYNTH_REVIEW_ROLE01'")).rows[0].display_name;
  await admin.query("UPDATE app.application_users SET display_name='Synthetic changed preview' WHERE user_id='USR_SYNTH_REVIEW_ROLE01'");
  await assert.rejects(applyAccountMigration(admin,preview,target,credentials),/IDENTITY_DRIFT/);assertions++;
  await admin.query("UPDATE app.application_users SET display_name=$1 WHERE user_id='USR_SYNTH_REVIEW_ROLE01'",[originalName]);
  const applied=await Promise.all([applyAccountMigration(admin,preview,target,credentials),applyAccountMigration(admin,preview,target,credentials)]);check(applied.filter(r=>r.replayed).length,1);
  assert.deepEqual(await domainFingerprints(admin),before);assertions++;
  check((await admin.query("SELECT count(*)::int n FROM app.application_users WHERE account_kind='PRIMARY' AND status='ACTIVE'")).rows[0].n,6);
  check((await app.inject({method:'GET',url:'/api/v1/auth/session',headers:{cookie:oldCookie}})).statusCode,401);
  check((await login('synth_review_role02',oldPasswords.synth_review_role02)).statusCode,401);
  const sessions={};
  for(const entry of accountPolicy.accounts){
    const response=await login(entry.username,credentials.passwords[entry.accountId]);check(response.statusCode,200);sessions[entry.category==='BLOOD_BANK'?entry.institutionId:entry.category]=cookie(response);
    check(response.json().principal.institutionId,entry.institutionId);check(response.json().principal.accountCategory,entry.category);
    check(response.json().principal.permissions.includes('transfers:write'),false);
    check((await app.inject({method:'GET',url:'/api/v1/auth/session',headers:{cookie:cookie(response)}})).statusCode,200);
  }
  if(process.env.BLOODLEDGER_ACCOUNTS_BROWSER==='1'){
    const {chromium}=await import('@playwright/test');
    await app.listen({host:'127.0.0.1',port:5174});
    const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    try{
      const page=await browser.newPage();await page.goto(origin+'/api/v1/health');
      for(const entry of accountPolicy.accounts){
        const result=await page.evaluate(async ({username,password})=>{
          const login=await fetch('/api/v1/auth/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
          const principal=await (await fetch('/api/v1/auth/session')).json();
          const visibleCookie=document.cookie;
          const logout=await fetch('/api/v1/auth/session',{method:'DELETE'});
          const after=await fetch('/api/v1/auth/session');
          return {status:login.status,institutionId:principal.principal.institutionId,visibleCookie,logout:logout.status,after:after.status};
        },{username:entry.username,password:credentials.passwords[entry.accountId]});
        check(result.status,200);check(result.institutionId,entry.institutionId);check(result.visibleCookie.includes('bloodledger_session'),false);check(result.logout,204);check(result.after,401);
      }
    }finally{await browser.close();}
  }
  const duplicates=await Promise.allSettled([1,2].map(n=>admin.query("INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,account_kind) SELECT $1,$2,display_name,institution_id,password_algorithm,password_salt,password_verifier,'ACTIVE','PRIMARY' FROM app.application_users WHERE user_id='USR_ACCOUNT_MEDIATRIX'",[`USR_DUP_${n}`,`bloodbank@duplicate${n}.bloodledger`])));check(duplicates.filter(r=>r.status==='rejected').length,2);
  await assert.rejects(provisionSyntheticAccount(admin,{institutionId:'INST_MEDIATRIX',institutionDisplayName:'Synthetic Mediatrix',institutionCategory:'HOSPITAL',userId:'USR_LEGACY_BYPASS',username:'synth_legacy_bypass',userDisplayName:'Synthetic Bypass',roleId:'ROLE-01',password:password()}),/PRIMARY_REQUIRED/);
  const verify=async(accountCookie,operatorId,action,payload,key,pin=credentials.pins[operatorId])=>app.inject({method:'POST',url:'/api/v2/auth/operator-verifications',headers:{origin,cookie:accountCookie},payload:{operatorId,pin,action:`POST ${action}`,payload,idempotencyKey:key}});
  const transfer={bloodType:'A_POSITIVE',componentType:'PACKED_RED_BLOOD_CELLS',correlationId:'CORR_'+randomBytes(16).toString('hex').toUpperCase(),destinationInstitutionId:'INST_SYNTH_METROLIPA',sourceInstitutionId:'INST_SYNTH_MEDIX',eventTime:now.toISOString(),requestTime:now.toISOString(),quantity:1,transferId:'TRF_ACCOUNT_PROBE',urgency:'ROUTINE'};
  const metroOperator=OPERATOR_ROSTER.find(o=>o.institutionId==='INST_SYNTH_METROLIPA'&&o.roleId==='ROLE-03').operatorId;
  const prcOperator=OPERATOR_ROSTER.find(o=>o.profile==='PRC_REVIEWER').operatorId;
  const recipient=sessions.REQUESTOR,key='IDEM_ACCOUNT_TRANSFER';
  check((await app.inject({method:'POST',url:'/api/v2/transfers',headers:{origin,cookie:recipient,'idempotency-key':key,'x-bloodledger-contract-version':'V2.1'},payload:transfer})).statusCode,403);
  const proof=await verify(recipient,'USR_OP_442D31C531892E2145033E6F18136B58','/api/v2/transfers',transfer,key);check(proof.statusCode,200);
  const send=async(payload=transfer,verification=proof.json().verificationId)=>app.inject({method:'POST',url:'/api/v2/transfers',headers:{origin,cookie:recipient,'idempotency-key':key,'operator-verification':verification,'x-bloodledger-contract-version':'V2.1'},payload});
  check((await send({...transfer,quantity:2})).statusCode,403);
  check((await verify(recipient,metroOperator,'/api/v2/transfers',{...transfer,quantity:2},key)).statusCode,409);
  const request=await send();check(request.statusCode,202);check((await send()).json().replayed,true);
  const queued=(await runtime.query('SELECT actor_user_id,actor_institution_id,payload FROM app.v2_commands WHERE idempotency_key=$1',[key])).rows[0];check(queued.actor_user_id,'USR_OP_442D31C531892E2145033E6F18136B58');check(queued.payload.sourceInstitutionId,'INST_SYNTH_MEDIX');
  check((await app.inject({method:'GET',url:request.json().statusUrl,headers:{cookie:recipient}})).statusCode,200);
  check((await app.inject({method:'GET',url:request.json().statusUrl,headers:{cookie:sessions.INST_MEDIATRIX}})).statusCode,404);
  const adminPayload={transferId:'TRF_ACCOUNT_PROBE',correlationId:transfer.correlationId,eventTime:now.toISOString()};
  check((await verify(sessions.INST_MEDIATRIX,'USR_SYNTH_REVIEW_ROLE01','/api/v2/reservations',adminPayload,'IDEM_TECH_APPROVAL')).statusCode,403);
  check((await verify(sessions.INST_MEDIATRIX,'USR_OP_BA806C9407FF05B6F3ECDA4D9CF4FCD9','/api/v2/reservations',adminPayload,'IDEM_CROSS_OPERATOR')).statusCode,429);
  const unusedTech=await verify(sessions.INST_MEDIATRIX,'USR_SYNTH_REVIEW_ROLE01','/api/v2/inbound-captures',{},'IDEM_RESET_GRANT');check(unusedTech.statusCode,200);
  const wrong=credentials.pins.USR_SYNTH_REVIEW_ROLE01==='00000000'?'00000001':'00000000';
  for(let n=0;n<5;n++)check((await verify(sessions.INST_MEDIATRIX,'USR_SYNTH_REVIEW_ROLE01','/api/v2/inbound-captures',{},'IDEM_WRONG_PIN',wrong)).statusCode,429);
  check((await verify(sessions.INST_MEDIATRIX,'USR_SYNTH_REVIEW_ROLE01','/api/v2/inbound-captures',{},'IDEM_LOCKED')).json().error.code,'OPERATOR_PIN_LOCKED');
  check((await app.inject({method:'POST',url:'/api/v1/simulation/session',payload:{operatorId:config.operatorId,credential:config.operatorCredential}})).statusCode,403);
  check((await admin.query("SELECT failed_attempts FROM app.institution_operators WHERE operator_id='USR_SYNTH_REVIEW_ROLE01'")).rows[0].failed_attempts,5);
  const newPin=String(randomInt(0,100000000)).padStart(8,'0'),resetPath='/api/v2/onboarding/operators/USR_SYNTH_REVIEW_ROLE01/reset-pin',resetBody={expectedVersion:1,correlationId:'CORR_'+randomBytes(16).toString('hex').toUpperCase(),reasonCode:'CREDENTIAL_RESET',pin:newPin};
  const resetGrant=await verify(sessions.PRC,prcOperator,resetPath,resetBody,'IDEM_RESET_TECH');check(resetGrant.statusCode,200);
  check((await app.inject({method:'POST',url:resetPath,headers:{origin,cookie:sessions.PRC,'operator-verification':resetGrant.json().verificationId,'idempotency-key':'IDEM_RESET_TECH'},payload:resetBody})).statusCode,200);
  check((await app.inject({method:'GET',url:'/api/v1/auth/session',headers:{cookie:sessions.INST_MEDIATRIX}})).statusCode,401);
  const mediated=accountPolicy.accounts.find(a=>a.institutionId==='INST_MEDIATRIX');
  sessions.INST_MEDIATRIX=cookie(await login(mediated.username,credentials.passwords[mediated.accountId]));credentials.pins.USR_SYNTH_REVIEW_ROLE01=newPin;
  check((await app.inject({method:'POST',url:'/api/v2/inbound-captures',headers:{origin,cookie:sessions.INST_MEDIATRIX,'operator-verification':unusedTech.json().verificationId,'idempotency-key':'IDEM_RESET_GRANT','x-bloodledger-contract-version':'V2.1'},payload:{}})).statusCode,403);
  const invBody={category:'BLOOD_BANK',correlationId:'CORR_'+randomBytes(16).toString('hex').toUpperCase()};
  const invProof=await verify(sessions.PRC,'USR_OP_655989F204F82E3BE56E4A6E95F4A625','/api/v2/onboarding/invitations',invBody,'IDEM_INV');check(invProof.statusCode,200);
  const invite=await app.inject({method:'POST',url:'/api/v2/onboarding/invitations',headers:{origin,cookie:sessions.PRC,'operator-verification':invProof.json().verificationId,'idempotency-key':'IDEM_INV'},payload:invBody});check(invite.statusCode,200);
  const applicantPassword=password();const body={invitationSecret:invite.json().invitationSecret,password:applicantPassword,institutionDisplayName:'Synthetic Test Bank',category:'BLOOD_BANK',locality:'Synthetic Locality',genericContact:'office@test.bloodledger',licenseReference:'SYNTH_LICENSE',applicationReason:'Synthetic test participation',attested:true,correlationId:'CORR_'+randomBytes(16).toString('hex').toUpperCase()};
  const submitted=await app.inject({method:'POST',url:'/api/v2/onboarding/applications',headers:{origin,'idempotency-key':'IDEM_APPLICATION'},payload:body});check(submitted.statusCode,200);const applicationId=submitted.json().applicationId;
  const applicantLogin=await app.inject({method:'POST',url:'/api/v2/onboarding/applicant/session',headers:{origin},payload:{applicationId,password:applicantPassword}});check(applicantLogin.statusCode,200);const applicantCookie=cookie(applicantLogin);
  check((await app.inject({method:'GET',url:'/api/v2/onboarding/applicant/status',headers:{cookie:applicantCookie}})).statusCode,200);
  check((await app.inject({method:'GET',url:'/api/v2/onboarding/applications',headers:{cookie:applicantCookie}})).statusCode,401);
  check((await app.inject({method:'GET',url:'/api/v2/onboarding/applications',headers:{cookie:sessions.DOH}})).statusCode,403);
  async function decision(action,payload,key){const path=`/api/v2/onboarding/applications/${applicationId}/${action}`;const grant=await verify(sessions.PRC,'USR_OP_655989F204F82E3BE56E4A6E95F4A625',path,payload,key);check(grant.statusCode,200);return app.inject({method:'POST',url:path,headers:{origin,cookie:sessions.PRC,'operator-verification':grant.json().verificationId,'idempotency-key':key},payload});}
  check((await decision('review',{expectedVersion:1,correlationId:invBody.correlationId,verificationReference:'SYNTHETIC_MANUAL_REVIEW',verificationOutcome:'CONFIRMED'},'IDEM_REVIEW')).statusCode,200);
  check((await decision('approve',{expectedVersion:1,correlationId:invBody.correlationId,reasonCode:'REVIEW_COMPLETE'},'IDEM_STALE_APPROVAL')).statusCode,409);
  check((await decision('approve',{expectedVersion:2,correlationId:invBody.correlationId,reasonCode:'REVIEW_COMPLETE'},'IDEM_APPROVAL')).statusCode,200);
  const activate={expectedVersion:3,correlationId:invBody.correlationId,reasonCode:'REVIEW_COMPLETE',loginEmail:'bloodbank@test.bloodledger',password:password(),operatorPin:String(randomInt(0,100000000)).padStart(8,'0')};
  check((await decision('activate',activate,'IDEM_ACTIVATE')).statusCode,200);
  const newLogin=await login(activate.loginEmail,activate.password);check(newLogin.statusCode,200);check(newLogin.json().principal.roleId,'ROLE-06');check(newLogin.json().principal.operators.length,1);check(newLogin.json().principal.permissions.includes('inventory:write'),false);
  const inst='INST_SYNTH_METROLIPA',suspendBody={expectedVersion:2,correlationId:invBody.correlationId,reasonCode:'SECURITY_HOLD'},suspendPath=`/api/v2/onboarding/institutions/${inst}/suspend`;
  const suspendProof=await verify(sessions.PRC,'USR_OP_655989F204F82E3BE56E4A6E95F4A625',suspendPath,suspendBody,'IDEM_SUSPEND');check(suspendProof.statusCode,200);
  const suspension=await app.inject({method:'POST',url:suspendPath,headers:{origin,cookie:sessions.PRC,'operator-verification':suspendProof.json().verificationId,'idempotency-key':'IDEM_SUSPEND'},payload:suspendBody});check(suspension.statusCode,409);check(suspension.json().error.code,'ONB_ACTIVE_TRANSFER_BLOCKS_SUSPENSION');
  const sourceSuspendPath='/api/v2/onboarding/institutions/INST_SYNTH_MEDIX/suspend';
  const sourceProof=await verify(sessions.PRC,'USR_OP_655989F204F82E3BE56E4A6E95F4A625',sourceSuspendPath,suspendBody,'IDEM_SOURCE_SUSPEND');check(sourceProof.statusCode,200);
  const sourceSuspension=await app.inject({method:'POST',url:sourceSuspendPath,headers:{origin,cookie:sessions.PRC,'operator-verification':sourceProof.json().verificationId,'idempotency-key':'IDEM_SOURCE_SUSPEND'},payload:suspendBody});check(sourceSuspension.json().error.code,'ONB_ACTIVE_TRANSFER_BLOCKS_SUSPENSION');
  // Primary replacement preserves operator actor IDs and denies former credentials/cookies.
  const replacementPassword=password(),replacement={expectedVersion:2,correlationId:invBody.correlationId,loginEmail:'bloodbank@nlvilla-replaced.bloodledger',password:replacementPassword};
  const replacePath='/api/v2/onboarding/institutions/INST_SYNTH_NLVILLA/account',replaceProof=await verify(sessions.PRC,'USR_OP_655989F204F82E3BE56E4A6E95F4A625',replacePath,replacement,'IDEM_REPLACE');check(replaceProof.statusCode,200);
  const replaced=await app.inject({method:'POST',url:replacePath,headers:{origin,cookie:sessions.PRC,'operator-verification':replaceProof.json().verificationId,'idempotency-key':'IDEM_REPLACE'},payload:replacement});check(replaced.statusCode,200);
  check((await app.inject({method:'GET',url:'/api/v1/auth/session',headers:{cookie:sessions.INST_SYNTH_NLVILLA}})).statusCode,401);
  const replacementLogin=await login(replacement.loginEmail,replacementPassword);check(replacementLogin.statusCode,200);check(replacementLogin.json().principal.operators.some(o=>o.operatorId==='USR_OP_B5115DC956C435754793A206CE37267C'),true);
  const staleProof=await verify(cookie(replacementLogin),'USR_OP_B5115DC956C435754793A206CE37267C','/api/v2/inbound-captures',{},'IDEM_EXPIRED');check(staleProof.statusCode,200);
  await admin.query("UPDATE app.operator_verifications SET issued_at=CURRENT_TIMESTAMP-interval '3 minutes',expires_at=CURRENT_TIMESTAMP-interval '1 minute' WHERE verification_id=$1",[staleProof.json().verificationId]);
  check((await app.inject({method:'POST',url:'/api/v2/inbound-captures',headers:{origin,cookie:cookie(replacementLogin),'operator-verification':staleProof.json().verificationId,'idempotency-key':'IDEM_EXPIRED','x-bloodledger-contract-version':'V2.1'},payload:{}})).json().error.code,'OPERATOR_VERIFICATION_EXPIRED');
  const freshInstitution=newLogin.json().principal.institutionId;
  for(const [action,expectedVersion] of [['suspend',1],['reactivate',2]]){
    const path=`/api/v2/onboarding/institutions/${freshInstitution}/${action}`,payload={expectedVersion,correlationId:invBody.correlationId,reasonCode:'INSTITUTION_REQUEST'},key=`IDEM_NEW_${action.toUpperCase()}`;
    const grant=await verify(sessions.PRC,'USR_OP_655989F204F82E3BE56E4A6E95F4A625',path,payload,key);check(grant.statusCode,200);
    check((await app.inject({method:'POST',url:path,headers:{origin,cookie:sessions.PRC,'operator-verification':grant.json().verificationId,'idempotency-key':key},payload})).statusCode,200);
  }
  check((await app.inject({method:'GET',url:'/api/v1/auth/session',headers:{cookie:cookie(newLogin)}})).statusCode,401);
  const restoredNewLogin=await login(activate.loginEmail,activate.password);check(restoredNewLogin.statusCode,200);
  check((await app.inject({method:'GET',url:'/api/v2/onboarding/institutions',headers:{cookie:sessions.DOH}})).statusCode,403);
  check((await app.inject({method:'GET',url:'/api/v2/onboarding/institutions/INST_MEDIATRIX',headers:{cookie:cookie(restoredNewLogin)}})).statusCode,403);
  check((await app.inject({method:'GET',url:'/api/v1/inventory',headers:{cookie:sessions.INST_MEDIATRIX}})).json().error.code,'INSTITUTION_V2_READ_REQUIRED');
  // Synthetic retention is tested by advancing only isolated fixture timestamps.
  await admin.query("UPDATE app.onboarding_applications SET closed_at=CURRENT_TIMESTAMP-interval '31 days',purge_after=CURRENT_TIMESTAMP-interval '1 day' WHERE application_id=$1",[applicationId]);
  check((await runtime.query('SELECT app.purge_closed_synthetic_onboarding(CURRENT_TIMESTAMP) n')).rows[0].n,1);
  check((await runtime.query('SELECT detail FROM app.onboarding_applications WHERE application_id=$1',[applicationId])).rows[0].detail,null);
  check((await app.inject({method:'GET',url:'/api/v2/onboarding/applicant/status',headers:{cookie:applicantCookie}})).statusCode,401);
  const audits=JSON.stringify((await admin.query('SELECT * FROM app.account_audit')).rows);assert(!audits.includes(activate.password)&&!audits.includes(activate.operatorPin)&&!audits.includes(body.invitationSecret));assertions++;
  check((await app.inject({method:'GET',url:'/api/v2/dashboard',headers:{cookie:sessions.INST_SYNTH_MEDIX}})).json().inventory.length,0);
  check((await app.inject({method:'GET',url:'/api/v2/dashboard',headers:{cookie:sessions.INST_MEDIATRIX}})).json().inventory.reduce((n,r)=>n+r.confirmedCount,0),9);
  check((await app.inject({method:'GET',url:'/api/v2/historical-snapshots',headers:{cookie:sessions.INST_SYNTH_MEDIX}})).statusCode,403);
  check((await app.inject({method:'GET',url:'/api/v2/alerts',headers:{cookie:sessions.INST_MEDIATRIX}})).json().alerts[0].acknowledged,true);
  const preserved=(await admin.query("SELECT expected_units,verified_units FROM app.synthetic_inventory_snapshots WHERE snapshot_id=$1",[snapshotId])).rows[0];check(preserved.expected_units,522);check(preserved.verified_units,522);
  const beforeRollback=await domainFingerprints(admin);await rollbackAccountMigration(admin,target);assert.deepEqual(await domainFingerprints(admin),beforeRollback);assertions++;
  check((await app.inject({method:'GET',url:'/api/v1/auth/session',headers:{cookie:recipient}})).statusCode,401);
  check((await app.inject({method:'GET',url:'/api/v1/auth/session',headers:{cookie:cookie(restoredNewLogin)}})).statusCode,200);
  await rollbackAccountMigration(admin,target);
  check((await app.inject({method:'POST',url:'/api/v1/simulation/session',payload:{operatorId:config.operatorId,credential:config.operatorCredential}})).statusCode,403);
  check((await admin.query("SELECT account_kind,status FROM app.application_users WHERE user_id='USR_SYNTH_REVIEW_ROLE05'")).rows[0].account_kind,'INTERNAL');
  console.log(`Institution-account integration passed ${assertions} assertions: FR-12/15/16, BR-SEC-04, retained migration, PIN/session authorization, onboarding, scoped reads, retention and rollback. Representative synthetic database; no live Fabric or Lat validation claim.`);
}finally{await app?.close();await runtime.end();await admin.end();}
