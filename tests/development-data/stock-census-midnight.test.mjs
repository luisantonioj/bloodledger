// TP-JOP-D18 / TP-STOCK-01 / FR-09/14: a verification window that crosses Manila midnight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { id } from '../../scripts/development-data/scenario.mjs';
import { INTERNAL_ML_SNAPSHOT_POLICY_VERSION } from '../../services/api/build/src/census-worker.js';
import { reconcileStockCensus } from '../../scripts/development-data/stock-cli.mjs';
const types=['WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE'];
const bloods=['A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE'];
// Synthetic window shaped like V3: T0 Sun 23:30 Manila, verification until Mon 07:00 Manila.
const execution={runId:'STOCK_TEST',scenario:{t0:'2026-10-11T15:30:00Z',verificationWindowEndExclusive:'2026-10-11T23:00:00Z'}};
function fixture(status,evaluationDate) {
  const census={snapshotId:id('CENSUS_',`INST_MEDIATRIX|${new Date(execution.scenario.t0).toISOString()}|${INTERNAL_ML_SNAPSHOT_POLICY_VERSION}`),scheduledFor:'2026-10-11T15:30:00.000Z',capturedAt:'2026-10-11T15:50:16.067Z',sourceProjectionDigest:'a'.repeat(64),groups:types.map(componentType=>({componentType,bloodTypes:bloods.map(bloodType=>({bloodType,availableCount:0,reservedCount:0,reportableCount:0,forecastEligibleAvailableCount:0}))}))};
  const runtime={pool:{query:async()=>({rowCount:1})},client:{read:async(account,path)=>path==='/api/v2/components'?{components:[]}:{status,evaluationDate,snapshot:{...census,persistedSeries:40}}}};
  const store={capture:async()=>census,get:async()=>census};
  return {census,runtime,store};
}
test('TP-JOP-D18: after Manila midnight inside the window, the original census verifies as STALE',async()=>{
  const f=fixture('STALE','2026-10-12');
  const result=await reconcileStockCensus(f.runtime,execution,{census_snapshot_id:f.census.snapshotId},new Date('2026-10-11T16:30:00Z'),f.store);
  assert.equal(result.inWindow,true);assert.equal(result.censusApiStatus,'STALE');assert.equal(result.census,f.census);
});
test('TP-JOP-D18: the API status must match its own Manila date rule on either side of midnight',async()=>{
  const sameDay=fixture('CURRENT','2026-10-11');
  assert.equal((await reconcileStockCensus(sameDay.runtime,execution,{},new Date('2026-10-11T15:55:00Z'),sameDay.store)).censusApiStatus,'CURRENT');
  for (const [status,evaluationDate,observedAt] of [['STALE','2026-10-11','2026-10-11T15:55:00Z'],['CURRENT','2026-10-12','2026-10-11T16:30:00Z']]) {
    const f=fixture(status,evaluationDate);
    await assert.rejects(reconcileStockCensus(f.runtime,execution,{},new Date(observedAt),f.store),/STOCK_CENSUS_API_MISMATCH/);
  }
});
