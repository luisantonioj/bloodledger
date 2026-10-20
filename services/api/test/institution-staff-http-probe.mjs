// PA-STAFF-01: run only after institution-staff-database-probe, in its disposable DB.
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomBytes} from 'node:crypto';
import {buildApp} from '../build/src/app.js';
import {MemoryRepository} from '../build/test/test-support.js';
import {PostgresSessionRepository} from '../build/src/database-session.js';
import {PostgresOperatorVerification} from '../build/src/operator-verification.js';
import {deriveVerifier} from '../build/src/session.js';
const database='bloodledger_staff_test',common={host:'127.0.0.1',port:56541,database};
const admin=new Pool({...common,user:'postgres'}),runtime=new Pool({...common,user:'bloodledger_app'}),origin='http://127.0.0.1:5174',corr='CORR_'+'D'.repeat(32);
let app,checks=0;const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
const password=randomBytes(18).toString('base64url'),pin='23456789';
try{
 equal((await admin.query('SELECT current_database() AS name')).rows[0].name,database);
 const salt=randomBytes(16).toString('hex');
 await admin.query("UPDATE app.application_users SET password_salt=$1,password_verifier=$2 WHERE user_id='USR_STAFF_ACCOUNT_REQUESTER'",[salt,await deriveVerifier(password,salt)]);
 await admin.query("UPDATE app.institution_operators SET pin_salt=$1,pin_verifier=$2 WHERE operator_id='USR_STAFF_ADMIN_REQUESTER'",[salt,await deriveVerifier(pin,salt)]);
 await admin.query("INSERT INTO app.user_role_assignments(user_id,role_id,policy_version) VALUES('USR_STAFF_ACCOUNT_REQUESTER','ROLE-03','SYNTHETIC_WEB_ACCESS_V1') ON CONFLICT DO NOTHING");
 const config={host:'127.0.0.1',port:3000,jwtSecret:randomBytes(32).toString('hex'),operatorId:'USR_SYNTH_CAPTURE',operatorCredential:randomBytes(24).toString('hex'),workerConfigured:false,webOrigin:origin,webCookieSecure:false,activeWriteApiVersion:'v2'};
 app=await buildApp(new MemoryRepository(),config,()=>new Date(),new PostgresSessionRepository(runtime),undefined,undefined,undefined,new PostgresOperatorVerification(runtime));
 const login=await app.inject({method:'POST',url:'/api/v1/auth/session',headers:{origin},payload:{username:'synth_staff_usr_staff_account_requester',password}});equal(login.statusCode,200);const cookie=String(login.headers['set-cookie']).split(';')[0];
 const session=await app.inject({method:'GET',url:'/api/v1/auth/session',headers:{cookie}});equal(session.statusCode,200);equal(session.json().principal.operators.some(o=>o.actionCapabilities.includes('staff:create')),true);
 const target=(await admin.query("SELECT operator_id,version FROM app.institution_operators WHERE institution_id='INST_STAFF_REQUESTER' AND capability_profile='ROLE'")).rows[0];
 const path='/api/v2/staff/'+target.operator_id+'/reset-pin-approval',body={expectedVersion:target.version,correlationId:corr},key='IDEM_STAFF_HTTP_APPROVAL';
 const noPin=await app.inject({method:'POST',url:path,headers:{cookie,origin,'idempotency-key':key},payload:body});equal(noPin.statusCode,403);
 const verify=await app.inject({method:'POST',url:'/api/v2/auth/operator-verifications',headers:{origin,cookie},payload:{operatorId:'USR_STAFF_ADMIN_REQUESTER',pin,action:'POST '+path,payload:body,idempotencyKey:key}});equal(verify.statusCode,200);
 const approval=await app.inject({method:'POST',url:path,headers:{cookie,origin,'idempotency-key':key,'operator-verification':verify.json().verificationId},payload:body});equal(approval.statusCode,200);const token=approval.json().approvalId;
 const resetPath='/api/v2/staff/'+target.operator_id+'/reset-pin',reset={...body,pin:'34567891'},resetKey='IDEM_STAFF_HTTP_RESET';
 const missing=await app.inject({method:'POST',url:resetPath,headers:{cookie,origin,'idempotency-key':resetKey},payload:reset});equal(missing.statusCode,403);
 const foreign=await app.inject({method:'POST',url:resetPath,headers:{cookie,origin:'https://foreign.invalid','idempotency-key':resetKey,'staff-reset-approval':token},payload:reset});equal(foreign.statusCode,403);
 const headers={cookie,origin,'idempotency-key':resetKey,'staff-reset-approval':token};
 const changed=await app.inject({method:'POST',url:resetPath,headers,payload:reset});equal(changed.statusCode,200);equal(changed.json().version,target.version+1);
 const replay=await app.inject({method:'POST',url:resetPath,headers,payload:reset});equal(replay.statusCode,200);equal(replay.json(),changed.json());
 const conflict=await app.inject({method:'POST',url:resetPath,headers,payload:{...reset,pin:'34567892'}});equal(conflict.statusCode,403);
 equal((await admin.query('SELECT count(*)::int AS n FROM app.v2_commands')).rows[0].n,0);
 console.log(JSON.stringify({passed:true,checks,normalLogin:true,administratorPinRequired:true,scopedApproval:true,exactReplay:true,retainedDataUsed:false}));
}finally{if(app)await app.close();await runtime.end();await admin.end();}
