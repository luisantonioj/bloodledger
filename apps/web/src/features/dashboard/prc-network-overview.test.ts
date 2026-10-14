// FR-03/12: PRC chart reuses Network View counts, coverage and scope validation.
import {describe,it,expect} from "vitest";
import type {Dashboard} from "../../services/api/types";
import {V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "../../services/api/v2";
import {prcNetworkOverview} from "./prc-network-overview";
const row={institutionId:"INST_SAMPLE",institutionDisplayName:"Sample bank",bloodType:"O_POSITIVE",component:"PACKED_RED_BLOOD_CELLS",inventoryStatus:"AVAILABLE",confirmedCount:6,lastProjectedAt:"2026-10-11T12:00:00Z"};
const data:Dashboard={composition:"REGULATORY",scope:"CITY_AGGREGATE",classification:"SIMULATION_ONLY",pendingScans:[],inventory:[row,{...row,inventoryStatus:"RESERVED",confirmedCount:2}],lastSuccessfulProjectionAt:row.lastProjectedAt};
describe("PRC dashboard network inventory",()=>{
 it("excludes reservations and changes product without inventing missing stock",()=>{const result=prcNetworkOverview(data,row.component);expect(result.totals[V2_BLOOD_TYPES.indexOf("O_POSITIVE")]).toBe(6);expect(result.facilities).toHaveLength(1);expect(prcNetworkOverview(data,"WHOLE_BLOOD").totals.every(value=>value===null)).toBe(true);});
 it("distinguishes reported zeros, missing groups and unavailable projections",()=>{const result=prcNetworkOverview({...data,inventory:[{...row,confirmedCount:0}]},row.component);expect(result.totals[V2_BLOOD_TYPES.indexOf("O_POSITIVE")]).toBe(0);expect(result.totals[V2_BLOOD_TYPES.indexOf("A_POSITIVE")]).toBeNull();expect(prcNetworkOverview({...data,lastSuccessfulProjectionAt:null},row.component).totals.every(value=>value===null)).toBe(true);});
 it("rejects institution-only scope and incomplete counts",()=>{expect(()=>prcNetworkOverview({...data,scope:"INSTITUTION"},row.component)).toThrow();expect(()=>prcNetworkOverview({...data,inventory:[{...row,confirmedCount:-1}]},row.component)).toThrow();});
 it("does not present partial coverage as a complete network total",()=>{const result=prcNetworkOverview({...data,inventory:[row,{...row,institutionId:"INST_OTHER",bloodType:"A_POSITIVE"}]},row.component);expect(result.totals[V2_BLOOD_TYPES.indexOf("O_POSITIVE")]).toBeNull();});
});

 it("All sums the five products without adding reservations",()=>{const inventory=V2_COMPONENT_TYPES.flatMap(component=>[{...row,component},{...row,component,inventoryStatus:"RESERVED",confirmedCount:2}]);expect(prcNetworkOverview({...data,inventory},"ALL").totals[V2_BLOOD_TYPES.indexOf("O_POSITIVE")]).toBe(30);expect(prcNetworkOverview({...data,inventory:inventory.slice(2)},"ALL").totals[V2_BLOOD_TYPES.indexOf("O_POSITIVE")]).toBeNull();});
