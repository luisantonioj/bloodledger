import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { HistoricalLedger, HistoricalFailure } from './ledger.mjs';
import { HistoricalStore } from './store.mjs';
import { runHistoricalCommand } from './worker.mjs';
import historical from '../../chaincode/build/compiled/src/historical-model.js';
const {canonical,makeHistoricalManifest,validateHistoricalManifest,HISTORICAL_ACTOR}=historical;
export function argumentsOf(args) {
  const command=args[0]?.startsWith('--')?'preview':args.shift()??'preview';
  const allowed=['workbook','sha256','business-date','output','manifest','target','approve-manifest','review-reference','operator','report'];
  const options={};
  for(let i=0;i<args.length;i+=2) {
    const key=args[i]?.replace(/^--/,'');
    if(!args[i]?.startsWith('--')||!allowed.includes(key)||options[key]!==undefined||!args[i+1]||args[i+1].startsWith('--')) throw new Error('HISTORICAL_ARGUMENT_INVALID');
    options[key]=args[i+1];
  }
  if(!['preview','apply','resume','verify'].includes(command)) throw new Error('HISTORICAL_COMMAND_INVALID');
  return {command,options};
}
export function approval(options,manifest) {
  if(options.target!=='bloodledger-local'||options['approve-manifest']!==manifest.manifestSha256||options.operator!==HISTORICAL_ACTOR||typeof options['review-reference']!=='string'||options['review-reference'].trim().length===0||options['review-reference'].length>512) throw new Error('HISTORICAL_REVIEW_AND_LOCAL_TARGET_REQUIRED');
}
async function saveExternal(path,value) {
  const dest=resolve(path),root=resolve(process.cwd());
  const inside=relative(root,dest);
  if(!inside.startsWith('..')&&!inside.startsWith('build/')) throw new Error('HISTORICAL_OUTPUT_MUST_BE_EXTERNAL_OR_BUILD');
  await mkdir(dirname(dest),{recursive:true});
  await writeFile(dest,`${canonical(value)}\n`,{mode:0o600,flag:'wx'});
}
async function database() {
  if(existsSync('.env')) process.loadEnvFile('.env');
  const host=process.env.HISTORICAL_PG_HOST??'127.0.0.1';
  if(!['127.0.0.1','localhost','postgres'].includes(host)||process.env.POSTGRES_DB!=='bloodledger_dev'||process.env.POSTGRES_APP_USER!=='bloodledger_app') throw new Error('HISTORICAL_LOCAL_DATABASE_REQUIRED');
  const client=new Client({host,port:Number(process.env.HISTORICAL_PG_PORT??process.env.POSTGRES_HOST_PORT??5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_APP_USER,password:process.env.POSTGRES_APP_PASSWORD});
  await client.connect();return client;
}
export async function verifySnapshot(client,ledger,manifest) {
  const snapshot=await ledger.readSnapshot(manifest.snapshotId);
  if(snapshot.status!=='COMPLETE'||snapshot.manifest.manifestSha256!==manifest.manifestSha256) throw new Error('HISTORICAL_LEDGER_SNAPSHOT_INCOMPLETE');
  const commands=(await client.query('SELECT * FROM app.synthetic_inventory_import_commands WHERE snapshot_id=$1 ORDER BY step_index',[manifest.snapshotId])).rows;
  if(commands.length!==manifest.units.length+2||commands.some(c=>c.status!=='COMMITTED')) throw new Error('HISTORICAL_COMMANDS_INCOMPLETE');
  const units=(await client.query('SELECT * FROM app.synthetic_inventory_units WHERE snapshot_id=$1',[manifest.snapshotId])).rows;
  if(units.length!==manifest.units.length) throw new Error('HISTORICAL_PROJECTION_INCOMPLETE');
  const recorded=(await client.query('SELECT * FROM app.synthetic_inventory_counts WHERE snapshot_id=$1 ORDER BY series_key',[manifest.snapshotId])).rows;
  if(recorded.length!==20) throw new Error('HISTORICAL_COUNTS_INCOMPLETE');
  const map=new Map(units.map(u=>[u.component_id,u]));
  const unitReceipts=new Map();
  for(const command of commands) {
    const evidence=await ledger.inspect(command);
    if(!evidence||evidence.transactionId!==command.transaction_id||evidence.blockNumber!==String(command.block_number)||canonical(evidence.asset)!==canonical(command.ledger_result)) throw new Error('HISTORICAL_RECEIPT_MISMATCH');
    if(command.operation==='RegisterUnit') unitReceipts.set(evidence.asset.componentId,evidence);
  }
  for(const expected of manifest.units) {
    const stored=map.get(expected.componentId),asset=await ledger.readUnit(manifest.snapshotId,expected.componentId);
    for(const key of Object.keys(expected)) if(canonical(expected[key])!==canonical(asset[key])) throw new Error('HISTORICAL_LEDGER_MEMBER_MISMATCH');
    const receipt=unitReceipts.get(expected.componentId);
    if(!receipt||!stored||String(stored.block_number)!==receipt.blockNumber||new Date(stored.committed_at).toISOString()!==asset.committedAt||stored.snapshot_status!==expected.snapshotStatus||stored.series_key!==expected.seriesKey||stored.allocation_group_id!==expected.allocationGroupId||stored.ledger_transaction_id!==asset.transactionId||stored.validation_status!=='VALID'||stored.collected_at!==null||stored.expires_at!==null||stored.donation_number!==null||stored.original_reservation_purpose!==null) throw new Error('HISTORICAL_DATABASE_MEMBER_MISMATCH');
  }
  const counts=manifest.counts.map(expected=>{
    const key=`${expected.bloodType}/${expected.componentType}`;
    const available=units.filter(u=>u.series_key===key&&u.snapshot_status==='AVAILABLE').length;
    const reserved=units.filter(u=>u.series_key===key&&u.snapshot_status==='RESERVED').length;
    const row=recorded.find(r=>r.series_key===key);
    if(!row||available!==expected.available||reserved!==expected.reserved||row.available_units!==available||row.reserved_units!==reserved||row.closing_units!==available+reserved) throw new Error('HISTORICAL_RECONCILIATION_FAILED');
    return {...expected,verifiedAvailable:available,verifiedReserved:reserved};
  });
  const databaseSnapshot=(await client.query('SELECT * FROM app.synthetic_inventory_snapshots WHERE snapshot_id=$1',[manifest.snapshotId])).rows[0];
  if(!databaseSnapshot||databaseSnapshot.status!=='COMPLETE'||databaseSnapshot.manifest_sha256!==manifest.manifestSha256||databaseSnapshot.verified_units!==units.length) throw new Error('HISTORICAL_DATABASE_SNAPSHOT_INCOMPLETE');
  return {snapshotId:manifest.snapshotId,sourceBusinessDate:manifest.businessDate,workbookSha256:manifest.workbookSha256,manifestSha256:manifest.manifestSha256,classification:'SIMULATION_ONLY',status:'VERIFIED',directlyVerifiedTransactions:commands.length,generatedUnits:units.length,counts};
}
export async function main(args=process.argv.slice(2)) {
  const {command,options}=argumentsOf([...args]);
  let input='';for await(const chunk of process.stdin) input+=chunk;
  const source=JSON.parse(input);
  const manifest=makeHistoricalManifest(source);
  if(options['business-date']!==manifest.businessDate||options.sha256!==manifest.workbookSha256||!options.workbook) throw new Error('HISTORICAL_VALIDATED_SOURCE_REQUIRED');
  const bytes=await readFile(options.workbook);
  if(createHash('sha256').update(bytes).digest('hex')!==manifest.workbookSha256) throw new Error('HISTORICAL_WORKBOOK_HASH_MISMATCH');
  if(command==='preview') {
    if(!options.output) throw new Error('HISTORICAL_OUTPUT_REQUIRED');
    await saveExternal(options.output,manifest);
    console.log(JSON.stringify({snapshotId:manifest.snapshotId,manifestSha256:manifest.manifestSha256,units:manifest.units.length,series:20,status:'PREVIEW'})); return;
  }
  if(!options.manifest) throw new Error('HISTORICAL_MANIFEST_REQUIRED');
  const approved=validateHistoricalManifest(JSON.parse(await readFile(options.manifest,'utf8')));
  if(canonical(approved)!==canonical(manifest)) throw new Error('HISTORICAL_SOURCE_MANIFEST_MISMATCH');
  if(command!=='verify') approval(options,manifest);
  else if(options.target!=='bloodledger-local') throw new Error('HISTORICAL_LOCAL_TARGET_REQUIRED');
  const client=await database();let ledger;
  try {
    ledger=await HistoricalLedger.connect();
    if(command!=='verify') {
      const store=new HistoricalStore(client);await store.lock(manifest.snapshotId);
      await store.enqueue(manifest,options['review-reference'],options.operator);
      // Sequential, bounded processing. A failure leaves durable evidence for explicit resume.
      while(await runHistoricalCommand(store,ledger,manifest.snapshotId)!=='COMPLETE') {}
    }
    const report=await verifySnapshot(client,ledger,manifest);
    if(options.report) await saveExternal(options.report,report);
    console.log(JSON.stringify(report));
  } finally { ledger?.close();await client.end(); }
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href) main().catch(error=>{console.error(error instanceof HistoricalFailure?error.code:/^HISTORICAL_[A-Z_]+$/.test(error.message)?error.message:'HISTORICAL_IMPORT_UNAVAILABLE');process.exitCode=1;});
