// FR-03/11/12: regulator summaries preserve aggregate scope and missing data.
import {describe,expect,it} from "vitest";
import {networkProductSummary,reportingActivity} from "./regulator-analytics";
import {canViewAnalyticsPreview,canViewAnalyticsPage,canViewRegulatoryAnalytics} from "./analytics-access";
import type {Principal} from "../../auth/permissions";
import type {Consortium} from "../../services/api/types";
import type {CensusIndex} from "../../services/api/census-index";
const row={institutionId:"INST_SAMPLE",institutionDisplayName:"Sample bank",bloodType:"O_POSITIVE",component:"WHOLE_BLOOD",inventoryStatus:"AVAILABLE",confirmedCount:3,lastProjectedAt:"2026-10-11T12:00:00Z"};
const network:Consortium={classification:"SIMULATION_ONLY",scope:"CITY_AGGREGATE",inventory:[row,{...row,inventoryStatus:"RESERVED",confirmedCount:1}],alerts:[],transferSummary:[],lastSuccessfulProjectionAt:"2026-10-11T12:00:00Z"};
describe("regulator analytics",()=>{
 it("keeps reported available/reserved separate and missing products unknown",()=>{
  const summary=networkProductSummary(network);expect(summary[0]).toMatchObject({available:3,reserved:1});expect(summary[1]).toMatchObject({available:null,reserved:null});
 });
 it("rejects institution scope instead of treating it as network stock",()=>expect(()=>networkProductSummary({...network,scope:"INSTITUTION"} as unknown as Consortium)).toThrow());
 it("groups captures by Manila date, without inferring due or missed reports",()=>{
  const activity=reportingActivity({snapshots:[{institutionId:"INST_A",capturedAt:"2026-10-11T16:10:00Z"},{institutionId:"INST_A",capturedAt:"2026-10-12T01:00:00Z"},{institutionId:"INST_B",capturedAt:"2026-10-12T08:00:00Z"}]} as CensusIndex);
  expect(activity).toHaveLength(1);expect(activity[0].date).toBe("2026-10-12");expect(activity[0].records).toBe(3);expect(activity[0].facilities.size).toBe(2);
 });
 it("permits assigned regulator read views while keeping forecast access unchanged",()=>{
  for(const category of ['PRC','DOH'] as const){const principal={roleId:'ROLE-04',accountCategory:category,permissions:['consortium:read','reports:read']} as Principal;expect(canViewAnalyticsPage(principal)).toBe(true);expect(canViewAnalyticsPreview(principal)).toBe(false);expect(canViewRegulatoryAnalytics({...principal,permissions:[]})).toBe(false);}
  expect(canViewRegulatoryAnalytics({roleId:'ROLE-04',accountCategory:'REQUESTOR',permissions:['reports:read']} as Principal)).toBe(false);
 });
});
