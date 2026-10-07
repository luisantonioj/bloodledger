import assert from "node:assert/strict";
import test from "node:test";
import type { Context } from "fabric-contract-api";
import { HistoricalInventoryContract } from "../src/historical-inventory-contract";
import { HISTORICAL_ACTOR, HISTORICAL_BLOOD_TYPES, HISTORICAL_COMPONENT_TYPES, makeHistoricalManifest } from "../src/historical-model";
function fixture() {
  const state=new Map<string,Buffer>(), attributes:Record<string,string>={"hf.EnrollmentID":"api-gateway","hf.Type":"client","bloodledger.role":"API_GATEWAY","bloodledger.institution_id":"INST_MEDIATRIX"};
  let tx=0;
  const mock={clientIdentity:{getMSPID:()=>"MediatrixMSP",getAttributeValue:(name:string)=>attributes[name]},stub:{getTxID:()=>`TX_HIST_${tx++}`,getTxTimestamp:()=>({seconds:{toString:()=>"1791331200"},nanos:0}),getState:async(key:string)=>state.get(key)??Buffer.alloc(0),putState:async(key:string,value:Buffer)=>{state.set(key,value);}}};
  const ctx=mock as unknown as Context,contract=new HistoricalInventoryContract();
  const manifest=makeHistoricalManifest({workbookSha256:"a".repeat(64),businessDate:"2026-01-02",counts:HISTORICAL_BLOOD_TYPES.flatMap(bloodType=>HISTORICAL_COMPONENT_TYPES.map(componentType=>({bloodType,componentType,available:1,reserved:1,closing:2})))});
  const begin=JSON.stringify({manifest,actorUserId:HISTORICAL_ACTOR,reviewReference:"SYNTHETIC_TEST_REVIEW",approvedManifestSha256:manifest.manifestSha256});
  const finish=JSON.stringify({snapshotId:manifest.snapshotId,actorUserId:HISTORICAL_ACTOR});
  return {ctx,contract,manifest,begin,finish,state,attributes};
}
test("FR-13 historical membership, replay, actual transaction time and namespace isolation",async()=>{
  const f=fixture(); await f.contract.BeginSnapshot(f.ctx,f.begin);
  await assert.rejects(()=>f.contract.FinalizeSnapshot(f.ctx,f.finish),/INCOMPLETE/);
  const unit=f.manifest.units[0],payload=JSON.stringify({snapshotId:f.manifest.snapshotId,componentId:unit.componentId,actorUserId:HISTORICAL_ACTOR});
  const first=await f.contract.RegisterUnit(f.ctx,payload); assert.equal(first,await f.contract.RegisterUnit(f.ctx,payload));
  for(const member of f.manifest.units.slice(1)) await f.contract.RegisterUnit(f.ctx,JSON.stringify({snapshotId:f.manifest.snapshotId,componentId:member.componentId,actorUserId:HISTORICAL_ACTOR}));
  const completed=JSON.parse(await f.contract.FinalizeSnapshot(f.ctx,f.finish)); assert.equal(completed.status,"COMPLETE");
  assert.equal(completed.registeredUnits,40); assert.ok(completed.committedAt.startsWith("2026-10"));
  assert.ok([...f.state.keys()].every(key=>key.startsWith("historical-inventory:")));
  assert.equal(completed.manifest.businessDate,"2026-01-02");
});
test("FR-13 authorization, approval, unknown member and final membership corruption fail",async()=>{
  const f=fixture(); f.attributes["bloodledger.role"]="OTHER";
  await assert.rejects(()=>f.contract.BeginSnapshot(f.ctx,f.begin),/NOT_AUTHORIZED/); f.attributes["bloodledger.role"]="API_GATEWAY";
  await assert.rejects(()=>f.contract.BeginSnapshot(f.ctx,JSON.stringify({...JSON.parse(f.begin),approvedManifestSha256:"wrong"})),/REVIEW_REQUIRED/);
  await assert.rejects(()=>f.contract.BeginSnapshot(f.ctx,JSON.stringify({...JSON.parse(f.begin),actorUserId:"USR_OTHER"})),/NOT_AUTHORIZED/);
  await f.contract.BeginSnapshot(f.ctx,f.begin);
  await assert.rejects(()=>f.contract.RegisterUnit(f.ctx,JSON.stringify({snapshotId:f.manifest.snapshotId,componentId:"HCOMP_"+"0".repeat(40),actorUserId:HISTORICAL_ACTOR})),/MEMBER_INVALID/);
  for(const member of f.manifest.units) await f.contract.RegisterUnit(f.ctx,JSON.stringify({snapshotId:f.manifest.snapshotId,componentId:member.componentId,actorUserId:HISTORICAL_ACTOR}));
  const key=[...f.state.keys()].find(key=>key.includes(":unit:"))!; const corrupted=JSON.parse(f.state.get(key)!.toString()); corrupted.snapshotStatus="EXPIRED";f.state.set(key,Buffer.from(JSON.stringify(corrupted)));
  await assert.rejects(()=>f.contract.FinalizeSnapshot(f.ctx,f.finish),/MEMBER_CONFLICT/);
});
test("FR-14 zero stock preserves twenty series and completes without generated units",async()=>{
  const f=fixture();const manifest=makeHistoricalManifest({...f.manifest,counts:f.manifest.counts.map(c=>({...c,available:0,reserved:0,closing:0}))});
  await f.contract.BeginSnapshot(f.ctx,JSON.stringify({manifest,actorUserId:HISTORICAL_ACTOR,reviewReference:"ZERO_STOCK_TEST_REVIEW",approvedManifestSha256:manifest.manifestSha256}));
  const completed=JSON.parse(await f.contract.FinalizeSnapshot(f.ctx,JSON.stringify({snapshotId:manifest.snapshotId,actorUserId:HISTORICAL_ACTOR})));
  assert.equal(completed.expectedUnits,0);assert.equal(completed.manifest.counts.length,20);assert.equal(completed.status,"COMPLETE");
});
