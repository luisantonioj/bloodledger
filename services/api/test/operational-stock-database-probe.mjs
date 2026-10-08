// TP-STOCK-01 / FR-01/03/08/12 / NFR-02/05. Disposable database only.
// Submission evidence below is deliberately fabricated; it is never live proof.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { canonical,digest,id,processSavedCommand } from '../../../scripts/development-data/scenario.mjs';
import { preservationSnapshot,verifyPreservation } from '../../../scripts/development-data/stock-preservation.mjs';
import { PostgresV2CommandStore } from '../build/src/v2-command.js';
import { PostgresV2Projector } from '../build/src/database-v2.js';

export async function probeOperationalStock({admin,runtime,app,cookie,pin}) {
  const before=await preservationSnapshot(runtime),runId='STOCK_DATABASE_PROBE',origin='http://127.0.0.1:5174';
  const at=new Date().toISOString(),collectedAt=new Date(Date.now()-3600000).toISOString(),expiresAt=new Date(Date.now()+3*86400000).toISOString();
  const key='IDEM_STOCK_DATABASE_PROBE',captureId=id('INCAP_',key),componentId=id('COMP_',key),commandId=id('CMD_',key),actor='USR_SYNTH_REVIEW_ROLE02';
  const payload={componentType:'PACKED_RED_BLOOD_CELLS',bloodType:'A_POSITIVE',collectedAt,expiresAt,donationNumber:'MM26-10-1001',captureMethod:'OCR',capturePolicyVersion:'INBOUND_OCR_V1',issuerInstitutionId:'INST_MEDIATRIX',bloodTypeEvidence:{source:'OCR_LABEL',confirmed:true},componentEvidence:{source:'OCR_LABEL',confirmed:true},capturedAt:at,confirmedAt:at,eventTime:at,correlationId:'CORR_'+'B'.repeat(32),ocrEvidence:{engine:'TESSERACT_JS',engineVersion:'7.0.0',fieldConfidence:{donationNumber:99,bloodType:99,collectedAt:99,expiresAt:99}}};
  const releaseKey='IDEM_STOCK_RELEASE_PROBE',releasePayload={releaseId:'REL_STOCK_PROBE',bloodType:'A_POSITIVE',componentType:'PACKED_RED_BLOOD_CELLS',quantity:1,eventTime:at,correlationId:'CORR_'+'C'.repeat(32)};
  const operations=[{path:'/api/v2/inbound-captures',payloadSha256:digest(payload),idempotencyKey:key,commandId,account:'coordinator'},{path:'/api/v2/local-releases',payloadSha256:digest(releasePayload),idempotencyKey:releaseKey,commandId:id('CMD_',releaseKey),account:'coordinator'}];
  const manifest={principals:{coordinator:{userId:actor,institutionId:'INST_MEDIATRIX'}},operations};
  const store=new PostgresV2CommandStore(runtime),projector=new PostgresV2Projector(runtime);
  const grant=async(path,body,idem)=>{
    const result=await app.inject({method:'POST',url:'/api/v2/auth/operator-verifications',headers:{origin,cookie},payload:{operatorId:actor,pin,action:'POST '+path,payload:body,idempotencyKey:idem}});
    assert.equal(result.statusCode,200,result.body);return result.json().verificationId;
  };
  const send=async(path,body,idem)=>app.inject({method:'POST',url:path,headers:{origin,cookie,'idempotency-key':idem,'operator-verification':await grant(path,body,idem),'x-bloodledger-contract-version':'V2.1'},payload:body});
  // Same single-writer index protects two concurrently attempted populations.
  const insert=()=>runtime.query("INSERT INTO app.operational_stock_runs(run_id,scenario_sha256,manifest_sha256,target_sha256,backup_sha256,manifest,confirmed_at,classification) VALUES($1,$2,$3,$4,$5,$6,$7,'SIMULATION_ONLY')",[runId,'a'.repeat(64),'b'.repeat(64),'c'.repeat(64),'d'.repeat(64),manifest,at]);
  await insert();
  await assert.rejects(runtime.query("INSERT INTO app.operational_stock_runs(run_id,scenario_sha256,manifest_sha256,target_sha256,backup_sha256,manifest,confirmed_at,classification) VALUES('STOCK_CONCURRENT',repeat('a',64),repeat('e',64),repeat('c',64),repeat('d',64),'{}',now(),'SIMULATION_ONLY')"),/unique/);
  await assert.rejects(store.assertPopulationRequest('/api/v2/inbound-captures',{...payload,bloodType:'O_POSITIVE'},key),/quiesced/);
  const blocked=await send('/api/v2/inbound-captures',{...payload,bloodType:'O_POSITIVE'},'IDEM_STOCK_BLOCKED');assert.equal(blocked.statusCode,409);assert.equal((await runtime.query('SELECT 1 FROM app.v2_inbound_captures WHERE capture_id=$1',[captureId])).rowCount,0);
  // This probe creates test keys only in memory; retained key material is unused.
  const accepted=await send('/api/v2/inbound-captures',payload,key);assert.equal(accepted.statusCode,202,accepted.body);
  const intake=await store.get(commandId,'INST_MEDIATRIX',actor);assert.ok(intake);
  await runtime.query('INSERT INTO app.operational_stock_commands(run_id,command_id) VALUES($1,$2)',[runId,commandId]);
  await runtime.query("UPDATE app.v2_commands SET status='SUBMITTING',lease_owner=$2,lease_expires_at=now()-interval '1 second' WHERE command_id=$1",[commandId,runId]);
  const worker=await store.claim('GENERAL_PROBE',new Date());assert.notEqual(worker?.commandId,commandId);
  let prepared=0,submitted=0,projected=0,failProjection=true;
  const transactionId=randomBytes(32).toString('hex'),bytes=Buffer.from('FABRICATED_DATABASE_TEST_ENVELOPE');
  const evidence={transactionId,blockNumber:'123',validationStatus:'VALID',asset:{componentId}};
  const ledger={async prepare(){prepared++;return {transactionId,bytes};},async inspect(){return submitted?evidence:null;},async submitSaved(request){assert.equal(request.transaction_id,transactionId);assert.deepEqual(Buffer.from(request.signed_transaction),bytes);submitted++;}};
  const recover=async()=>processSavedCommand({command:await store.get(commandId,'INST_MEDIATRIX',actor),saved:(await runtime.query('SELECT * FROM app.operational_stock_commands WHERE command_id=$1',[commandId])).rows[0],ledger,
    saveSubmission:async p=>runtime.query('UPDATE app.operational_stock_commands SET transaction_id=$2,signed_transaction=$3 WHERE command_id=$1',[commandId,p.transactionId,p.bytes]),
    saveCommit:async e=>{await store.markLedgerCommitted(commandId,e.transactionId,new Date(),e);await runtime.query("UPDATE app.operational_stock_commands SET block_number=$2,validation_status='VALID',committed_at=COALESCE(committed_at,now()) WHERE command_id=$1",[commandId,e.blockNumber]);},
    project:async e=>{if(failProjection){failProjection=false;throw Error('FABRICATED_PROJECTION_FAILURE');}await projector.project(intake,{transactionId:e.transactionId,result:e.asset});projected++;},complete:()=>store.markCommitted(commandId,new Date())});
  await assert.rejects(recover(),/FABRICATED_PROJECTION_FAILURE/);assert.equal((await store.get(commandId,'INST_MEDIATRIX',actor)).status,'LEDGER_COMMITTED_PROJECTION_PENDING');
  await recover();await projector.project(intake,{transactionId,result:evidence.asset});assert.equal(prepared,1);assert.equal(submitted,1);assert.equal(projected,1);
  assert.equal((await runtime.query('SELECT count(*)::int n FROM app.v2_components WHERE component_id=$1',[componentId])).rows[0].n,1);
  const local=await send('/api/v2/local-releases',releasePayload,releaseKey);assert.equal(local.statusCode,202,local.body);
  const release=await store.get(local.json().commandId,'INST_MEDIATRIX',actor);assert.deepEqual(release.payload.selectedComponentIds,[componentId]);assert.deepEqual(release.payload.expectedComponentVersions,[1]);
  await runtime.query('INSERT INTO app.operational_stock_commands(run_id,command_id) VALUES($1,$2)',[runId,release.commandId]);
  const releaseTx=randomBytes(32).toString('hex');await store.markLedgerCommitted(release.commandId,releaseTx,new Date(),{fixture:true});
  await projector.project(release,{transactionId:releaseTx,result:{fixture:true}});await projector.project(release,{transactionId:releaseTx,result:{fixture:true}});await store.markCommitted(release.commandId,new Date());
  const reservation=(await app.inject({method:'GET',url:'/api/v2/reservations/'+release.payload.reservationId,headers:{cookie,'x-bloodledger-contract-version':'V2.1'}})).json();assert.equal(reservation.purpose,'LOCAL_RELEASE');assert.equal(reservation.localReleaseId,releasePayload.releaseId);assert.equal(reservation.components[0].inventoryVersion,2);
  const execution={runId,operations,labels:[{componentId,donationId:intake.payload.donationId,idempotencyKey:key}],reservations:[{reservationId:release.payload.reservationId,workflowId:releasePayload.releaseId}],baselineFingerprints:before};
  await verifyPreservation(runtime,execution);
  await assert.rejects(runtime.query('UPDATE app.operational_stock_runs SET manifest_sha256=repeat(\'e\',64) WHERE run_id=$1',[runId]),/permission denied/);
  await assert.rejects(runtime.query('DELETE FROM app.operational_stock_commands WHERE run_id=$1',[runId]),/permission denied/);
  assert.equal((await send('/api/v2/local-releases',releasePayload,releaseKey)).json().replayed,true);
  await verifyPreservation(runtime,execution);
  // Re-open a separate application connection: recovery artifacts remain durable.
  const saved=(await runtime.query('SELECT transaction_id,signed_transaction,block_number,validation_status FROM app.operational_stock_commands WHERE command_id=$1',[commandId])).rows[0];assert.equal(saved.transaction_id,transactionId);assert.deepEqual(saved.signed_transaction,bytes);assert.equal(String(saved.block_number),'123');
  await runtime.query('UPDATE app.operational_stock_runs SET writer_lock=false WHERE run_id=$1',[runId]);
  await store.assertPopulationRequest('/api/v2/local-releases',{quantity:2},'IDEM_UNRELATED');
  // Test-only cleanup in this disposable container preserves the surrounding probe.
  await admin.query('DELETE FROM app.operational_stock_commands WHERE run_id=$1',[runId]);await admin.query('DELETE FROM app.operational_stock_runs WHERE run_id=$1',[runId]);
  await admin.query('DELETE FROM app.v2_projection_receipts WHERE command_id=ANY($1::text[])',[operations.map(o=>o.commandId)]);
  await admin.query('UPDATE app.v2_inbound_captures SET component_id=NULL WHERE capture_id=$1',[captureId]);await admin.query('UPDATE app.v2_components SET inbound_capture_id=NULL WHERE component_id=$1',[componentId]);await admin.query('DELETE FROM app.v2_inbound_captures WHERE capture_id=$1',[captureId]);await admin.query('DELETE FROM app.v2_components WHERE component_id=$1',[componentId]);await admin.query('DELETE FROM app.v2_reservations WHERE reservation_id=$1',[release.payload.reservationId]);await admin.query('DELETE FROM app.v2_donations WHERE donation_id=$1',[intake.payload.donationId]);await admin.query('DELETE FROM app.v2_commands WHERE command_id=ANY($1::text[])',[operations.map(o=>o.commandId)]);
  assert.equal(canonical(before),canonical(await preservationSnapshot(runtime)));
  console.log('Operational-stock database probe PASS: writer isolation, frozen local FEFO, immutable journal privileges, general-worker exclusion, saved envelope, projection retry, exact replay, reservation API and baseline preservation. FABRICATED_TEST_EVIDENCE; no Fabric acceptance claim.');
}
