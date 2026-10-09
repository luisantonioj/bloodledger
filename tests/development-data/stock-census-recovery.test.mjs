// TP-STOCK-01 / FR-09/14 / NFR-12: actual runner census path after laptop restart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { id } from '../../scripts/development-data/scenario.mjs';
import { INTERNAL_ML_SNAPSHOT_POLICY_VERSION } from '../../services/api/build/src/census-worker.js';
import { reconcileStockCensus } from '../../scripts/development-data/stock-cli.mjs';
const types=['WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE'];
const bloods=['A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE'];
const execution={runId:'STOCK_TEST',scenario:{t0:'2026-10-01T00:00:00Z',verificationWindowEndExclusive:'2026-10-01T08:00:00Z'}};
function fixture() {
  const census={snapshotId:id('CENSUS_',`INST_MEDIATRIX|${new Date(execution.scenario.t0).toISOString()}|${INTERNAL_ML_SNAPSHOT_POLICY_VERSION}`),scheduledFor:'2026-10-01T00:00:00.000Z',capturedAt:'2026-10-01T00:15:00.000Z',sourceProjectionDigest:'a'.repeat(64),groups:types.map(componentType=>({componentType,bloodTypes:bloods.map(bloodType=>({bloodType,availableCount:0,reservedCount:0,reportableCount:0,forecastEligibleAvailableCount:0}))}))};
  const writes=[],reads=[];
  const runtime={pool:{query:async(...args)=>{writes.push(args);throw new Error('Unexpected journal write');}},client:{read:async(account,path)=>{reads.push(path);return path==='/api/v2/components'?{components:[]}:{status:'STALE',snapshot:{...census,persistedSeries:40}};}}};
  const store={get:async(id,institution)=>{assert.equal(id,census.snapshotId);assert.equal(institution,'INST_MEDIATRIX');return census;},capture:async()=>{throw new Error('Unexpected census capture');}};
  return {census,writes,reads,runtime,store};
}
test('NFR-12: next-day verification reads the exact original forty-row census and honest STALE without writes',async()=>{
  const f=fixture();const result=await reconcileStockCensus(f.runtime,execution,{census_snapshot_id:f.census.snapshotId},new Date('2026-10-02T00:00:00Z'),f.store);
  assert.equal(result.census,f.census);assert.equal(result.censusApiStatus,'STALE');assert.equal(result.inWindow,false);assert.deepEqual(f.writes,[]);assert.ok(f.reads.includes('/api/v2/analytics/inventory-evidence?businessDate=2026-10-01'));
});
test('FR-09/14: missed capture remains absent; no late capture or false T0 evidence',async()=>{
  const f=fixture();const result=await reconcileStockCensus(f.runtime,execution,{},new Date('2026-10-02T00:00:00Z'),f.store);assert.equal(result.census,null);assert.deepEqual(f.reads,[]);assert.deepEqual(f.writes,[]);
  const wrong=fixture();wrong.store.get=async()=>({...wrong.census,snapshotId:'CENSUS_OTHER'});await assert.rejects(reconcileStockCensus(wrong.runtime,execution,{census_snapshot_id:wrong.census.snapshotId},new Date('2026-10-02T00:00:00Z'),wrong.store),/ID_MISMATCH/);
  f.store.get=async()=>null;await assert.rejects(reconcileStockCensus(f.runtime,execution,{census_snapshot_id:'CENSUS_TEST'},new Date('2026-10-02T00:00:00Z'),f.store),/PERSISTED_CENSUS_MISSING/);
});
test('FR-09/14: changed API digest, date, count or missing evidence prevents durable acceptance',async()=>{
  for(const changed of [{sourceProjectionDigest:'b'.repeat(64)},{capturedAt:'2026-10-02T00:15:00Z'},{snapshotId:'CENSUS_OTHER'},{persistedSeries:39}]){
    const f=fixture();f.runtime.client.read=async(account,path)=>path==='/api/v2/components'?{components:[]}:{status:'STALE',snapshot:{...f.census,persistedSeries:40,...changed}};
    await assert.rejects(reconcileStockCensus(f.runtime,execution,{census_snapshot_id:f.census.snapshotId},new Date('2026-10-02T00:00:00Z'),f.store),/MISMATCH/);assert.deepEqual(f.writes,[]);
  }
});
