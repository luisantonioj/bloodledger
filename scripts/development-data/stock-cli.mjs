// TP-STOCK-01: confirmed OCR, durable queue, independent commitment evidence.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { canonical, digest, id, ledgerCommand, processSavedCommand } from './scenario.mjs';
import { recognizeScenarios } from './ocr.mjs';
import { privateJson, savePrivate, openInstitutionRuntime } from './institution-maintenance.mjs';
import { preservationSnapshot, verifyPreservation } from './stock-preservation.mjs';
import { PREVIEW_SCHEMA, EXECUTION_SCHEMA, requireStock, seal, unseal, allocateLabels, reservationPlan, freezePreview, operationsFor, requirePopulationWindow, verificationWindow, assertPreserved,verifyOperationalCensus,verifyCapturedCensus } from './stock-plan.mjs';
import { keyringFromEnvironment } from '../../services/api/build/src/donation-crypto.js';
import { PostgresV2CommandStore } from '../../services/api/build/src/v2-command.js';
import { PostgresV2Projector, PostgresV2ProjectionReader } from '../../services/api/build/src/database-v2.js';
import { PostgresMlInventorySnapshotStore, INTERNAL_ML_SNAPSHOT_POLICY_VERSION } from '../../services/api/build/src/census-worker.js';

import { fileDigest, resolveScenarioReview, validateReviewedScenarioBytes, validateExecutionReview, validationOwner } from './stock-review.mjs';

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const fieldEqual = (a,b) => requireStock(canonical(a) === canonical(b), 'STOCK_EVIDENCE_MISMATCH');
// The runtime role is not granted access to migrator-owned metadata.
export async function inspectMigrationEvidence(pool) {
  const {rows:[access]} = await pool.query("SELECT CASE WHEN has_schema_privilege(current_user, 'public', 'USAGE') THEN has_table_privilege(current_user, 'public.pgmigrations', 'SELECT') ELSE false END AS permitted");
  if (!access?.permitted) return {migrations:null,migrationEvidenceStatus:'REQUIRES_PRIVILEGED_READ'};
  const {rows} = await pool.query('SELECT name FROM public.pgmigrations ORDER BY name');
  return {migrations:rows.map(row=>row.name),migrationEvidenceStatus:'VERIFIED'};
}
const readAsset = async (runtime, componentId) => JSON.parse(Buffer.from(await runtime.ledger.contract.evaluateTransaction('ReadComponent', JSON.stringify({ actorUserId: runtime.principals.coordinator.userId, componentId }))).toString('utf8'));

export function journalProvenance(execution) {
  return {schemaVersion:execution.schemaVersion,manifestSha256:execution.manifestSha256,previewSha256:execution.previewSha256,scenarioSha256:execution.scenarioSha256,policySha256:execution.policySha256,principals:execution.principals,scenarioReview:execution.scenarioReview,
    operations:execution.operations.map(({account,path,idempotencyKey,commandId,payloadSha256})=>({account,path,idempotencyKey,commandId,payloadSha256})),
    components:execution.labels.map(({unitKey,componentId,donationId})=>({unitKey,componentId,donationId})),
    reservations:execution.reservations};
}

export function assertCommand(command, operation, execution) {
  const principal = execution.principals[operation.account];
  requireStock(command && command.commandId === operation.commandId && command.idempotencyKey === operation.idempotencyKey && command.actorUserId === principal.userId && command.actorInstitutionId === principal.institutionId && command.correlationId === operation.payload.correlationId, 'STOCK_COMMAND_OWNERSHIP_CONFLICT');
  const payload = command.payload;
  requireStock(payload.eventTime === execution.confirmedAt && payload.policyVersion === execution.policyVersion && payload.actorUserId === principal.userId, 'STOCK_COMMAND_PAYLOAD_CONFLICT');
  if (operation.path === '/api/v2/inbound-captures') {
    const label = execution.labels.find(label => label.idempotencyKey === operation.idempotencyKey);
    requireStock(command.operation === 'REGISTER_INBOUND_COMPONENT' && command.resourceId === id('INCAP_', operation.idempotencyKey), 'STOCK_COMMAND_OPERATION_CONFLICT');
    for (const key of ['componentId','donationId','componentType','bloodType','collectedAt','expiresAt','issuerInstitutionId','capturedAt']) fieldEqual(payload[key], label[key]);
    fieldEqual(payload.donationNoLookupHmac, label.lookupHmac);
    requireStock(payload.captureMethod === 'OCR' && payload.confirmedAt === execution.confirmedAt && payload.ocrEngine === label.engine && payload.ocrEngineVersion === label.engineVersion && payload.donationNumberConfidence === label.ocr.donationNumber && payload.bloodTypeConfidence === label.ocr.bloodType && payload.custodyInstitutionId === principal.institutionId, 'STOCK_COMMAND_OCR_CONFLICT');
  } else if (operation.path === '/api/v2/transfers') {
    requireStock(command.operation === 'SUBMIT_TRANSFER' && command.resourceId === operation.payload.transferId, 'STOCK_COMMAND_OPERATION_CONFLICT');
    for (const [key,value] of Object.entries(operation.payload)) fieldEqual(payload[key], value);
  } else {
    const reservation = execution.reservations.find(reservation => reservation.idempotencyKey === operation.idempotencyKey);
    requireStock(command.operation === (reservation.purpose === 'TRANSFER' ? 'RESERVE_COMPONENTS' : 'RESERVE_LOCAL_RELEASE'), 'STOCK_COMMAND_OPERATION_CONFLICT');
    for (const key of ['reservationId','purpose','bloodType','componentType','quantity','sourceInstitutionId','destinationInstitutionId','selectedComponentIds','expectedComponentVersions']) fieldEqual(payload[key], reservation[key]);
    fieldEqual(payload[reservation.purpose === 'TRANSFER' ? 'transferId' : 'localReleaseId'], reservation.workflowId);
  }
}

export function windowBoundLedger(ledger, scenario, now = () => new Date()) {
  return {
    inspect: request => ledger.inspect(request),
    prepare: request => { requirePopulationWindow(scenario, now()); return ledger.prepare(request); },
    submitSaved: request => { requirePopulationWindow(scenario, now()); return ledger.submitSaved(request); },
  };
}

async function bindRuntime(runtime, config, execution, review) {
  requireStock(config.targetSha256 === runtime.targetSha256 && config.policySha256 === runtime.policySha256, 'STOCK_TARGET_POLICY_APPROVAL_REQUIRED');
  if (review?.targetSha256) requireStock(review.targetSha256 === runtime.targetSha256 && review.policySha256 === runtime.policySha256, 'STOCK_SCENARIO_REVIEW_TARGET_DRIFT');
  if (execution) {
    validateExecutionReview(execution, review);
    requireStock(execution.targetSha256 === runtime.targetSha256 && execution.policySha256 === runtime.policySha256 && execution.policyVersion === runtime.policyVersion && execution.classification === 'SIMULATION_ONLY', 'STOCK_EXECUTION_TARGET_DRIFT');
    fieldEqual(execution.principals, runtime.principals);
  }
}

async function baselineComponents(runtime) {
  const reader = new PostgresV2ProjectionReader(runtime.pool);
  const rows = await reader.listComponents('INST_MEDIATRIX','ROLE-02');
  fieldEqual((await runtime.client.read('coordinator','/api/v2/components')).components, rows);
  requireStock(rows.length === 9, 'STOCK_REVIEWED_NINE_COMPONENT_BASELINE_REQUIRED');
  const counts = countStates(rows);
  fieldEqual(counts, { AVAILABLE:6, RESERVED:1, IN_TRANSIT:1, EXPIRED:1, total:9 });
  for (const row of rows) await compareCurrent(runtime,row);
  await verifyOriginalReceipts(runtime);
  const globalCount = Number((await runtime.pool.query('SELECT count(*) AS count FROM app.v2_components')).rows[0].count);
  requireStock(globalCount === rows.length, 'STOCK_UNREVIEWED_GLOBAL_STOCK');
  return rows;
}
async function verifyOriginalReceipts(runtime) {
  const original = (await runtime.pool.query("SELECT c.operation,c.payload,c.idempotency_key,c.ledger_transaction_id,s.transaction_id,s.signed_transaction,s.block_number FROM app.v2_commands c JOIN app.development_seed_commands s USING(command_id) WHERE c.status='COMMITTED' ORDER BY c.command_id")).rows;
  requireStock(original.length === 18,'STOCK_ORIGINAL_RECEIPTS_REQUIRED');
  for(const saved of original) {
    const evidence = await runtime.ledger.inspect({...saved,...ledgerCommand({...saved,idempotencyKey:saved.idempotency_key})});
    requireStock(evidence?.validationStatus === 'VALID' && evidence.transactionId === saved.ledger_transaction_id && String(evidence.blockNumber) === String(saved.block_number),'STOCK_ORIGINAL_COMMITMENT_MISMATCH');
  }
}
async function compareCurrent(runtime,row) {
  const asset = await readAsset(runtime,row.componentId);
  const receipt = (await runtime.pool.query('SELECT ledger_transaction_id FROM app.v2_components WHERE component_id=$1',[row.componentId])).rows[0];
  requireStock(asset.componentId === row.componentId && asset.donationId === row.donationId && asset.issuerInstitutionId === row.issuerInstitutionId && asset.componentType === row.componentType && asset.bloodType === row.bloodType && asset.collectedAt === row.collectedAt && asset.labelExpiry === row.expiresAt && asset.custodyInstitutionId === row.institutionId && asset.status === row.inventoryStatus && asset.version === row.inventoryVersion && (asset.reservationId ?? null) === row.reservationId && asset.lastTransactionId === receipt?.ledger_transaction_id, 'STOCK_CURRENT_LEDGER_PROJECTION_MISMATCH');
  return asset;
}
function countStates(components) {
  const result = { AVAILABLE:0, RESERVED:0, IN_TRANSIT:0, EXPIRED:0, total:components.length };
  for (const component of components) { requireStock(Object.hasOwn(result,component.inventoryStatus) && component.inventoryStatus !== 'total', 'STOCK_UNREVIEWED_COMPONENT_STATE'); result[component.inventoryStatus]++; }
  return result;
}

async function preview(runtime, config, options, review) {
  const archiveSha256 = fileDigest(await readFile(options.archive));
  requireStock(archiveSha256 === review.archiveSha256,'STOCK_ARCHIVE_HASH_MISMATCH');
  const scenario = validateReviewedScenarioBytes(await readFile(options.scenario), review);
  requirePopulationWindow(scenario,new Date());
  requireStock(fileDigest(await readFile('scripts/operational-scenario/scenario.py')) === review.generatorFileSha256 && fileDigest(await readFile('scripts/operational-scenario/verify.py')) === review.verifierFileSha256, 'STOCK_SCENARIO_VERIFIER_REVISION_MISMATCH');
  // Run only repository-owned, reviewed Buno code, never a path from an artifact.
  execFileSync('python3',['scripts/operational-scenario/verify.py','--workbook',options.workbook,'--manifest',options.scenario,'--sha256',review.scenarioFileSha256],{stdio:'pipe'});
  await requireQuiescent(runtime.pool);
  const baseline = await baselineComponents(runtime);
  const labels = allocateLabels(scenario,runtime.targetSha256,config.labelSequenceStart,keyringFromEnvironment().lookupKey);
  requireStock(new Set(labels.map(label => label.donationId)).size === 522 && new Set(labels.map(label => label.componentId)).size === 522, 'STOCK_COMPONENT_ID_COLLISION');
  for (const label of labels) {
    const collisions = await runtime.pool.query('SELECT 1 FROM app.v2_components WHERE component_id=$1 OR donation_number_lookup_hmac=$2 UNION ALL SELECT 1 FROM app.v2_commands WHERE idempotency_key=$3',[label.componentId,label.lookupHmac,label.idempotencyKey]);
    const ledgerIdentity = Buffer.from(await runtime.ledger.contract.evaluateTransaction('ReadComponentByIdentity',JSON.stringify({actorUserId:runtime.principals.coordinator.userId,componentType:label.componentType,donationNoDigest:label.lookupHmac,issuerInstitutionId:label.issuerInstitutionId}))).toString('utf8');
    requireStock(collisions.rows.length === 0 && ledgerIdentity === '', 'STOCK_LABEL_IDENTITY_COLLISION');
  }
  const runId = id('STOCK_',`${runtime.targetSha256}|${digest(scenario)}`);
  const reservations = reservationPlan(scenario,labels,baseline,new Date().toISOString(),runId);
  const baselineFingerprints = await preservationSnapshot(runtime.pool);
  const recognized = await recognizeScenarios(labels);
  requirePopulationWindow(scenario,new Date());
  assertPreserved(baselineFingerprints,await preservationSnapshot(runtime.pool));
  const value = seal({ schemaVersion:PREVIEW_SCHEMA, classification:'SIMULATION_ONLY',runId,scenario,archiveSha256,scenarioSha256:review.scenarioSha256,scenarioFileSha256:review.scenarioFileSha256,scenarioReview:review, labels:recognized,reservations,baselineComponents:baseline,baselineFingerprints,target:runtime.target,targetSha256:runtime.targetSha256,policySha256:runtime.policySha256,policyVersion:runtime.policyVersion,principals:runtime.principals,generatedAt:new Date().toISOString() });
  await savePrivate(options.output,value);
  console.log(canonical({runId,previewSha256:value.manifestSha256,recognizedUnits:522,confirmationRequired:'Review all recognized fields, then confirm this exact preview hash. Confirmation records the actual time and a new execution hash.'}));
}

async function requireQuiescent(pool, own = []) {
  const result = await pool.query("SELECT command_id FROM app.v2_commands WHERE status<>'COMMITTED' AND NOT(command_id=ANY($1::text[]))",[own]);
  requireStock(result.rows.length === 0,'STOCK_UNRELATED_PENDING_COMMANDS');
}
async function validateBackup(options, execution) {
  requireStock(options.backup && /^[a-f0-9]{64}$/.test(process.env.DEVELOPMENT_VALIDATED_BACKUP_SHA256 ?? ''), 'STOCK_VALIDATED_BACKUP_REQUIRED');
  const bytes = await readFile(options.backup);
  const hash = createHash('sha256').update(bytes).digest('hex');
  requireStock(bytes.subarray(0,5).toString() === 'PGDMP' && hash === process.env.DEVELOPMENT_VALIDATED_BACKUP_SHA256 && hash === options['approve-backup'], 'STOCK_BACKUP_APPROVAL_MISMATCH');
  if(execution) requireStock(hash === execution.backupSha256,'STOCK_BACKUP_EXECUTION_MISMATCH');
  requireStock(execution?.target?.instanceId === process.env.DEVELOPMENT_VALIDATED_BACKUP_INSTANCE_ID,'STOCK_BACKUP_TARGET_MISMATCH');
  return hash;
}

async function processOperation(runtime, execution, operation, action, options, processed) {
  const {pool,ledger,client} = runtime;
  const principal = execution.principals[operation.account], store = new PostgresV2CommandStore(pool), projector = new PostgresV2Projector(pool);
  let command = await store.get(operation.commandId,principal.institutionId,principal.userId);
  if (!command) {
    requireStock(action !== 'verify','STOCK_COMMAND_INCOMPLETE');
    requirePopulationWindow(execution.scenario,new Date());
    if(operation.path === '/api/v2/reservations' || operation.path === '/api/v2/local-releases') {
      const reservation = execution.reservations.find(item => item.idempotencyKey === operation.idempotencyKey);
      const stock = (await client.read('coordinator','/api/v2/components')).components.filter(c => c.inventoryStatus === 'AVAILABLE' && c.bloodType === reservation.bloodType && c.componentType === reservation.componentType && Date.parse(c.expiresAt) > Date.parse(execution.confirmedAt)).sort((a,b)=>Date.parse(a.expiresAt)-Date.parse(b.expiresAt)||a.componentId.localeCompare(b.componentId));
      fieldEqual(stock.slice(0,reservation.quantity).map(c=>c.componentId),reservation.selectedComponentIds);
      fieldEqual(stock.slice(0,reservation.quantity).map(c=>c.inventoryVersion),reservation.expectedComponentVersions);
    }
    // The institution's 30 attempts/15m protection includes successful grants.
    // Persisted acceptedAt also paces a resumed invocation; never loosen it.
    const last = (await pool.query('SELECT max(c.accepted_at) AS at FROM app.v2_commands c JOIN app.operational_stock_commands s USING(command_id) WHERE c.actor_institution_id=$1',[principal.institutionId])).rows[0]?.at;
    if(last) await pause(Math.max(0,35000-(Date.now()-new Date(last).getTime())));
    requirePopulationWindow(execution.scenario,new Date());
    const result = await client.command(operation.account,operation.path,operation.payload,operation.idempotencyKey);
    requireStock(result.commandId === operation.commandId && result.replayed === false,'STOCK_UNOWNED_COMMAND_COLLISION');
    command = await store.get(operation.commandId,principal.institutionId,principal.userId);
  }
  assertCommand(command,operation,execution);
  requireStock(!['FAILED','CONFLICT'].includes(command.status),'STOCK_COMMAND_TERMINAL');
  const owner = (await pool.query('SELECT run_id FROM app.operational_stock_commands WHERE command_id=$1',[operation.commandId])).rows[0];
  requireStock(!owner || owner.run_id === execution.runId,'STOCK_COMMAND_OWNERSHIP_CONFLICT');
  if(action !== 'verify') await pool.query('INSERT INTO app.operational_stock_commands(run_id,command_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[execution.runId,operation.commandId]);
  const saved = (await pool.query('SELECT * FROM app.operational_stock_commands WHERE command_id=$1 AND run_id=$2',[operation.commandId,execution.runId])).rows[0];
  requireStock(saved,'STOCK_COMMAND_OWNERSHIP_CONFLICT');
  let evidence;
  if(command.status === 'COMMITTED') {
    evidence = await ledger.inspect({...ledgerCommand(command),...saved});
    requireStock(evidence?.validationStatus === 'VALID' && evidence.transactionId === command.ledgerTransactionId && String(evidence.blockNumber) === String(saved.block_number),'STOCK_COMMIT_VERIFICATION_FAILED');
  } else {
    requireStock(action !== 'verify','STOCK_COMMAND_INCOMPLETE');
    const claimed = await pool.query("UPDATE app.v2_commands SET status='SUBMITTING',lease_owner=$2,lease_expires_at=now()+interval '15 minutes',attempt_count=attempt_count+1 WHERE command_id=$1 AND (lease_owner IS NULL OR lease_owner=$2)",[operation.commandId,execution.runId]);
    requireStock(claimed.rowCount === 1,'STOCK_COMMAND_LEASE_CONFLICT');
    evidence = await processSavedCommand({command,saved,ledger:windowBoundLedger(ledger,execution.scenario),
      afterSubmit: async()=>{if(Number(options['pause-after-submit']) === processed+1)throw new Error('STOCK_REQUESTED_AMBIGUOUS_PAUSE');},
      saveSubmission: async prepared=>{
        const saved = await pool.query('UPDATE app.operational_stock_commands SET transaction_id=$2,signed_transaction=$3 WHERE command_id=$1 AND run_id=$4 AND transaction_id IS NULL',[operation.commandId,prepared.transactionId,Buffer.from(prepared.bytes),execution.runId]);
        requireStock(saved.rowCount === 1,'STOCK_SUBMISSION_RACE');
      },
      saveCommit: async result=>{
        await store.markLedgerCommitted(operation.commandId,result.transactionId,new Date(),{asset:result.asset,blockNumber:result.blockNumber,validationStatus:result.validationStatus});
        const saved = await pool.query("UPDATE app.operational_stock_commands SET block_number=$2,validation_status='VALID',committed_at=COALESCE(committed_at,now()) WHERE command_id=$1 AND transaction_id=$3 AND (block_number IS NULL OR block_number=$2)",[operation.commandId,result.blockNumber,result.transactionId]);
        requireStock(saved.rowCount === 1,'STOCK_COMMITMENT_CONFLICT');
      },
      project: async result=>{
        if(Number(options['pause-after-commit']) === processed+1) throw new Error('STOCK_REQUESTED_PROJECTION_PAUSE');
        try {await projector.project(command,{transactionId:result.transactionId,result:result.asset});}
        catch(error) {await store.markProjectionRetry(operation.commandId,'STOCK_PROJECTION_RETRY',new Date(),new Date());throw error;}
      },complete:()=>store.markCommitted(operation.commandId,new Date()) });
  }
  return {commandId:operation.commandId,operation:command.operation,transactionId:evidence.transactionId,blockNumber:evidence.blockNumber,validationStatus:evidence.validationStatus,commitmentFirstObservedAt:saved.committed_at ?? (await pool.query('SELECT committed_at FROM app.operational_stock_commands WHERE command_id=$1',[operation.commandId])).rows[0].committed_at};
}

async function reconcile(runtime,execution,receipts) {
  await verifyOriginalReceipts(runtime);
  const rows = (await runtime.client.read('coordinator','/api/v2/components')).components;
  const reader = new PostgresV2ProjectionReader(runtime.pool);
  fieldEqual(rows,await reader.listComponents('INST_MEDIATRIX','ROLE-02'));
  const added = rows.filter(row=>execution.labels.some(label=>label.componentId === row.componentId));
  fieldEqual(countStates(added),{AVAILABLE:486,RESERVED:36,IN_TRANSIT:0,EXPIRED:0,total:522});
  fieldEqual(countStates(rows),{AVAILABLE:492,RESERVED:37,IN_TRANSIT:1,EXPIRED:1,total:531});
  requireStock(new Set(added.map(row=>row.donationId)).size === 522,'STOCK_SINGLETON_DONATION_MISMATCH');
  for(const row of rows) {
    await compareCurrent(runtime,row);
    const label = execution.labels.find(label=>label.componentId === row.componentId);
    if(label) for(const key of ['donationId','issuerInstitutionId','componentType','bloodType','collectedAt','expiresAt']) fieldEqual(row[key],label[key]);
    fieldEqual(await runtime.client.read('coordinator',`/api/v2/components/${row.componentId}`),row);
  }
  const transfers = await runtime.client.read('recipient','/api/v2/transfers');
  const reservations = [];
  for(const expected of execution.reservations) {
    const row = await runtime.client.read('coordinator',`/api/v2/reservations/${expected.reservationId}`);
    fieldEqual(row,await reader.getReservation(expected.reservationId,'INST_MEDIATRIX','ROLE-02'));
    requireStock(row.status === 'ACTIVE' && row.version === 1 && row.purpose === expected.purpose && row.sourceInstitutionId === expected.sourceInstitutionId && row.destinationInstitutionId === expected.destinationInstitutionId && row.components.length === expected.quantity,'STOCK_RESERVATION_STATE_MISMATCH');
    fieldEqual(row.components.map(c=>c.componentId).sort(),[...expected.selectedComponentIds].sort());
    requireStock(row.components.every(c=>c.inventoryStatus === 'RESERVED' && c.inventoryVersion === 2),'STOCK_RESERVATION_MEMBERSHIP_MISMATCH');
    requireStock(row[expected.purpose === 'TRANSFER' ? 'transferId':'localReleaseId'] === expected.workflowId,'STOCK_WORKFLOW_LINK_MISMATCH');
    if(expected.purpose === 'TRANSFER') requireStock(transfers.requests?.some(request=>request.transfer_id === expected.workflowId && request.source_institution_id === expected.sourceInstitutionId && request.destination_institution_id === expected.destinationInstitutionId && Number(request.quantity) === expected.quantity && request.status === 'PENDING'),'STOCK_TRANSFER_REQUEST_LINK_MISMATCH');
    reservations.push(row);
  }
  requireStock(reservations.length === 24 && reservations.reduce((n,r)=>n+r.components.length,0) === 36 && receipts.length === execution.operations.length,'STOCK_RECONCILIATION_MEMBERSHIP_MISMATCH');
  await verifyPreservation(runtime.pool,execution);
  const series = execution.scenario.counts.map(expected=>{
    const key = `${expected.componentType}|${expected.bloodType}`;
    const members = added.filter(row=>`${row.componentType}|${row.bloodType}` === key);
    const counts = countStates(members);
    requireStock(counts.AVAILABLE === expected.available && counts.RESERVED === expected.reserved && counts.total === expected.closing,'STOCK_SOURCE_SERIES_MISMATCH');
    return {series:key,...counts};
  });
  requireStock(series.length === 20,'STOCK_SERIES_RECONCILIATION_MISMATCH');
  return {series,newScenario:countStates(added),combined:countStates(rows),reservations:24,memberLinks:36,preservation:'PASS',currentLedgerAssetsVerified:rows.length};
}

export async function reconcileStockCensus(runtime,execution,existing,observedAt = new Date(),store = new PostgresMlInventorySnapshotStore(runtime.pool)) {
  let census = null;
  let censusApiStatus = null;
  const inWindow = verificationWindow(execution.scenario,observedAt);
  if(inWindow) {
    const scheduled = new Date(execution.scenario.t0);
    const snapshotId = id('CENSUS_',`INST_MEDIATRIX|${scheduled.toISOString()}|${INTERNAL_ML_SNAPSHOT_POLICY_VERSION}`);
    await runtime.pool.query('UPDATE app.operational_stock_runs SET census_snapshot_id=$2 WHERE run_id=$1 AND (census_snapshot_id IS NULL OR census_snapshot_id=$2)',[execution.runId,snapshotId]);
    census = await store.capture('INST_MEDIATRIX',scheduled,'MANUAL',observedAt);
    requireStock(census.snapshotId === snapshotId && census.groups.reduce((n,g)=>n+g.bloodTypes.length,0) === 40,'STOCK_CENSUS_RECONCILIATION_MISMATCH');
  } else if(existing?.census_snapshot_id) {
    // An ordinary restart after the window verifies the original capture;
    // it must not create a newly backdated snapshot or erase a genuine PASS.
    census = await store.get(existing.census_snapshot_id,'INST_MEDIATRIX');
    requireStock(census,'STOCK_PERSISTED_CENSUS_MISSING');
    const expectedId = id('CENSUS_',`INST_MEDIATRIX|${new Date(execution.scenario.t0).toISOString()}|${INTERNAL_ML_SNAPSHOT_POLICY_VERSION}`);
    requireStock(census.snapshotId === existing.census_snapshot_id && census.snapshotId === expectedId,'STOCK_PERSISTED_CENSUS_ID_MISMATCH');
  }
  if(census) {
    verifyCapturedCensus(execution.scenario,census);
    verifyOperationalCensus(census,(await runtime.client.read('coordinator','/api/v2/components')).components);
    const businessDate = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date(execution.scenario.t0));
    const evidence = await runtime.client.read('coordinator',`/api/v2/analytics/inventory-evidence?businessDate=${businessDate}`);
    requireStock(evidence.snapshot?.snapshotId === census.snapshotId && evidence.snapshot.persistedSeries === 40 && ['CURRENT','STALE'].includes(evidence.status),'STOCK_CENSUS_API_MISMATCH');
    for(const key of ['capturedAt','scheduledFor','sourceProjectionDigest','groups']) fieldEqual(evidence.snapshot[key],census[key]);
    requireStock(!inWindow || evidence.status === 'CURRENT','STOCK_CENSUS_API_MISMATCH');
    censusApiStatus = evidence.status;
  }
  return {census,censusApiStatus,inWindow};
}

async function execute(runtime,config,options,action,execution,review) {
  requireStock(execution.schemaVersion === EXECUTION_SCHEMA,'STOCK_EXECUTION_SCHEMA_INVALID');
  validateExecutionReview(execution,review);
  requirePopulationWindow(execution.scenario,execution.confirmedAt);
  const plannedLabels = allocateLabels(execution.scenario,runtime.targetSha256,config.labelSequenceStart,keyringFromEnvironment().lookupKey);
  requireStock(plannedLabels.length === execution.labels.length,'STOCK_EXECUTION_LABEL_MAPPING_INVALID');
  for(let index=0;index<plannedLabels.length;index++) for(const [key,value] of Object.entries(plannedLabels[index])) fieldEqual(execution.labels[index][key],value);
  fieldEqual(execution.operations,operationsFor(execution));
  requireStock(digest(execution.reservations) === digest(reservationPlan(execution.scenario,execution.labels,execution.baselineComponents,execution.confirmedAt,execution.runId)),'STOCK_EXECUTION_RESERVATION_INVALID');
  requireStock(execution.runId === id('STOCK_',`${runtime.targetSha256}|${review.scenarioSha256}`),'STOCK_RUN_ID_INVALID');
  if(action !== 'verify') await validateBackup(options,execution);
  requireStock(config.writersQuiesced === true,'STOCK_WRITER_QUIESCENCE_REQUIRED');
  requireStock(!(options['pause-after-submit'] || options['pause-after-commit'] || options['stop-after']) || config.validationFaultInjection === true,'STOCK_FAULT_INJECTION_NOT_APPROVED');
  const lock = await runtime.pool.connect();
  try {
    requireStock((await lock.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',['controlled-stock-population'])).rows[0].acquired,'STOCK_ALREADY_RUNNING');
    await requireQuiescent(runtime.pool,execution.operations.map(op=>op.commandId));
    const existing = (await runtime.pool.query('SELECT * FROM app.operational_stock_runs WHERE run_id=$1',[execution.runId])).rows[0];
    requireStock(!existing || existing.manifest_sha256 === execution.manifestSha256,'STOCK_REPLAY_MANIFEST_CONFLICT');
    if(!existing) {
      requireStock(action !== 'verify','STOCK_RUN_NOT_FOUND');
      requirePopulationWindow(execution.scenario,new Date());
      assertPreserved(execution.baselineFingerprints,await preservationSnapshot(runtime.pool));
      await runtime.pool.query("INSERT INTO app.operational_stock_runs(run_id,scenario_sha256,manifest_sha256,target_sha256,backup_sha256,manifest,confirmed_at,classification) VALUES($1,$2,$3,$4,$5,$6,$7,'SIMULATION_ONLY')",[execution.runId,review.scenarioSha256,execution.manifestSha256,runtime.targetSha256,execution.backupSha256,journalProvenance(execution),execution.confirmedAt]);
    }
    await verifyPreservation(runtime.pool,execution);
    const receipts = [];
    for(const operation of execution.operations) {
      receipts.push(await processOperation(runtime,execution,operation,action,options,receipts.length));
      await verifyPreservation(runtime.pool,execution);
      if(receipts.length % 10 === 0) console.log(canonical({runId:execution.runId,verifiedCommands:receipts.length,total:execution.operations.length}));
      if(Number(options['stop-after']) === receipts.length) throw new Error('STOCK_REQUESTED_SAFE_PAUSE');
    }
    const reconciliation = await reconcile(runtime,execution,receipts);
    const {census,censusApiStatus,inWindow} = await reconcileStockCensus(runtime,execution,existing);
    if(census) {
      await verifyPreservation(runtime.pool,execution);
      if(inWindow) await runtime.pool.query('UPDATE app.operational_stock_runs SET writer_lock=false WHERE run_id=$1',[execution.runId]);
    }
    const report = {classification:'SIMULATION_ONLY',hostValidation:validationOwner(config),runId:execution.runId,executionSha256:execution.manifestSha256,targetSha256:runtime.targetSha256,policySha256:runtime.policySha256,verifiedAt:new Date().toISOString(),t0Verification:census?'PASS':Date.now()<Date.parse(execution.scenario.t0)?'PENDING':'MISSED_WINDOW',...reconciliation,receipts,census,censusApiStatus,nearExpiry:'DISABLED_UNAPPROVED_POLICY',v4Default:true,v5:'SEPARATE_APPROVAL_REQUIRED'};
    await savePrivate(options.report,report);
    console.log(canonical({runId:execution.runId,validTransactions:receipts.length,newUnits:522,totalUnits:531,t0Verification:report.t0Verification,report:options.report}));
  } finally {await lock.query('SELECT pg_advisory_unlock_all()');lock.release();}
}

export async function main(args = process.argv.slice(2)) {
  const action = args.shift(), options = {};
  requireStock(['inspect','preview','confirm','apply','resume','verify'].includes(action),'STOCK_ACTION_INVALID');
  for(let i=0;i<args.length;i+=2) {
    const key = args[i]?.replace(/^--/,'');
    requireStock(['config','scenario','archive','workbook','manifest','approve-manifest','output','report','backup','approve-backup','stop-after','pause-after-submit','pause-after-commit','scenario-review','approve-scenario-review'].includes(key) && args[i+1] && !options[key],'STOCK_ARGUMENT_INVALID');
    options[key] = args[i+1];
  }
  if (['apply','resume','verify'].includes(action)) {
    requireStock(options.report && !options.output, 'STOCK_REPORT_REQUIRED');
  }
  requireStock(Boolean(options['scenario-review']) === Boolean(options['approve-scenario-review']), 'STOCK_SCENARIO_REVIEW_APPROVAL_REQUIRED');
  const review = resolveScenarioReview(options['scenario-review'] ? await privateJson(options['scenario-review']) : undefined, options['approve-scenario-review']);
  const config = await privateJson(options.config);
  validationOwner(config);
  const runtime = await openInstitutionRuntime(config,true);
  try {
    if(action === 'inspect') {
      const inspection = {target:runtime.target,targetSha256:runtime.targetSha256,principals:runtime.principals,policySha256:runtime.policySha256,policyVersion:runtime.policyVersion,classification:'SIMULATION_ONLY',hostValidation:validationOwner(config)};
      if(options.output) {
        inspection.baselineFingerprints = await preservationSnapshot(runtime.pool);
        inspection.counts = (await runtime.pool.query("SELECT (SELECT count(*) FROM app.v2_components)::int AS operational, (SELECT count(*) FROM app.synthetic_inventory_completed_units)::int AS historical, (SELECT count(*) FROM app.operational_stock_runs)::int AS stock_runs, (SELECT count(*) FROM app.application_users WHERE account_kind='PRIMARY' AND status='ACTIVE')::int AS primary_accounts, (SELECT count(*) FROM app.institution_operators)::int AS operators")).rows[0];
        Object.assign(inspection,await inspectMigrationEvidence(runtime.pool));
        await savePrivate(options.output,inspection);
      }
      console.log(canonical(inspection));return;
    }
    await bindRuntime(runtime,config,undefined,review);
    if(action === 'preview') return await preview(runtime,config,options,review);
    const manifest = await privateJson(options.manifest);
    unseal(manifest,options['approve-manifest']);
    await bindRuntime(runtime,config,manifest,review);
    if(action === 'confirm') {
      const backupSha256 = await validateBackup(options,{...manifest,backupSha256:options['approve-backup']});
      assertPreserved(manifest.baselineFingerprints,await preservationSnapshot(runtime.pool));
      const execution = freezePreview(manifest,options['approve-manifest'],new Date());
      const {manifestSha256,...unsigned} = execution;
      const frozen = seal({...unsigned,backupSha256});
      await savePrivate(options.output,frozen);
      console.log(canonical({executionSha256:frozen.manifestSha256,previewSha256:frozen.previewSha256,confirmedAt:frozen.confirmedAt,commands:frozen.operations.length,applyRequires:'Exact execution hash, validated backup, approved target and quiesced writers.'}));
    } else await execute(runtime,config,options,action,manifest,review);
  } finally {await runtime.close();}
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'STOCK_PREREQUISITE_OR_OPERATION_FAILED');process.exitCode=2;});
