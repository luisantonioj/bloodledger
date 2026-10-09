// TP-STOCK-01 / FR-12 / NFR-05: fixtures below are planner tests, not a population package.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest } from '../../scripts/development-data/scenario.mjs';
import { seal, allocateLabels, requirePopulationWindow, verifyCapturedCensus } from '../../scripts/development-data/stock-plan.mjs';
import { LEGACY_SCENARIO_REVIEW as legacy, resolveScenarioReview, validateReviewedScenarioBytes, validateExecutionReview, fileDigest, validationOwner } from '../../scripts/development-data/stock-review.mjs';
import { hashTree, compareRetainedFiles } from '../../scripts/development-data/retained-files.mjs';
import { main } from '../../scripts/development-data/stock-cli.mjs';
function fixture() {
  const scenario={schemaVersion:'OPERATIONAL_SCENARIO_V1',scenarioVersion:'SYNTHETIC_OPERATIONAL_STOCK_522_V2',classification:'SIMULATION_ONLY',generatedAt:legacy.generatedAt,source:{workbookSha256:legacy.sourceWorkbookSha256,countsSha256:legacy.sourceCountsSha256},generator:{fileSha256:'a'.repeat(64),revision:'b'.repeat(40)},populationNotBefore:'2026-10-10T08:00:00Z',t0:'2026-10-11T00:00:00Z',verificationWindowEndExclusive:'2026-10-11T08:00:00Z'};
  const bytes=Buffer.from(JSON.stringify(scenario)+'\n');
  const sealed=seal({...legacy,reviewStatus:'ACCEPTED',reviewReference:'https://github.com/luisantonioj/bloodledger/pull/30',targetSha256:'c'.repeat(64),policySha256:'d'.repeat(64),scenarioVersion:scenario.scenarioVersion,scenarioFileSha256:fileDigest(bytes),scenarioSha256:digest(scenario),archiveSha256:'e'.repeat(64),generatorFileSha256:scenario.generator.fileSha256,generatorRevision:scenario.generator.revision,populationNotBefore:scenario.populationNotBefore,t0:scenario.t0,verificationWindowEndExclusive:scenario.verificationWindowEndExclusive});
  return {scenario,bytes,sealed,review:resolveScenarioReview(sealed,sealed.manifestSha256)};
}
test('TP-STOCK-01: missing, forged and changed review approval fail closed; V1 remains pinned',()=>{
  assert.deepEqual(resolveScenarioReview(),legacy);const {sealed}=fixture();
  assert.throws(()=>resolveScenarioReview(sealed),/APPROVAL_INVALID/);
  assert.throws(()=>resolveScenarioReview({...sealed,t0:legacy.t0},sealed.manifestSha256),/APPROVAL_INVALID/);
  assert.throws(()=>resolveScenarioReview(undefined,'f'.repeat(64)),/REVIEW_REQUIRED/);
  for(const change of [{reviewStatus:'PROPOSED'},{sourceWorkbookSha256:'f'.repeat(64)},{sourceCountsSha256:'f'.repeat(64)},{scenarioVersion:legacy.scenarioVersion},{t0:legacy.t0},{targetSha256:'invalid'},{classification:'OPERATIONAL'},{password:'UNEXPECTED_TEST_FIELD'},{generatedAt:'2999-01-01T00:00:00Z'}]) {
    const {manifestSha256,...value}=sealed;const resealed=seal({...value,...change});assert.throws(()=>resolveScenarioReview(resealed,resealed.manifestSha256));
  }
});
test('TP-STOCK-01: reviewed bytes bind lineage, dates and exact archive/execution; no self-renewal',()=>{
  const {scenario,bytes,review}=fixture();assert.deepEqual(validateReviewedScenarioBytes(bytes,review),scenario);
  assert.throws(()=>validateReviewedScenarioBytes(Buffer.from(bytes.toString().trim()),review),/FILE_MISMATCH/);
  const execution={scenario,scenarioSha256:review.scenarioSha256,scenarioFileSha256:review.scenarioFileSha256,archiveSha256:review.archiveSha256,scenarioReview:review};validateExecutionReview(execution,review);
  assert.throws(()=>validateExecutionReview({...execution,archiveSha256:legacy.archiveSha256},review),/REVIEW_MISMATCH/);
  assert.throws(()=>validateExecutionReview({...execution,scenarioReview:{...review,targetSha256:'f'.repeat(64)}},review),/REVIEW_MISMATCH/);
  assert.throws(()=>validateExecutionReview(execution,legacy),/CANONICAL_MISMATCH/);
  const altered={...scenario,t0:legacy.t0};assert.throws(()=>validateReviewedScenarioBytes(Buffer.from(JSON.stringify(altered)),{...review,scenarioFileSha256:fileDigest(Buffer.from(JSON.stringify(altered))),scenarioSha256:digest(altered)}),/WINDOW_MISMATCH/);
  requirePopulationWindow(scenario,'2026-10-10T12:00:00Z');assert.throws(()=>requirePopulationWindow(scenario,scenario.t0),/CLOSED/);
});
test('NFR-05: scenario-specific IDs prevent adopting prior execution under a new version',()=>{
  const unit={unitKey:'UNIT_TEST',collectedAt:'2026-10-08T00:00:00Z',expiresAt:'2026-10-12T00:00:00Z',issuerInstitutionId:'INST_MEDIATRIX'};
  const first={units:[unit]},second={units:[unit],scenarioVersion:'TEST_SUCCESSOR'};
  const a=allocateLabels(first,'a'.repeat(64),1000,Buffer.alloc(32)),b=allocateLabels(second,'a'.repeat(64),1000,Buffer.alloc(32));
  assert.notEqual(a[0].componentId,b[0].componentId);assert.notEqual(a[0].idempotencyKey,b[0].idempotencyKey);
  assert.equal(a[0].donationId,b[0].donationId); // unchanged Donation No. still collides; preview must reject it.
  assert.deepEqual(a,allocateLabels(first,'a'.repeat(64),1000,Buffer.alloc(32)));
});
test('FR-09/14: preserved T0 evidence remains valid later; late or future capture cannot replace it',()=>{
  const scenario={t0:'2026-10-01T00:00:00Z',verificationWindowEndExclusive:'2026-10-01T08:00:00Z'};
  verifyCapturedCensus(scenario,{scheduledFor:'2026-10-01T00:00:00.000Z',capturedAt:'2026-10-01T00:15:00Z'});
  assert.throws(()=>verifyCapturedCensus(scenario,{scheduledFor:'2026-10-01T00:00:00.000Z',capturedAt:'2026-10-01T08:00:00Z'}),/WINDOW_INVALID/);
  assert.throws(()=>verifyCapturedCensus(scenario,{scheduledFor:'2026-10-02T00:00:00.000Z',capturedAt:'2026-10-01T00:15:00Z'}),/WINDOW_INVALID/);
  const future={t0:'2999-10-01T00:00:00Z',verificationWindowEndExclusive:'2999-10-01T08:00:00Z'};assert.throws(()=>verifyCapturedCensus(future,{scheduledFor:'2999-10-01T00:00:00.000Z',capturedAt:'2999-10-01T00:15:00Z'}),/FUTURE_INVALID/);
});
test('NFR-12: identity/key bytes and modes/mounts are preserved without disclosing contents',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'stock-files-test-'));try{
    await writeFile(join(dir,'key'),'SYNTHETIC_TEST_BYTES',{mode:0o600});const files=await hashTree(dir);assert.equal(files.length,1);assert.doesNotMatch(JSON.stringify(files),/SYNTHETIC_TEST_BYTES/);
    const baseline={classification:'SIMULATION_ONLY',files,mounts:{postgres:[{Name:'bloodledger_postgres-data'}]},volumes:{'bloodledger_postgres-data':'original-time'}};compareRetainedFiles(baseline,{...baseline,capturedAt:'later'});
    await writeFile(join(dir,'key'),'CHANGED_TEST_BYTES');assert.throws(()=>compareRetainedFiles(baseline,{...baseline,files:[]}),/CHANGED/);assert.throws(()=>compareRetainedFiles(baseline,{...baseline,volumes:{}}),/CHANGED/);assert.throws(()=>compareRetainedFiles(baseline,{...baseline,files:[{...files[0],mode:0o644}]}),/CHANGED/);
    assert.notDeepEqual(await hashTree(dir),files);await symlink(join(dir,'key'),join(dir,'link'));await assert.rejects(hashTree(dir),/SYMLINK_UNREVIEWED/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('TP-STOCK-01: Lat evidence attribution is explicit; paired review arguments precede target access',async()=>{
  assert.equal(validationOwner({}),'JOPIA_SELF_VALIDATION');assert.equal(validationOwner({hostValidation:'LAT_LOCAL_VALIDATION'}),'LAT_LOCAL_VALIDATION');assert.throws(()=>validationOwner({hostValidation:'BOTH_PASSED'}),/OWNER_INVALID/);
  await assert.rejects(main(['preview','--scenario-review','/does-not-exist']),/APPROVAL_REQUIRED/);
  await assert.rejects(main(['preview','--approve-scenario-review','a'.repeat(64)]),/APPROVAL_REQUIRED/);
});
