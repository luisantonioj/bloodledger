import { expect, it } from "vitest";
import type { Dashboard } from "../../services/api/types";
import { networkAvailableUnits, ownRequests, type RequesterRequest } from "./requester-dashboard-data";
const row={institutionId:"INST_SYNTH_A",institutionDisplayName:"Synthetic bank",bloodType:"O_POSITIVE",component:"PACKED_RED_BLOOD_CELLS",inventoryStatus:"AVAILABLE",confirmedCount:3,lastProjectedAt:"2026-10-09T00:00:00Z"};
const data:Dashboard={composition:"OPERATIONAL",scope:"CITY_AGGREGATE",inventory:[row,{...row,institutionId:"INST_SYNTH_B",confirmedCount:4},{...row,inventoryStatus:"RESERVED",confirmedCount:99},{...row,inventoryStatus:"EXPIRED",confirmedCount:20}],pendingScans:[],lastSuccessfulProjectionAt:row.lastProjectedAt,classification:"SIMULATION_ONLY"};
// FR-03 / FR-12 / BL-TST-01: aggregate only available supply and preserve missing-data semantics.
it("aggregates available network units without including reserved, expired or other products",()=>{
  expect(networkAvailableUnits(data,row.bloodType,row.component)).toBe(7);
  expect(networkAvailableUnits(data,"AB_NEGATIVE",row.component)).toBe(0);
  expect(networkAvailableUnits(data,row.bloodType,"PLATELETS")).toBe(0);
});
it("rejects institutional scope, missing projections and invalid counts as unavailable",()=>{
  expect(networkAvailableUnits({...data,scope:"INSTITUTION"},row.bloodType,row.component)).toBeNull();
  expect(networkAvailableUnits({...data,lastSuccessfulProjectionAt:null},row.bloodType,row.component)).toBeNull();
  expect(networkAvailableUnits({...data,inventory:[{...row,confirmedCount:-1}]},row.bloodType,row.component)).toBeNull();
});
it("shows only requests destined for the authenticated requester",()=>{
  const own={transfer_id:"TRF_OWN",destination_institution_id:"INST_REQUESTER"} as RequesterRequest;
  expect(ownRequests({requests:[own,{...own,transfer_id:"TRF_OTHER",destination_institution_id:"INST_OTHER"}],classification:"SIMULATION_ONLY"},"INST_REQUESTER")).toEqual([own]);
});
