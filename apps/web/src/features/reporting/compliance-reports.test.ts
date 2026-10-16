// FR-11/12: report presentation must preserve scope and cannot invent verification.
import { describe, expect, it } from "vitest";
import { parseComplianceStock } from "./compliance-reports";
import { visibleNavigation } from "../../config/navigation";
import { CENSUS_ORDER, type CensusSnapshot } from "../../services/api/census-index";
import type { Principal } from "../../auth/permissions";
const selected: CensusSnapshot = {snapshotId:"CENSUS_PREVIEW_TEST",institutionId:"INST_SAMPLE",scheduledFor:"2026-10-11T01:00:00Z",capturedAt:"2026-10-11T01:01:00Z",reportPolicyVersion:"SYNTHETIC_TEST",triggerType:"MANUAL"};
const detail = {...selected,classification:"SIMULATION_ONLY",timezone:"Asia/Manila",groups:[{componentType:"WHOLE_BLOOD",bloodTypes:CENSUS_ORDER.map(bloodType => ({bloodType,availableCount:3,reservedCount:1,reportableCount:4}))}]};
describe("compliance stock presentation",()=>{
 it("reads captured stock without creating verification metadata",()=>expect(parseComplianceStock(detail,selected)[0].bloodTypes[0].reportableCount).toBe(4));
 it("rejects mismatched selected reports and incomplete type coverage",()=>{
  expect(()=>parseComplianceStock({...detail,snapshotId:"CENSUS_OTHER"},selected)).toThrow();
  expect(()=>parseComplianceStock({...detail,groups:[{...detail.groups[0],bloodTypes:detail.groups[0].bloodTypes.slice(1)}]},selected)).toThrow();
 });
 it("rejects inconsistent or negative reportable quantities",()=>{
  expect(()=>parseComplianceStock({...detail,groups:[{...detail.groups[0],bloodTypes:detail.groups[0].bloodTypes.map(row=>({...row,reportableCount:5}))}]},selected)).toThrow();
 });
 it("shows Compliance Reports to banks and DOH, Reports to PRC, none to requesters",()=>{
  for(const [category,label] of [["BLOOD_BANK","Compliance Reports"],["DOH","Compliance Reports"],["PRC","Reports"],["REQUESTOR",undefined]] as const){
   const principal={accountCategory:category,roleId:category==='PRC'||category==='DOH'?'ROLE-04':'ROLE-02',permissions:category==='PRC'||category==='DOH'?['reports:read']:[]} as Principal;
   expect(visibleNavigation(principal).find(item=>item.href==='/reporting')?.label).toBe(label);
  }
 });
});

import {currentComplianceStock} from "./current-compliance-stock";
const currentUnit={componentId:"COMP_CURRENT",donationId:"DON_SYNTH",issuerInstitutionId:"INST_SAMPLE",institutionId:"INST_SAMPLE",bloodType:"A_POSITIVE",componentType:"CRYOPRECIPITATE",collectedAt:"2026-10-01T00:00:00Z",expiresAt:"2026-10-20T00:00:00Z",inventoryStatus:"AVAILABLE",expiryState:"CURRENT",reservationId:null,reservationVersion:null,inventoryVersion:1,policyVersion:"SYNTHETIC_TEST",classification:"SIMULATION_ONLY"};
const stock=(components:unknown[])=>({scope:"INSTITUTION",classification:"SIMULATION_ONLY",components});
describe("current bank compliance stock",()=>{
 const now=Date.parse("2026-10-16T00:00:00Z");
 it("includes label-current available and reserved cryo without treating it as a saved report",()=>{const result=currentComplianceStock(stock([currentUnit,{...currentUnit,componentId:"COMP_RESERVED",inventoryStatus:"RESERVED",reservationId:"RES_TEST",reservationVersion:1}]),"INST_SAMPLE",now);expect(result.total).toBe(2);expect(result.groups.find(g=>g.componentType==="CRYOPRECIPITATE")!.bloodTypes.find(r=>r.bloodType==="A_POSITIVE")).toMatchObject({availableCount:1,reservedCount:1,reportableCount:2});});
 it("excludes expired labels and stock already dispatched",()=>{const result=currentComplianceStock(stock([{...currentUnit,expiryState:"LABEL_EXPIRED_PENDING_EVALUATION"},{...currentUnit,componentId:"COMP_DISPATCHED",inventoryStatus:"DISPATCHED"},{...currentUnit,componentId:"COMP_TIME_EXPIRED",expiresAt:"2026-10-15T00:00:00Z"}]),"INST_SAMPLE",now);expect(result.total).toBe(0);expect(result.labelExpiredPendingEvaluation).toBe(1);});
 it("returns all forty zero cells only for a valid empty inventory read",()=>{const result=currentComplianceStock(stock([]),"INST_SAMPLE",now);expect(result.groups.flatMap(g=>g.bloodTypes)).toHaveLength(40);expect(result.total).toBe(0);expect(()=>currentComplianceStock(undefined,"INST_SAMPLE",now)).toThrow();});
 it("rejects duplicate components and foreign inventory",()=>{expect(()=>currentComplianceStock(stock([currentUnit,currentUnit]),"INST_SAMPLE",now)).toThrow();expect(()=>currentComplianceStock(stock([currentUnit]),"INST_OTHER",now)).toThrow();});
});
