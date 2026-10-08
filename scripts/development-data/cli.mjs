import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { Pool } from 'pg';
import { canonical, digest, id, scenarios, processSavedCommand, ledgerCommand } from './scenario.mjs';
import { recognizeScenarios } from './ocr.mjs';
import { HistoricalLedger } from '../historical-inventory/ledger.mjs';
import { PostgresV2CommandStore } from '../../services/api/build/src/v2-command.js';
import { PostgresV2Projector } from '../../services/api/build/src/database-v2.js';
import { PostgresSessionRepository } from '../../services/api/build/src/database-session.js';
import { verifyPassword } from '../../services/api/build/src/session.js';
import { PostgresMlInventorySnapshotStore } from '../../services/api/build/src/census-worker.js';
import policy from '../../chaincode/policy/interview-core-v2-1.json' with {type:'json'};
import developmentPolicy from '../../chaincode/policy/persistent-development-core-v1.json' with {type:'json'};

async function main() {
const args=process.argv.slice(2);const action=args[0]?.startsWith('--')?'preview':args.shift()??'preview';const options={};
for(let index=0;index<args.length;index+=2) {const key=args[index]?.replace(/^--/,'');if(!['config','date','manifest','approve-manifest','output','report','stop-after','scheduled-for','pause-after-commit','pause-after-submit'].includes(key)||options[key]||!args[index+1]) throw new Error('SEED_ARGUMENT_INVALID');options[key]=args[index+1];}
if(!['inspect','preview','apply','resume','verify','census'].includes(action)) throw new Error('SEED_ACTION_INVALID');
if(existsSync('.env')) process.loadEnvFile('.env');
if(!options.config || ((await stat(options.config)).mode & 0o077)!==0) throw new Error('SEED_PRIVATE_CONFIG_PERMISSIONS_REQUIRED');
const config=JSON.parse(await readFile(options.config,'utf8'));
if(config.classification!=='SIMULATION_ONLY'||config.scope!=='PERSISTENT_LOCAL_DEVELOPMENT') throw new Error('SEED_CONFIG_SCOPE_REQUIRED');
const pgHost=process.env.DEVELOPMENT_PG_HOST??'127.0.0.1';
if(!['127.0.0.1','localhost','postgres'].includes(pgHost)||process.env.POSTGRES_DB!=='bloodledger_dev'||process.env.POSTGRES_APP_USER!=='bloodledger_app') throw new Error('SEED_LOCAL_TARGET_REQUIRED');
const pool=new Pool({host:pgHost,port:Number(process.env.DEVELOPMENT_PG_PORT??process.env.POSTGRES_HOST_PORT??5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_APP_USER,password:process.env.POSTGRES_APP_PASSWORD,max:3});
let ledger;
const savedFile=async(path,value)=>{if(!path) throw new Error('SEED_OUTPUT_REQUIRED');const dest=resolve(path),rel=relative(process.cwd(),dest);if(!rel.startsWith('..')&&!rel.startsWith('build/')) throw new Error('SEED_PRIVATE_OUTPUT_REQUIRED');await writeFile(dest,canonical(value)+'\n',{mode:0o600,flag:'wx'});};
try {
  const identity=(await pool.query('SELECT instance_id FROM app.development_target_identity WHERE singleton')).rows[0];
  if(!identity) throw new Error('SEED_MIGRATION_REQUIRED');
  ledger=(await HistoricalLedger.connect()).useContract('InterviewCoreContract');
  const target={genesisSha256:await ledger.genesisDigest(),database:process.env.POSTGRES_DB,instanceId:identity.instance_id,volume:process.env.DEVELOPMENT_TARGET_VOLUME,volumeCreatedAt:process.env.DEVELOPMENT_TARGET_VOLUME_CREATED,channel:'bloodledger-dev'};
  if(!target.volume||!target.volumeCreatedAt) throw new Error('SEED_RETAINED_VOLUME_EVIDENCE_REQUIRED');
  const targetSha256=digest(target);
  const repo=new PostgresSessionRepository(pool);const principals={};const policyVersions={};const policySha256={};
  for(const name of ['coordinator','recipient']) {
    const privateAccount=config.accounts?.[name];if(!privateAccount) throw new Error('SEED_ACCOUNT_MAPPING_REQUIRED');
    let credential=await repo.findCredential(privateAccount.username);
    // Existing frozen runs retain their original actors after institution migration.
    // Maintenance verification/recovery is not interactive login authorization.
    if(!credential && ['verify','resume'].includes(action)) {
      const retained=(await pool.query("SELECT u.user_id,u.institution_id,u.password_salt,u.password_verifier,r.role_id FROM app.application_users u JOIN app.user_role_assignments r USING(user_id) WHERE u.username=$1 AND u.account_kind IN ('OPERATOR','RETIRED')",[privateAccount.username])).rows[0];
      if(retained)credential={userId:retained.user_id,institutionId:retained.institution_id,roleId:retained.role_id,saltHex:retained.password_salt,verifierHex:retained.password_verifier};
    }
    if(!credential||!await verifyPassword(privateAccount.password,credential)) throw new Error('SEED_ACCOUNT_CREDENTIAL_INVALID');
    const activePolicy=developmentPolicy.developmentActorIds.includes(credential.userId)?developmentPolicy:policy;
    const actor=activePolicy.actors[credential.userId];
    if(!actor||actor.role!==credential.roleId.replace('-','_')||actor.institutionId!==credential.institutionId||credential.roleId!==(name==='coordinator'?'ROLE-02':'ROLE-03')) throw new Error('SEED_FABRIC_ACTOR_MAPPING_REQUIRED');
    principals[name]={userId:credential.userId,institutionId:credential.institutionId,roleId:credential.roleId};
    // Match the contract's immutable parsed-JSON serialization, not manifest canonicalization.
    policyVersions[name]=activePolicy.policyVersion;policySha256[name]=digest(JSON.stringify(activePolicy));
    const installed=JSON.parse(Buffer.from(await ledger.contract.evaluateTransaction('ReadActorPolicy',JSON.stringify({actorUserId:credential.userId,policyVersion:activePolicy.policyVersion}))).toString('utf8'));
    if(installed.userId!==credential.userId||installed.role!==actor.role||installed.institutionId!==actor.institutionId||installed.policyVersion!==activePolicy.policyVersion||installed.policySha256!==policySha256[name]||installed.classification!=='SIMULATION_ONLY') throw new Error('SEED_INSTALLED_POLICY_MISMATCH');
  }
  if(action==='inspect') {
    console.log(canonical({target,targetSha256,principals,policyVersions,policySha256,classification:'SIMULATION_ONLY',prerequisites:{keys:!!(process.env.BLOODLEDGER_DONATION_ENCRYPTION_KEY&&process.env.BLOODLEDGER_DONATION_LOOKUP_KEY),migration:true}}));
  } else {
    if(config.targetSha256!==targetSha256) throw new Error('SEED_APPROVED_TARGET_MISMATCH');
    if(action==='census') {
      const scheduled=new Date(options['scheduled-for']);if(!Number.isFinite(scheduled.getTime())||scheduled>new Date()) throw new Error('SEED_CENSUS_TIME_INVALID');
      const snapshot=await new PostgresMlInventorySnapshotStore(pool).capture('INST_MEDIATRIX',scheduled,'MANUAL',new Date());
      console.log(canonical({snapshotId:snapshot.snapshotId,countCombinations:snapshot.groups.reduce((sum,g)=>sum+g.bloodTypes.length,0),capturedAt:snapshot.capturedAt,classification:'SIMULATION_ONLY'}));
    } else if(action==='preview') {
      const labels=await recognizeScenarios(scenarios(options.date));
      const generatedAt=new Date().toISOString();
      const manifest={schemaVersion:'PERSISTENT_DEVELOPMENT_SEED_V1',classification:'SIMULATION_ONLY',target,targetSha256,businessDate:options.date,principals,policyVersions,policySha256,generatedAt,labels,scenarios:['FIVE_TYPES_AVAILABLE','ACTIVE_RESERVATION','PREPARED_DISPATCHED_IN_TRANSIT','PENDING_REQUEST','EXPIRED','IMMINENT_EXPIRY_POLICY_DISABLED']};
      manifest.seedId=id('SEED_',`${targetSha256}|${options.date}|V1`);manifest.manifestSha256=digest(manifest);
      await savedFile(options.output,manifest);console.log(canonical({seedId:manifest.seedId,manifestSha256:manifest.manifestSha256,componentCount:labels.length,confirmationRequired:'Review exact recognized synthetic fields and approve manifest hash. This constitutes synthetic operator confirmation only.'}));
    } else {
      const manifest=JSON.parse(await readFile(options.manifest,'utf8'));const {manifestSha256,...unsigned}=manifest;
      if(manifestSha256!==digest(unsigned)||manifest.targetSha256!==targetSha256||canonical(manifest.principals)!==canonical(principals)||manifest.classification!=='SIMULATION_ONLY'||manifest.schemaVersion!=='PERSISTENT_DEVELOPMENT_SEED_V1'||options['approve-manifest']!==manifestSha256) throw new Error('SEED_MANIFEST_OR_APPROVAL_INVALID');
      const legacyVersions={coordinator:policy.policyVersion,recipient:policy.policyVersion};
      if(canonical(manifest.policyVersions??legacyVersions)!==canonical(policyVersions)||(manifest.policySha256&&canonical(manifest.policySha256)!==canonical(policySha256))) throw new Error('SEED_MANIFEST_POLICY_MISMATCH');
      const lock=await pool.connect();
      try {
        const acquired=(await lock.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',['development-seed:'+manifest.seedId])).rows[0].acquired;if(!acquired) throw new Error('SEED_ALREADY_RUNNING');
        const store=new PostgresV2CommandStore(pool),projector=new PostgresV2Projector(pool);
        // The inspected channel connection is reused; target includes genesis hash.
        const run=(await pool.query('SELECT manifest_sha256 FROM app.development_seed_runs WHERE seed_id=$1',[manifest.seedId])).rows[0];
        if(run&&run.manifest_sha256!==manifestSha256) throw new Error('SEED_REPLAY_MANIFEST_CONFLICT');
        const cookies={};
        const apiUrl=process.env.DEVELOPMENT_API_URL??'http://127.0.0.1:3000';
        if(!/^http:\/\/(127\.0\.0\.1|localhost|host\.docker\.internal|bloodledger-persistent-api):3000$/.test(apiUrl)) throw new Error('SEED_LOCAL_API_REQUIRED');
        const request=async(name,path,payload,key)=>{
          if(!cookies[name]) {
            const login=await fetch(apiUrl+'/api/v1/auth/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:5174'},body:JSON.stringify(config.accounts[name])});
            if(!login.ok) throw new Error('SEED_OFFICIAL_LOGIN_FAILED');cookies[name]=login.headers.get('set-cookie')?.split(';')[0];if(!cookies[name]) throw new Error('SEED_COOKIE_REQUIRED');
          }
          const response=await fetch(apiUrl+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:5174',Cookie:cookies[name],'Idempotency-Key':key,'X-BloodLedger-Contract-Version':'V2.1'},body:JSON.stringify(payload)});
          const body=await response.json();if(!response.ok) throw new Error(body.error?.code??'SEED_API_REJECTED');return body;
        };
        if ((options['pause-after-commit'] || options['pause-after-submit']) && config.validationFaultInjection !== true) throw new Error('SEED_VALIDATION_FAULT_INJECTION_NOT_ENABLED');
        const receipts=[];let processed=0;
        const send=async(name,path,payload,key)=>{
          const commandId=id('CMD_',key);
          let command=await store.get(commandId,principals[name].institutionId,principals[name].userId);
          if(action==='verify') {
            if(!command||command.status!=='COMMITTED') throw new Error('SEED_COMMAND_INCOMPLETE');
          } else {
            const ownership=(await pool.query('SELECT seed_id FROM app.development_seed_commands WHERE command_id=$1',[commandId])).rows[0];
            if(ownership&&ownership.seed_id!==manifest.seedId) throw new Error('SEED_OWNERSHIP_MISMATCH');
            if(!command||!ownership) {if(action==='resume' && !(await repo.findCredential(config.accounts[name].username)))throw new Error('SEED_RETIRED_ACCOUNT_NEW_COMMAND_FORBIDDEN');const response=await request(name,path,payload,key);if(response.commandId!==commandId) throw new Error('SEED_COMMAND_ID_MISMATCH');command=await store.get(commandId,principals[name].institutionId,principals[name].userId);}
            if(!command||['FAILED','CONFLICT'].includes(command.status)) throw new Error('SEED_COMMAND_FAILED');
            await pool.query('INSERT INTO app.development_seed_commands(seed_id,command_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[manifest.seedId,commandId]);
          }
          const saved=(await pool.query('SELECT * FROM app.development_seed_commands WHERE command_id=$1 AND seed_id=$2',[commandId,manifest.seedId])).rows[0];if(!saved) throw new Error('SEED_OWNERSHIP_MISMATCH');
          let evidence;
          if(command.status==='COMMITTED') {
            evidence=await ledger.inspect({...ledgerCommand(command),...saved});if(!evidence||evidence.transactionId!==command.ledgerTransactionId) throw new Error('SEED_COMMIT_VERIFICATION_FAILED');
          } else {
            await pool.query("UPDATE app.v2_commands SET status='SUBMITTING',lease_owner=$2,lease_expires_at=now()+interval '15 minutes',attempt_count=attempt_count+1 WHERE command_id=$1 AND (lease_owner IS NULL OR lease_owner=$2)", [commandId,manifest.seedId]);
            evidence=await processSavedCommand({command,saved,ledger,
              afterSubmit:async()=>{if(Number(options['pause-after-submit'])===processed+1) throw new Error('SEED_REQUESTED_AMBIGUOUS_PAUSE');},
              saveSubmission:async p=>{const result=await pool.query('UPDATE app.development_seed_commands SET transaction_id=$2,signed_transaction=$3 WHERE command_id=$1 AND transaction_id IS NULL',[commandId,p.transactionId,Buffer.from(p.bytes)]);if(result.rowCount!==1) throw new Error('SEED_SUBMISSION_RACE');},
              saveCommit:async e=>{await store.markLedgerCommitted(commandId,e.transactionId,new Date(),{asset:e.asset,blockNumber:e.blockNumber,validationStatus:e.validationStatus});await pool.query("UPDATE app.development_seed_commands SET block_number=$2,validation_status='VALID' WHERE command_id=$1",[commandId,e.blockNumber]);},
              project:async e=>{if(Number(options['pause-after-commit'])===processed+1) throw new Error('SEED_REQUESTED_PROJECTION_PAUSE');await projector.project(command,{transactionId:e.transactionId,result:e.asset});},complete:async()=>store.markCommitted(commandId,new Date())});
          }
          receipts.push({commandId,operation:command.operation,transactionId:evidence.transactionId,blockNumber:evidence.blockNumber,validationStatus:evidence.validationStatus});
          processed++;if(options['stop-after']&&processed>=Number(options['stop-after'])) throw new Error('SEED_REQUESTED_SAFE_PAUSE');return command;
        };
        if(action!=='verify') await pool.query("INSERT INTO app.development_seed_runs(seed_id,manifest_sha256,manifest,target_sha256,classification) VALUES($1,$2,$3,$4,'SIMULATION_ONLY') ON CONFLICT DO NOTHING",[manifest.seedId,manifestSha256,manifest,targetSha256]);
        const key=(suffix)=>id('IDEM_',`${manifest.seedId}|${suffix}`);
        const corr=(suffix)=>'CORR_'+digest(`${manifest.seedId}|${suffix}`).slice(0,32).toUpperCase();
        const componentIds={};
        for(const label of manifest.labels) {
          const idem=key(label.name);componentIds[label.name]=id('COMP_',idem);
          const {componentType,bloodType,collectedAt,expiresAt,donationNumber}=label;
          const payload={componentType,bloodType,collectedAt,expiresAt,donationNumber,captureMethod:'OCR',capturePolicyVersion:'INBOUND_OCR_V1',issuerInstitutionId:'INST_MEDIATRIX',bloodTypeEvidence:{source:'OCR_LABEL',confirmed:true},componentEvidence:{source:'OCR_LABEL',confirmed:true},capturedAt:label.capturedAt,confirmedAt:manifest.generatedAt,eventTime:manifest.generatedAt,correlationId:corr(label.name),ocrEvidence:{engine:label.engine,engineVersion:label.engineVersion,fieldConfidence:{donationNumber:label.ocr.donationNumber,bloodType:label.ocr.bloodType,collectedAt:label.ocr.collectedAt,expiresAt:label.ocr.expiresAt}}};
          await send('coordinator','/api/v2/inbound-captures',payload,idem);
        }
        for(const scenario of ['PENDING','RESERVED','IN_TRANSIT']) {
          const transferId=id('TRF_',`${manifest.seedId}|${scenario}`);const reservationId=id('RES_',`${manifest.seedId}|${scenario}`);
          const type=scenario==='RESERVED'?'PLATELETS':scenario==='IN_TRANSIT'?'PACKED_RED_BLOOD_CELLS':'CRYOPRECIPITATE';const blood=scenario==='RESERVED'?'B_POSITIVE':scenario==='IN_TRANSIT'?'O_POSITIVE':'A_POSITIVE';
          await send('recipient','/api/v2/transfers',{transferId,bloodType:blood,componentType:type,quantity:1,urgency:'ROUTINE',sourceInstitutionId:'INST_MEDIATRIX',destinationInstitutionId:principals.recipient.institutionId,requestTime:manifest.generatedAt,eventTime:manifest.generatedAt,correlationId:corr(scenario)},key('REQUEST_'+scenario));
          if(scenario==='PENDING') continue;
          const componentId=componentIds[scenario];
          await send('coordinator','/api/v2/reservations',{reservationId,transferId,selectedComponentIds:[componentId],expectedComponentVersions:[1],eventTime:manifest.generatedAt,correlationId:corr('RESERVE_'+scenario)},key('RESERVE_'+scenario));
          if(scenario==='RESERVED') continue;
          let version=1;
          for(const step of ['prepare','dispatch','transit']) {
            const payload={expectedVersion:version++,eventTime:manifest.generatedAt,correlationId:corr(step)};
            if(step==='prepare') Object.assign(payload,{preparedAt:manifest.generatedAt,preparedEvidenceId:id('EVD_',manifest.seedId),preparedEvidenceDigest:digest({seedId:manifest.seedId,evidence:'CONSTRUCTED_SYNTHETIC_PREPARATION'})});
            await send('coordinator',`/api/v2/reservations/${reservationId}/${step}`,payload,key(step));
          }
        }
        const expiredId=componentIds.EXPIRED;const expiryKey=key('EVALUATE_EXPIRY');
        // Accepted deterministic expiry has no public endpoint: authenticated actor above,
        // same durable store/gateway/projector, scoped exclusively to this synthetic component.
        if(action!=='verify'&&!await store.get(id('CMD_',expiryKey),principals.coordinator.institutionId,principals.coordinator.userId)) await store.enqueue({commandId:id('CMD_',expiryKey),idempotencyKey:expiryKey,resourceType:'COMPONENT',resourceId:expiredId,operation:'EVALUATE_COMPONENT_EXPIRY',payload:{componentId:expiredId,expectedVersion:1,evaluationTime:manifest.generatedAt,eventTime:manifest.generatedAt,actorUserId:principals.coordinator.userId,correlationId:corr('expiry'),policyVersion:policyVersions.coordinator},correlationId:corr('expiry'),actorUserId:principals.coordinator.userId,actorInstitutionId:principals.coordinator.institutionId,acceptedAt:new Date().toISOString()});
        if(action!=='verify') await pool.query('INSERT INTO app.development_seed_commands(seed_id,command_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[manifest.seedId,id('CMD_',expiryKey)]);
        await send('coordinator','',{},expiryKey);
        const components=(await pool.query('SELECT component_id,blood_type,component_type,collected_at,expires_at,inventory_status,ledger_version,ledger_transaction_id FROM app.v2_components WHERE component_id=ANY($1::text[])',[Object.values(componentIds)])).rows;
        for(const label of manifest.labels) {
          const row=components.find(item=>item.component_id===componentIds[label.name]);
          const asset=JSON.parse(Buffer.from(await ledger.contract.evaluateTransaction('ReadComponent',JSON.stringify({actorUserId:principals.coordinator.userId,componentId:componentIds[label.name]}))).toString('utf8'));
          const expectedState=label.name==='RESERVED'?'RESERVED':label.name==='IN_TRANSIT'?'IN_TRANSIT':label.name==='EXPIRED'?'EXPIRED':'AVAILABLE';
          if(!row || asset.status!==expectedState || row.inventory_status!==expectedState || asset.componentId!==row.component_id || asset.status!==row.inventory_status || asset.version!==row.ledger_version || asset.lastTransactionId!==row.ledger_transaction_id) throw new Error('SEED_CURRENT_LEDGER_PROJECTION_MISMATCH');
          if(!row||row.blood_type!==label.bloodType||row.component_type!==label.componentType||new Date(row.collected_at).toISOString()!==label.collectedAt||new Date(row.expires_at).toISOString()!==label.expiresAt) throw new Error('SEED_MANIFEST_COMPONENT_MISMATCH');
        }
        if(components.length!==9||components.some(row=>!row.ledger_transaction_id)||components.find(r=>r.component_id===expiredId)?.inventory_status!=='EXPIRED'||components.find(r=>r.component_id===componentIds.RESERVED)?.inventory_status!=='RESERVED'||components.find(r=>r.component_id===componentIds.IN_TRANSIT)?.inventory_status!=='IN_TRANSIT') throw new Error('SEED_PROJECTION_RECONCILIATION_FAILED');
        const owned=(await pool.query('SELECT COUNT(*)::int AS count FROM app.development_seed_commands WHERE seed_id=$1',[manifest.seedId])).rows[0].count;if(owned!==receipts.length) throw new Error('SEED_COMMAND_MEMBERSHIP_MISMATCH');
        const report={directCurrentAssetsVerified:9,seedId:manifest.seedId,targetSha256,classification:'SIMULATION_ONLY',components,receipts,verifiedAt:new Date().toISOString(),nearExpiry:'DISABLED_UNAPPROVED_POLICY',hostValidation:'LOCAL_SELF_VALIDATION'};
        await savedFile(options.report,report);console.log(canonical({seedId:manifest.seedId,components:components.length,validTransactions:receipts.length,report:options.report}));
        for(const cookie of Object.values(cookies)) await fetch(apiUrl+'/api/v1/auth/session',{method:'DELETE',headers:{Origin:'http://127.0.0.1:5174',Cookie:cookie}});
      } finally {await lock.query('SELECT pg_advisory_unlock_all()');lock.release();}
    }
  }
} catch(error) {console.error(error.code??(/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'SEED_PREREQUISITE_OR_OPERATION_FAILED'));process.exitCode=2;}
finally {ledger?.close();await pool.end();}

}
main().catch(error=>{console.error(/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:"SEED_PREREQUISITE_OR_OPERATION_FAILED");process.exitCode=2;});
