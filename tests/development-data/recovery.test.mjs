import {test} from 'node:test';import assert from 'node:assert/strict';
import {scenarios,digest,ledgerCommand,processSavedCommand} from '../../scripts/development-data/scenario.mjs';
const command={operation:'SUBMIT_TRANSFER',idempotencyKey:'IDEM_TEST',payload:{transferId:'TRF_TEST'},ledgerTransactionId:null};
const evidence={transactionId:'tx',blockNumber:'12',validationStatus:'VALID'};
test('NFR-02: saved policy version survives ledger preparation and recovery',async()=>{
 for(const policyVersion of ['INTERVIEW_DERIVED_CORE_V2','INTERVIEW_DERIVED_CORE_V2_1','PERSISTENT_DEVELOPMENT_CORE_V1']) {
  const savedCommand={...command,payload:{...command.payload,policyVersion}};
  assert.equal(ledgerCommand(savedCommand).payload.policyVersion,policyVersion);
  const f=setup({found:true}); f.setSaved(); f.state.command=savedCommand;
  f.state.ledger.inspect=async request=>{assert.equal(request.payload.policyVersion,policyVersion);return evidence;};
  await processSavedCommand(f.state);assert.equal(f.counts().submitted,0);
 }
 assert.equal(ledgerCommand(command).payload.policyVersion,'INTERVIEW_DERIVED_CORE_V2_1');
});
function setup({found=null,commit=null,queryError=false}={}) {
 let saved={transaction_id:null};let prepared=0,submitted=0,projected=0,committed=0,inspections=0;
 const state={command:{...command,ledgerTransactionId:commit},get saved(){return saved;},ledger:{prepare:async()=>{prepared++;return {transactionId:'tx',bytes:Buffer.from('signed')};},inspect:async()=>{inspections++;if(queryError)throw Error('QUERY_UNAVAILABLE');return submitted||found?evidence:null;},submitSaved:async s=>{assert.equal(s.transaction_id,'tx');assert.equal(saved.transaction_id,'tx');submitted++;}},saveSubmission:async s=>{saved={transaction_id:s.transactionId,signed_transaction:s.bytes};},saveCommit:async()=>{committed++;},project:async()=>{projected++;},complete:async()=>{}};
 return {state,setSaved:()=>{saved={transaction_id:'tx',signed_transaction:Buffer.from('signed')};},counts:()=>({prepared,submitted,projected,committed,inspections})};
}
test('NFR-05: saves signed envelope before first submission and checks valid commitment',async()=>{const f=setup();await processSavedCommand(f.state);assert.deepEqual(f.counts(),{prepared:1,submitted:1,projected:1,committed:1,inspections:2});});
test('NFR-05: ambiguous committed submission recovers without another submit',async()=>{const f=setup({found:true});f.setSaved();await processSavedCommand(f.state);assert.equal(f.counts().submitted,0);assert.equal(f.counts().prepared,0);assert.equal(f.counts().projected,1);});
test('NFR-05: query outage never permits blind resubmission',async()=>{const f=setup({queryError:true});f.setSaved();await assert.rejects(processSavedCommand(f.state),/QUERY_UNAVAILABLE/);assert.equal(f.counts().submitted,0);assert.equal(f.counts().projected,0);});
test('NFR-05: saved commitment only retries projection',async()=>{const f=setup({found:true,commit:'tx'});f.setSaved();await processSavedCommand(f.state);assert.equal(f.counts().submitted,0);assert.equal(f.counts().projected,1);});
test('NFR-02: missing saved commitment fails rather than resubmitting',async()=>{const f=setup({commit:'tx'});f.setSaved();await assert.rejects(processSavedCommand(f.state),/SAVED_COMMITMENT_NOT_FOUND/);assert.equal(f.counts().submitted,0);});
test('FR-01: private encrypted evidence is excluded from ledger arguments',()=>{const request=ledgerCommand({operation:'REGISTER_INBOUND_COMPONENT',idempotencyKey:'IDEM_TEST',payload:{donationNoLookupHmac:'hash',donationNoCiphertext:'secret',donationNoNonce:'nonce',captureId:'INCAP_TEST',captureMethod:'OCR',captureEvidenceDigest:'digest'}});assert.equal(request.payload.donationNoDigest,'hash');assert.equal(request.payload.captureMethod,'OCR');assert.equal(request.payload.captureEvidenceDigest,'digest');assert.equal(request.payload.donationNoCiphertext,undefined);assert.equal(request.payload.captureId,undefined);});
test('NFR-08: explicit-date scenario identities and counts are deterministic',()=>{assert.equal(digest(scenarios('2026-10-07')),digest(scenarios('2026-10-07')));assert.notEqual(digest(scenarios('2026-10-07')),digest(scenarios('2026-10-08')));assert.equal(scenarios('2026-10-07').length,9);assert.equal(new Set(scenarios('2026-10-07').map(r=>r.componentType)).size,5);assert.throws(()=>scenarios('2026-02-30'));});
