import { readFile,writeFile,stat } from 'node:fs/promises';
import { resolve,relative } from 'node:path';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { HistoricalLedger } from '../historical-inventory/ledger.mjs';
import { sha256 } from '../../services/api/build/src/hash.js';
import { previewAccountMigration,applyAccountMigration,rollbackAccountMigration,domainFingerprints,MIGRATION_ID } from '../../services/api/build/src/account-migration.js';
import policy from '../../chaincode/policy/institution-core-v1.json' with {type:'json'};
const [action,...args]=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){const key=args[i]?.slice(2);if(!['config','output','manifest','approve-manifest','backup'].includes(key)||options[key]||!args[i+1])throw new Error('ACCOUNT_ARGUMENT_INVALID');options[key]=args[i+1];}
if(!['inspect','preview','apply','resume','verify','rollback','purge'].includes(action))throw new Error('ACCOUNT_ACTION_INVALID');
async function privateJson(path){if(!path||(await stat(path)).mode&0o077)throw new Error('ACCOUNT_PRIVATE_FILE_REQUIRED');return JSON.parse(await readFile(path,'utf8'));}
async function save(value){if(!options.output)throw new Error('ACCOUNT_PRIVATE_OUTPUT_REQUIRED');const path=resolve(options.output),rel=relative(process.cwd(),path);if(rel.startsWith('..')||!rel.startsWith('build/'))throw new Error('ACCOUNT_IGNORED_OUTPUT_REQUIRED');await writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
const config=await privateJson(options.config);
if(config.classification!=='SIMULATION_ONLY'||config.scope!=='INSTITUTION_ACCOUNTS')throw new Error('ACCOUNT_CONFIG_INVALID');
if(process.env.POSTGRES_DB!=='bloodledger_dev'||process.env.POSTGRES_MIGRATOR_USER!=='bloodledger_migrator')throw new Error('ACCOUNT_LOCAL_TARGET_REQUIRED');
const pool=new Pool({host:process.env.DEVELOPMENT_PG_HOST??'127.0.0.1',port:Number(process.env.DEVELOPMENT_PG_PORT??5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_MIGRATOR_USER,password:process.env.POSTGRES_MIGRATOR_PASSWORD,max:3});
let ledger;
try{
  ledger=(await HistoricalLedger.connect()).useContract('InterviewCoreContract');
  const identity=(await pool.query('SELECT instance_id FROM app.development_target_identity WHERE singleton')).rows[0];
  const target={database:process.env.POSTGRES_DB,instanceId:identity?.instance_id,genesisSha256:await ledger.genesisDigest(),volume:process.env.DEVELOPMENT_TARGET_VOLUME,volumeCreatedAt:process.env.DEVELOPMENT_TARGET_VOLUME_CREATED,channel:'bloodledger-dev'};
  if(!target.instanceId||!target.volume||!target.volumeCreatedAt)throw new Error('ACCOUNT_TARGET_EVIDENCE_REQUIRED');
  const targetDigest=sha256(target);
  if(action==='inspect'){await save({target,targetDigest,classification:'SIMULATION_ONLY'});}
  else{
    if(config.targetDigest!==targetDigest)throw new Error('ACCOUNT_APPROVED_TARGET_MISMATCH');
    if(action==='preview')await save(await previewAccountMigration(pool,targetDigest,config.legacyBaselineVersion));
    else if(action==='apply'||action==='resume'){
      const manifest=await privateJson(options.manifest);
      if(manifest.legacyBaselineVersion!==config.legacyBaselineVersion)throw new Error('ACCOUNT_BASELINE_APPROVAL_MISMATCH');
      if(manifest.manifestSha256!==options['approve-manifest'])throw new Error('ACCOUNT_MANIFEST_APPROVAL_REQUIRED');
      if(!options.backup||(await stat(options.backup)).size<100||(await stat(options.backup)).mode&0o077)throw new Error('ACCOUNT_PRIVATE_BACKUP_REQUIRED');
      if(config.backupSha256!==createHash('sha256').update(await readFile(options.backup)).digest('hex'))throw new Error('ACCOUNT_APPROVED_BACKUP_MISMATCH');
      for(const actorUserId of policy.institutionAccountActorIds){
        const installed=JSON.parse(Buffer.from(await ledger.contract.evaluateTransaction('ReadActorPolicy',JSON.stringify({actorUserId,policyVersion:policy.policyVersion}))).toString('utf8'));
        if(installed.policySha256!==createHash('sha256').update(JSON.stringify(policy)).digest('hex')||installed.institutionId!==policy.actors[actorUserId].institutionId||installed.role!==policy.actors[actorUserId].role)throw new Error('ACCOUNT_INSTALLED_POLICY_MISMATCH');
      }
      const result=await applyAccountMigration(pool,manifest,targetDigest,config);
      await save({...result,targetDigest,classification:'SIMULATION_ONLY'});
    }else if(action==='rollback'){
      if(options['approve-manifest']!==sha256({migrationId:MIGRATION_ID,targetDigest,action:'rollback'}))throw new Error('ACCOUNT_ROLLBACK_TARGET_APPROVAL_REQUIRED');
      await rollbackAccountMigration(pool,targetDigest);await save({status:'ROLLED_BACK',targetDigest,classification:'SIMULATION_ONLY'});
    }else if(action==='purge'){
      const result=await pool.query('SELECT app.purge_closed_synthetic_onboarding(CURRENT_TIMESTAMP) AS purged');await save({purged:result.rows[0].purged,classification:'SIMULATION_ONLY'});
    }else{
      const checkpoint=(await pool.query('SELECT * FROM app.institution_account_migrations WHERE migration_id=$1',[MIGRATION_ID])).rows[0];
      if(!checkpoint||checkpoint.target_digest!==targetDigest||sha256(await domainFingerprints(pool))!==sha256(checkpoint.baseline_fingerprints))throw new Error('ACCOUNT_RETAINED_DOMAIN_MISMATCH');
      const accounts=(await pool.query("SELECT user_id,username,institution_id,status FROM app.application_users WHERE account_kind='PRIMARY' ORDER BY username")).rows;
      await save({accounts,targetDigest,domainFingerprintsPreserved:true,classification:'SIMULATION_ONLY'});
    }
  }
}finally{ledger?.close();await pool.end();}
