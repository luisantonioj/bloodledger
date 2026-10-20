// FR-06 / ADR-046: disposable PostgreSQL only; no retained data or Fabric transactions.
import assert from 'node:assert/strict';
import {Client,Pool} from 'pg';
import {runner} from 'node-pg-migrate';
import {PostgresCoordinationReader,priorityView} from '../build/src/coordination-views.js';

const database='bloodledger_rps_test';
const admin=new Client({host:'127.0.0.1',user:'postgres',database});
await admin.connect();let runtime;
try {
  assert.equal((await admin.query('SELECT current_database() AS name')).rows[0].name,database);
  await admin.query('CREATE ROLE bloodledger_migrator LOGIN;CREATE ROLE bloodledger_app LOGIN;GRANT bloodledger_migrator TO postgres;ALTER DATABASE bloodledger_rps_test OWNER TO bloodledger_migrator;SET ROLE bloodledger_migrator');
  const applied=await runner({dbClient:admin,direction:'up',dir:new URL('../../../database/migrations',import.meta.url).pathname,ignorePattern:'README\\.md',migrationsSchema:'public',migrationsTable:'pgmigrations',log:()=>{}});
  await admin.query('RESET ROLE');
  for(const id of ['INST_SYNTH_RPS_A','INST_SYNTH_RPS_B','INST_SYNTH_RPS_C'])await admin.query("INSERT INTO app.institutions(institution_id,display_name,category,status,account_category) VALUES($1,'Synthetic RPS Fixture','HOSPITAL','ACTIVE','BLOOD_BANK')",[id]);
  await admin.query("INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status) VALUES('USR_SYNTH_RPS','synth_rps_fixture','Synthetic RPS Fixture','INST_SYNTH_RPS_A','SCRYPT_V1',repeat('0',32),repeat('0',128),'SUSPENDED')");
  const now=new Date('2026-10-20T02:00:00.000Z'),correlation='CORR_'+'A'.repeat(32);
  let index=0;
  async function request(id,{source='INST_SYNTH_RPS_A',blood='A_POSITIVE',component='PACKED_RED_BLOOD_CELLS',status='PENDING',urgency='ROUTINE',reservation}={}) {
    const n=++index,command='CMD_RPS_FIXTURE_'+n;
    await admin.query("INSERT INTO app.v2_commands(command_id,idempotency_key,payload_sha256,resource_type,resource_id,operation,payload,status,next_attempt_at,correlation_id,actor_user_id,actor_institution_id,accepted_at,updated_at,classification) VALUES($1,$2,repeat('a',64),'TRANSFER',$3,'SUBMIT_TRANSFER','{}','COMMITTED',$4,$5,'USR_SYNTH_RPS',$6,$4,$4,'SIMULATION_ONLY')",[command,'IDEM_RPS_FIXTURE_'+n,id,now,correlation,source]);
    await admin.query("INSERT INTO app.v2_transfer_requests(transfer_id,command_id,source_institution_id,destination_institution_id,blood_type,component_type,quantity,urgency,request_time,status,ledger_version,ledger_transaction_id,correlation_id,classification) VALUES($1,$2,$3,'INST_SYNTH_RPS_C',$4,$5,1,$6,$7,$8,1,$9,$10,'SIMULATION_ONLY')",[id,command,source,blood,component,urgency,new Date(now.getTime()-3600000),status,n.toString(16).padStart(64,'0'),correlation]);
    if(reservation)await admin.query("INSERT INTO app.v2_reservations(reservation_id,purpose,transfer_id,institution_id,status,correlation_id,classification,delayed_from_status) VALUES($1,'TRANSFER',$2,$3,$4,$5,'SIMULATION_ONLY',$6)",['RES_RPS_FIXTURE_'+n,id,source,reservation,correlation,reservation==='DELAYED'?'IN_TRANSIT':null]);
  }
  await request('TRF_RPS_AWAIT_ROUTINE');await request('TRF_RPS_AWAIT_CRITICAL',{urgency:'CRITICAL'});
  const states=['ACTIVE','DISPATCHED','IN_TRANSIT','DELAYED','RECEIVED','CANCELLED','COMPLETED','COMPROMISED'];
  for(const state of states)await request('TRF_RPS_DECIDED_'+state,{reservation:state});
  await request('TRF_RPS_OTHER_BANK',{source:'INST_SYNTH_RPS_B'});
  await request('TRF_RPS_OTHER_BLOOD',{blood:'B_POSITIVE'});
  await request('TRF_RPS_OTHER_COMPONENT',{component:'WHOLE_BLOOD'});
  await request('TRF_RPS_CANCELLED_REQUEST',{status:'CANCELLED'});await request('TRF_RPS_REJECTED_REQUEST',{status:'REJECTED'});
  runtime=new Pool({host:'127.0.0.1',user:'bloodledger_app',database});
  const reader=new PostgresCoordinationReader(runtime,{async get(){throw Error('Unexpected snapshot read');},async latest(){throw Error('Unexpected snapshot read');}});
  const product={bloodType:'A_POSITIVE',componentType:'PACKED_RED_BLOOD_CELLS'};
  const own=await reader.pendingRequests({...product,sourceInstitutionId:'INST_SYNTH_RPS_A'});
  assert.deepEqual(own.map(r=>r.transferId).sort(),['TRF_RPS_AWAIT_CRITICAL','TRF_RPS_AWAIT_ROUTINE']);
  const view=await priorityView(reader,'INST_SYNTH_RPS_A',product.bloodType,product.componentType,now);
  assert.equal(view.status,'AVAILABLE');assert.deepEqual(view.ranked.map(r=>r.transferId),['TRF_RPS_AWAIT_CRITICAL','TRF_RPS_AWAIT_ROUTINE']);
  assert.deepEqual((await reader.pendingRequests(product)).map(r=>r.transferId).sort(),['TRF_RPS_AWAIT_CRITICAL','TRF_RPS_AWAIT_ROUTINE','TRF_RPS_OTHER_BANK']);
  assert.deepEqual((await reader.pendingRequests({...product,sourceInstitutionId:'INST_SYNTH_RPS_B'})).map(r=>r.transferId),['TRF_RPS_OTHER_BANK']);
  assert.deepEqual(await reader.pendingRequests({...product,sourceInstitutionId:'INST_SYNTH_MISSING'}),[]);
  console.log(JSON.stringify({passed:true,migrations:applied.length,awaitingRequestsRanked:2,reservationStatesExcluded:states,scopeProductAndStatusFiltersPassed:true,retainedDatabaseUsed:false}));
}finally{if(runtime)await runtime.end();await admin.end();}
