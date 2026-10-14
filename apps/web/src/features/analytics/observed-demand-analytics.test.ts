// FR-05/12: observed demand uses scoped dated requests, never forecast or receipt quantities.
import {describe,expect,it} from "vitest";
import {observedRequests,filterObservedRequests,monthlyObservedRequests} from "./observed-demand-analytics";
import {emptyAnalyticsFilters} from "./analytics-reporting-filters";
import type {Principal} from "../../auth/permissions";
const principal={institutionId:"INST_BANK",roleId:"ROLE-02",accountCategory:"BLOOD_BANK"} as Principal;
const row={transfer_id:"TR_SAMPLE",source_institution_id:"INST_BANK",destination_institution_id:"INST_REQUESTER",blood_type:"O_POSITIVE",component_type:"WHOLE_BLOOD",quantity:3,urgency:"ROUTINE",request_time:"2026-10-11T16:10:00Z",status:"APPROVED",ledger_transaction_id:null};
const body={scope:"INSTITUTION",classification:"SIMULATION_ONLY",requests:[row]};
describe("observed request history",()=>{
 it("keeps bank supply requests separate from own procurement and other institutions",()=>{
  expect(observedRequests({...body,requests:[row,{...row,transfer_id:"TR_OTHER",source_institution_id:"INST_OTHER",destination_institution_id:"INST_BANK"}]},principal)).toHaveLength(1);
  expect(observedRequests(body,{...principal,accountCategory:"REQUESTOR",roleId:"ROLE-03",institutionId:"INST_REQUESTER"})).toHaveLength(1);
 });
 it("rejects network scope and duplicates rather than double-counting",()=>{
  expect(()=>observedRequests({...body,scope:"CITY_AGGREGATE"},principal)).toThrow();expect(()=>observedRequests({...body,requests:[row,row]},principal)).toThrow();
 });
 it("groups by Manila request month and leaves undated records out of monthly totals",()=>{
  const rows=observedRequests({...body,requests:[row,{...row,transfer_id:"TR_UNDATED",request_time:null}]},principal);
  expect(monthlyObservedRequests(rows)).toEqual([{month:"2026-10",requests:1,units:3}]);expect(filterObservedRequests(rows,{...emptyAnalyticsFilters,from:"2026-10-12",to:"2026-10-12"})).toHaveLength(1);
 });
 it("filters products and rejects reversed date ranges",()=>{
  const rows=observedRequests(body,principal);expect(filterObservedRequests(rows,{...emptyAnalyticsFilters,bloodType:"B_NEGATIVE"})).toHaveLength(0);expect(filterObservedRequests(rows,{...emptyAnalyticsFilters,from:"2026-10-13",to:"2026-10-12"})).toHaveLength(0);
 });
});
