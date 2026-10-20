// Disposable database only: bloodledger_checkpoint_test. Never point this probe at a retained host.
import assert from 'node:assert/strict';
import {Client,Pool} from 'pg';
import {runner} from 'node-pg-migrate';
import {PostgresCensusStore,checkpointInstitutionIds,STOCK_CHECKPOINT_POLICY_VERSION} from '../build/src/census-worker.js';
import {StockCheckpointScheduler} from '../build/src/stock-checkpoint-scheduler.js';
import {DOH_CENSUS_DISPLAY_ORDER} from '../build/src/report-policy.js';
const admin=new Client({host:'127.0.0.1',user:'postgres',database:'bloodledger_checkpoint_test'});await admin.connect();let runtime;
try{
 await admin.query('CREATE ROLE bloodledger_migrator LOGIN;CREATE ROLE bloodledger_app LOGIN;GRANT bloodledger_migrator TO postgres;ALTER DATABASE bloodledger_checkpoint_test OWNER TO bloodledger_migrator;SET ROLE bloodledger_migrator');
 const migrations=await runner({dbClient:admin,direction:'up',dir:new URL('../../../database/migrations',import.meta.url).pathname,ignorePattern:'README\\.md',migrationsSchema:'public',migrationsTable:'pgmigrations',log:()=>{}});
 await admin.query('RESET ROLE');
 for(const [id,category,status] of [['INST_SYNTH_CHECK_A','BLOOD_BANK','ACTIVE'],['INST_SYNTH_CHECK_B','BLOOD_BANK','ACTIVE'],['INST_SYNTH_CHECK_C','BLOOD_BANK','ACTIVE'],['INST_SYNTH_CHECK_REQUESTER','REQUESTOR','ACTIVE'],['INST_SYNTH_CHECK_PAUSED','BLOOD_BANK','SUSPENDED']])await admin.query('INSERT INTO app.institutions(institution_id,display_name,category,status,account_category) VALUES($1,$2,\'HOSPITAL\',$3,$4)',[id,'Synthetic Checkpoint Facility '+id.slice(-1),status,category]);
 runtime=new Pool({host:'127.0.0.1',user:'bloodledger_app',database:'bloodledger_checkpoint_test'});
 const store=new PostgresCensusStore(runtime,STOCK_CHECKPOINT_POLICY_VERSION,DOH_CENSUS_DISPLAY_ORDER);const scheduler=new StockCheckpointScheduler(store,()=>checkpointInstitutionIds(runtime));
 assert.equal((await scheduler.runOnce(new Date('2026-10-20T01:00:03.000Z'))).snapshots,3);
 const first=await admin.query('SELECT snapshot_id,captured_at,source_projection_digest FROM app.v2_census_snapshots ORDER BY snapshot_id');
 await scheduler.runOnce(new Date('2026-10-20T01:15:00.000Z'));
 assert.deepEqual((await admin.query('SELECT snapshot_id,captured_at,source_projection_digest FROM app.v2_census_snapshots ORDER BY snapshot_id')).rows,first.rows);
 assert.equal((await scheduler.runOnce(new Date('2026-10-20T08:00:20.000Z'))).snapshots,3);
 assert.equal((await scheduler.runOnce(new Date('2026-10-21T10:00:00.000Z'))).snapshots,0);
 assert.equal(Number((await admin.query('SELECT count(*) FROM app.v2_census_snapshots')).rows[0].count),6);
 const counts=await admin.query('SELECT count(*) AS cells,sum(reportable_count) AS units FROM app.v2_census_counts');assert.equal(Number(counts.rows[0].cells),192);assert.equal(Number(counts.rows[0].units),0);
 const saved=await store.get(first.rows[0].snapshot_id);assert.equal(saved.groups.length,4);assert(saved.groups.every(group=>group.bloodTypes.length===8));
 const copy=await store.copyRow(first.rows[0].snapshot_id,'WHOLE_BLOOD');assert(copy.includes('WHOLE_BLOOD\t0\t0\t0\t0\t0\t0\t0\t0'));
 console.log(JSON.stringify({passed:true,migrations:migrations.length,zeroStockBanks:3,savedRecords:6,zeroFilledCells:192,firstCaptureImmutable:true,missedSlotsNotBackfilled:true,requesterAndSuspendedExcluded:true,copySavedMatrix:true,retainedDatabaseUsed:false}));
}finally{if(runtime)await runtime.end();await admin.end();}
