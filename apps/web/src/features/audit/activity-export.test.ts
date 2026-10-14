// FR-11/12: filtered exports retain safe, authorized scope and command provenance.
import {describe,it,expect} from "vitest";
import type {Principal} from "../../auth/permissions";
import {permittedActivity,filterActivity,activityRows} from "./activity-export";
const bank={roleId:"ROLE-02",institutionId:"INST_BANK",institutionDisplayName:"Sample Bank",accountCategory:"BLOOD_BANK"} as Principal;
const event={auditEventId:"EV_SAMPLE",institutionDisplayName:"Sample Bank",institutionId:"INST_BANK",actionCode:"RESERVE",targetType:"COMPONENT",outcome:"PENDING",safeErrorCode:null,correlationId:"COR_SAMPLE",ledgerTransactionId:null,eventTime:"2026-10-12T00:00:00Z"};
const body={scope:"INSTITUTION",classification:"SIMULATION_ONLY",events:[event]};
describe("permitted activity exports",()=>{
 it("rejects invalid scopes, foreign institution IDs, duplicates and dates",()=>{
  expect(()=>permittedActivity({...body,scope:"CITY_AGGREGATE"},bank)).toThrow();
  expect(()=>permittedActivity({...body,events:[{...event,institutionId:"INST_OTHER"}]},bank)).toThrow();
  expect(()=>permittedActivity({...body,events:[event,event]},bank)).toThrow();
  expect(()=>permittedActivity({...body,events:[{...event,eventTime:"invalid"}]},bank)).toThrow();
 });
 it("copies only safe fields and permits regulatory aggregate scope",()=>{
  const data=permittedActivity({...body,events:[{...event,operatorPin:"DO_NOT_EXPORT"}]},bank);
  expect(JSON.stringify(data)).not.toContain("DO_NOT_EXPORT");
  expect(permittedActivity({...body,scope:"CITY_AGGREGATE"},{...bank,roleId:"ROLE-04",accountCategory:"DOH"}).events).toHaveLength(1);
 });
 it("exports all matching loaded records beyond a 20-record page",()=>{
  const rows=Array.from({length:51},(_,i)=>({...event,auditEventId:`EV_${i}`,actionCode:i<31?"RESERVE":"RELEASE"}));
  const filtered=filterActivity(rows,"RESERVE","sample");expect(filtered).toHaveLength(31);expect(activityRows(filtered)).toHaveLength(31);
  expect(filterActivity(rows,"RESERVE","missing")).toHaveLength(0);
 });
 it("excludes foreign requester activity and keeps pending command states distinct",()=>{
  const requester={...bank,roleId:"ROLE-03",accountCategory:"REQUESTOR",institutionId:"INST_REQUESTER"} as Principal;
  const request={transfer_id:"TR_OWN",source_institution_id:"INST_BANK",destination_institution_id:"INST_REQUESTER",blood_type:"O_POSITIVE",component_type:"WHOLE_BLOOD",quantity:1,urgency:"ROUTINE",status:"APPROVED",ledger_transaction_id:null};
  const command={command_id:"CMD_OWN",resource_id:"TR_OWN",operation:"APPROVE_TRANSFER",status:"ACCEPTED",accepted_at:event.eventTime,ledger_transaction_id:null};
  const data=permittedActivity({scope:"INSTITUTION",classification:"SIMULATION_ONLY",requests:[request,{...request,transfer_id:"TR_FOREIGN",destination_institution_id:"INST_OTHER"}],reservations:[],timeline:[command,{...command,command_id:"CMD_FOREIGN",resource_id:"TR_FOREIGN"}]},requester);
  expect(data.events).toHaveLength(1);expect(data.events[0]).toMatchObject({targetReference:"TR_OWN",outcome:"ACCEPTED",ledgerTransactionId:null,correlationId:"Not supplied"});
 });
});
