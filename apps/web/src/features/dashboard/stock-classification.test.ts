import { describe, expect, it } from "vitest";
import { classifyStock, eligibleStockCounts, stockSegments, stockClassificationPolicy as policy } from "./stock-classification";
import type { V2Component } from "../../services/api/v2";
const now = Date.parse("2026-10-15T00:00:00Z");
const component = (patch: Partial<V2Component> = {}): V2Component => ({ componentId:"COMP_TEST",donationId:"DON_TEST",issuerInstitutionId:"INST_MEDIATRIX",institutionId:"INST_MEDIATRIX",componentType:"PACKED_RED_BLOOD_CELLS",bloodType:"A_POSITIVE",collectedAt:"2026-10-14T00:00:00Z",expiresAt:"2026-10-16T00:00:00Z",inventoryStatus:"AVAILABLE",expiryState:"CURRENT",reservationId:null,reservationVersion:null,inventoryVersion:1,policyVersion:"TEST",classification:"SIMULATION_ONLY",...patch });
// FR-04 / accepted project demonstration policy: exact boundaries for all 40 combinations.
describe("differentiated project stock bands", () => {
  it("contains exactly eight groups and five components with unique, ordered series", () => {
    expect(policy.series).toHaveLength(40);
    expect(new Set(policy.series.map(x=>x.bloodType)).size).toBe(8);
    expect(new Set(policy.series.map(x=>x.componentType)).size).toBe(5);
    expect(new Set(policy.series.map(x=>x.bloodType+":"+x.componentType)).size).toBe(40);
    expect(policy.series.every(x=>x.criticalMax>=0&&x.criticalMax<x.lowMax&&x.lowMax<x.adequateMax)).toBe(true);
  });
  for (const t of policy.series) it(`${t.bloodType} ${t.componentType}: lower, exact and upper boundary`, () => {
    const band = (n:number) => classifyStock(t.bloodType,t.componentType,n);
    expect(band(0)).toBe("critical");
    expect(band(t.criticalMax)).toBe("critical");expect(band(t.criticalMax+1)).toBe("low");
    expect(band(t.lowMax-1)).toBe(t.lowMax-1 <= t.criticalMax ? "critical" : "low");expect(band(t.lowMax)).toBe("low");expect(band(t.lowMax+1)).toBe("adequate");
    expect(band(t.adequateMax-1)).toBe("adequate");expect(band(t.adequateMax)).toBe("adequate");expect(band(t.adequateMax+1)).toBe("surplus");
  });
  it("does not substitute invalid/missing counts or unsupported combinations", () => {
    for(const n of [null,NaN,-1,0.5,Infinity]) expect(classifyStock("A_POSITIVE","PACKED_RED_BLOOD_CELLS",n)).toBeNull();
    expect(classifyStock("UNKNOWN","PACKED_RED_BLOOD_CELLS",20)).toBeNull();
    expect(classifyStock("A_POSITIVE","RED_BLOOD_CELLS",20)).toBeNull();
  });
});
describe("current complete own-institution stock evidence", () => {
  it("counts current AVAILABLE units only; excludes reservations, holds, expired labels and boundary expiry", () => {
    const variants:Partial<V2Component>[]=[{}, {inventoryStatus:"RESERVED"},{inventoryStatus:"IN_TRANSIT"},{inventoryStatus:"COMPROMISED"},{inventoryStatus:"EXPIRED"},{inventoryStatus:"RELEASED"},{inventoryStatus:"RECONCILIATION_HOLD"},{expiryState:"LABEL_EXPIRED_PENDING_EVALUATION"},{reservationId:"RES_TEST"},{expiresAt:new Date(now).toISOString()}];
    const rows=variants.map((p,i)=>component({...p,componentId:"COMP_"+i}));
    expect(eligibleStockCounts(rows,"INST_MEDIATRIX",now,now)?.get("A_POSITIVE:PACKED_RED_BLOOD_CELLS")).toBe(1);
    expect(eligibleStockCounts([component({expiresAt:new Date(now+1).toISOString()})],"INST_MEDIATRIX",now,now)?.size).toBe(1);
    expect(eligibleStockCounts([component()],"INST_MEDIATRIX",now,now+86400001)?.size).toBeUndefined();
  });
  it("distinguishes a successful empty inventory from missing, stale, future or invalid evidence", () => {
    expect(eligibleStockCounts([],"INST_MEDIATRIX",now,now)?.size).toBe(0);
    expect(eligibleStockCounts([component()],"INST_MEDIATRIX",now,now+60000)).not.toBeNull();
    expect(eligibleStockCounts([component()],"INST_MEDIATRIX",now,now+60001)).toBeNull();
    expect(eligibleStockCounts([component()],"INST_MEDIATRIX",now+1,now)).toBeNull();
    expect(eligibleStockCounts([component({institutionId:"INST_OTHER"})],"INST_MEDIATRIX",now,now)).toBeNull();
    expect(eligibleStockCounts([component(),component()],"INST_MEDIATRIX",now,now)).toBeNull();
    expect(eligibleStockCounts([component({expiresAt:"bad"})],"INST_MEDIATRIX",now,now)).toBeNull();
  });
});

describe("cumulative threshold segments",()=>{
 it("A+ FFP 60 eligible units produces 10 red, 14 low, 24 adequate and 12 surplus units",()=>{
  expect(stockSegments("A_POSITIVE","FRESH_FROZEN_PLASMA",60,60).map(s=>[s.band,s.start,s.end,s.range])).toEqual([["critical",0,10,"0–10"],["low",10,24,"11–24"],["adequate",24,48,"25–48"],["surplus",48,60,"49+"]]);
 });
 it("clips segments to actual counts without coloring unfilled ranges",()=>{
  expect(stockSegments("A_POSITIVE","FRESH_FROZEN_PLASMA",24,24).map(s=>s.band)).toEqual(["critical","low"]);
  expect(stockSegments("A_POSITIVE","FRESH_FROZEN_PLASMA",48,48).map(s=>s.band)).toEqual(["critical","low","adequate"]);
  expect(stockSegments("A_POSITIVE","FRESH_FROZEN_PLASMA",0,0)).toEqual([]);
 });
 it("shows noneligible confirmed stock in gray and preserves total height",()=>{
  const segments=stockSegments("A_POSITIVE","FRESH_FROZEN_PLASMA",60,57);
  expect(segments.at(-1)).toMatchObject({band:"unknown",start:57,end:60});
  expect(segments.reduce((sum,s)=>sum+s.end-s.start,0)).toBe(60);
  expect(stockSegments("A_POSITIVE","FRESH_FROZEN_PLASMA",60,null)).toEqual([expect.objectContaining({band:"unknown",start:0,end:60})]);
 });
 it("handles a zero-width critical band and rejects unsupported or invalid data",()=>{
  expect(stockSegments("AB_NEGATIVE","PLATELETS",3,3).map(s=>s.band)).toEqual(["low","adequate"]);
  expect(stockSegments("A_POSITIVE","UNKNOWN",12,12)).toEqual([expect.objectContaining({band:"unknown"})]);
  expect(stockSegments("A_POSITIVE","FRESH_FROZEN_PLASMA",-1,10)).toEqual([]);
 });
});
