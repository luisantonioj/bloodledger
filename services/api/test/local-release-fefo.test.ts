// FR-03/08/12 / BR-INV-03/04: canonical local reservations and frozen replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildApp } from '../src/app.js';
import { InMemoryV2CommandStore } from '../src/v2-command.js';
import { interviewCorePayload } from '../src/fabric.js';
import { MemoryRepository } from './test-support.js';
import type { CredentialRecord } from '../src/session.js';
import type { V2ComponentProjection } from '../src/database-v2.js';

const origin='http://127.0.0.1:5174',time='2026-10-08T08:00:00.000Z';
const record:CredentialRecord={userId:'USR_SYNTH_ADMIN',username:'synth_admin',displayName:'Synthetic Operator',institutionId:'INST_MEDIATRIX',institutionDisplayName:'Synthetic Mediatrix',institutionCategory:'HOSPITAL',roleId:'ROLE-02',saltHex:'0'.repeat(32),verifierHex:'0'.repeat(128)};
const component=(componentId:string,expiresAt:string,version=1):V2ComponentProjection=>({componentId,donationId:'DON_SYNTH',issuerInstitutionId:'INST_MEDIATRIX',componentType:'CRYOPRECIPITATE',bloodType:'A_POSITIVE',collectedAt:'2026-10-07T00:00:00.000Z',expiresAt,institutionId:'INST_MEDIATRIX',inventoryStatus:'AVAILABLE',reservationId:null,reservationVersion:null,inventoryVersion:version,policyVersion:'INTERVIEW_DERIVED_CORE_V2_1',classification:'SIMULATION_ONLY'});
test('FR-03/08: local release freezes global FEFO members/versions, ties, expiry and idempotent replay',async()=>{
  let rows=[component('COMP_B','2026-10-10T00:00:00.000Z',3),component('COMP_A','2026-10-10T00:00:00.000Z',2),component('COMP_EXPIRED',time),{...component('COMP_RESERVED','2026-10-09T00:00:00.000Z'),inventoryStatus:'RESERVED'},{...component('COMP_OTHER','2026-10-09T00:00:00.000Z'),institutionId:'INST_SYNTH_MEDIX'}];
  const sessions={async findCredential(){return record;},async createSession(){},async restoreSession(){return record;},async revokeSession(){}};
  const store=new InMemoryV2CommandStore();
  const app=await buildApp(new MemoryRepository(),{host:'127.0.0.1',port:3000,jwtSecret:'synthetic-release-test-'.repeat(3),operatorId:'USR_SYNTH_CAPTURE',operatorCredential:'synthetic-test-credential',workerConfigured:false,webOrigin:origin},()=>new Date(time),sessions,undefined,undefined,{store,projection:{async listComponents(){return rows;},async getComponent(){return null;},async findComponentByIdentity(){return null;}}});
  const token=app.jwt.sign({userId:record.userId,institutionId:record.institutionId,roleId:record.roleId,sessionId:'SESS_RELEASE',binding:'a'.repeat(64),policyVersion:'SYNTHETIC_WEB_ACCESS_V1'});
  const headers={cookie:`bloodledger_session=${token}`,origin,'idempotency-key':'IDEM_RELEASE','x-bloodledger-contract-version':'V2.1'};
  const payload={releaseId:'REL_TEST',bloodType:'A_POSITIVE',componentType:'CRYOPRECIPITATE',quantity:2,eventTime:time,correlationId:'CORR_'+'A'.repeat(32)};
  try{
    const accepted=await app.inject({method:'POST',url:'/api/v2/local-releases',headers,payload});assert.equal(accepted.statusCode,202,accepted.body);
    const command=await store.get(accepted.json().commandId,record.institutionId,record.userId);assert.ok(command);
    assert.deepEqual(command.payload.selectedComponentIds,['COMP_A','COMP_B']);assert.deepEqual(command.payload.expectedComponentVersions,[2,3]);assert.equal(command.payload.purpose,'LOCAL_RELEASE');assert.equal(command.payload.destinationInstitutionId,null);
    assert.equal(command.payload.reservationId,'RES_'+createHash('sha256').update('IDEM_RELEASE').digest('hex').toUpperCase().slice(0,40));
    const ledger=interviewCorePayload(command);assert.equal(ledger.localReleaseId,undefined);assert.equal(ledger.purpose,'LOCAL_RELEASE');
    rows=[];
    const replay=await app.inject({method:'POST',url:'/api/v2/local-releases',headers,payload});assert.equal(replay.statusCode,202,replay.body);assert.equal(replay.json().replayed,true);assert.deepEqual((await store.get(command.commandId,record.institutionId,record.userId))?.payload.selectedComponentIds,['COMP_A','COMP_B']);
    const conflict=await app.inject({method:'POST',url:'/api/v2/local-releases',headers,payload:{...payload,quantity:1}});assert.equal(conflict.statusCode,409);
    const insufficient=await app.inject({method:'POST',url:'/api/v2/local-releases',headers:{...headers,'idempotency-key':'IDEM_INSUFFICIENT'},payload});assert.equal(insufficient.statusCode,409);assert.equal(insufficient.json().error.code,'RESERVATION_INSUFFICIENT_STOCK');
    const oldContract=await app.inject({method:'POST',url:'/api/v2/local-releases',headers:{...headers,'x-bloodledger-contract-version':'V2'},payload});assert.equal(oldContract.statusCode,400);
  }finally{await app.close();}
});
test('FR-12: OpenAPI component projection matches actual wire names and exposes no Donation No. material',async()=>{
  const document=JSON.parse(await readFile('openapi-v2.json','utf8'));
  const schema=document.components.schemas.ComponentProjection;
  for(const key of ['inventoryStatus','inventoryVersion','reservationVersion','issuerInstitutionId','institutionId','collectedAt','expiresAt'])assert.ok(schema.required.includes(key));
  for(const key of ['status','version','reservationPurpose','donationNumberDigest'])assert.equal(schema.properties[key],undefined);
  assert.equal(schema.properties.componentType.$ref,'#/components/schemas/ComponentTypeV21');
  assert.ok(document.components.schemas.ComponentTypeV21.enum.includes('CRYOPRECIPITATE'));
  assert.equal(document.paths['/local-releases/{releaseId}'],undefined);
});
