import {describe,it,expect} from "vitest";
import {parseDashboardStockCounts,parseReceiptDiscrepancy,parseApprovalQuantities,STOCK_STATUS_FIELDS} from "./panel-revisions";
import {V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "./v2";
const zero={available:0,reserved:0,outgoingInTransit:0,received:0,labelExpiredPendingEvaluation:0,expired:0,onHold:0,compromised:0};
function stock(){return {scope:"INSTITUTION",institutionId:"INST_MEDIATRIX",policyVersion:"DASHBOARD_EXACT_STOCK_V1",classification:"SIMULATION_ONLY",evaluatedAt:"2026-11-04T01:00:00.123Z",lastProjectedAt:null,pendingCommands:5,rows:V2_BLOOD_TYPES.flatMap(bloodType=>V2_COMPONENT_TYPES.map(componentType=>({bloodType,componentType,...zero}))),totals:{...zero,usable:0}};}
const discrepancy=()=>({discrepancyId:"RDS_"+"A".repeat(40),reservationId:"RES_TEST",reservationVersion:3,status:"OPEN",expectedUnits:2,matchedUnits:1,unmatchedLabels:1,missingUnits:1,recordedAt:"2026-11-04T01:00:00.123Z",resolutionCode:null,resolvedAt:null,policyVersion:"RECEIPT_DISCREPANCY_V1",classification:"SIMULATION_ONLY"});
describe("PA-REV-03 exact stock contract",()=>{
 it("preserves exact zero-filled counts, timestamps and separate pending commands",()=>{const result=parseDashboardStockCounts(stock(),"INST_MEDIATRIX");expect(result.rows).toHaveLength(40);expect(result.totals.usable).toBe(0);expect(result.pendingCommands).toBe(5);expect(result.evaluatedAt).toContain(".123Z");});
 it.each(["foreign","missing","duplicate","order","fraction","negative","sum","usable","policy"])("rejects %s evidence",kind=>{const body=stock();if(kind==="foreign")body.institutionId="OTHER";if(kind==="missing")body.rows.pop();if(kind==="duplicate")body.rows[1]=body.rows[0];if(kind==="order")[body.rows[0],body.rows[1]]=[body.rows[1],body.rows[0]];if(kind==="fraction")body.rows[0].available=0.5;if(kind==="negative")body.rows[0].available=-1;if(kind==="sum")body.totals.available=1;if(kind==="usable")body.totals.usable=1;if(kind==="policy")body.policyVersion="OTHER";expect(()=>parseDashboardStockCounts(body,"INST_MEDIATRIX")).toThrow();});
});
describe("PA-REV-01 partial approval",()=>{
 it("retains nulls for historical approvals without inventing a shortfall",()=>expect(parseApprovalQuantities({requestedQuantity:5,approvedQuantity:null,shortfallQuantity:null,partialApproval:null},3).approvedQuantity).toBeNull());
 it("accepts a closed shortfall only with its reason and exact reserved membership",()=>expect(parseApprovalQuantities({requestedQuantity:5,approvedQuantity:3,shortfallQuantity:2,partialApproval:{reasonCode:"INSUFFICIENT_ELIGIBLE_STOCK",policyVersion:"SYNTHETIC_PARTIAL_APPROVAL_REASONS_V1"}},3)).toMatchObject({approvedQuantity:3,shortfallQuantity:2}));
 it.each([{requestedQuantity:2,approvedQuantity:3,shortfallQuantity:0,partialApproval:null},{requestedQuantity:5,approvedQuantity:3,shortfallQuantity:2,partialApproval:null},{requestedQuantity:3,approvedQuantity:3,shortfallQuantity:1,partialApproval:null}])("rejects inconsistent quantities",body=>expect(()=>parseApprovalQuantities(body,3)).toThrow());
});
describe("PA-REV-02 discrepancy",()=>{
 it("reads open and resolved counts without accepting label evidence",()=>{expect(parseReceiptDiscrepancy(discrepancy(),"RES_TEST").status).toBe("OPEN");expect(parseReceiptDiscrepancy({...discrepancy(),status:"RESOLVED",resolutionCode:"RECOUNT_MATCHED",resolvedAt:"2026-11-04T01:01:00.456Z"},"RES_TEST").resolutionCode).toBe("RECOUNT_MATCHED");});
 it.each([{expectedUnits:0},{matchedUnits:3},{missingUnits:0},{status:"UNKNOWN"},{resolutionCode:"COMPROMISED"},{reservationId:"RES_FOREIGN"}])("rejects invalid discrepancy state",change=>expect(()=>parseReceiptDiscrepancy({...discrepancy(),...change},"RES_TEST")).toThrow());
});
