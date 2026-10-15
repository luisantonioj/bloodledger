import type { Principal } from "../../auth/permissions";
import type { Audit, AuditEvent } from "../../services/api/types";
import { formatManilaDateTime, humanizeCode } from "../../components/ui/display";
import { parseRequesterRecords } from "../transfers/requester-transfer-data";
export type ActivityEvent = AuditEvent & {targetReference?:string};
export const requesterActivity=(principal:Principal)=>principal.accountCategory?principal.accountCategory==="REQUESTOR":principal.roleId==="ROLE-03";
// FR-11/12: export only safe fields from the authorized read, never expand audit access.
export function permittedActivity(value:unknown,principal:Principal):Audit & {events:ActivityEvent[]} {
  if(requesterActivity(principal)){
    const body=value as {scope?:string}|null;if(body?.scope!=="INSTITUTION")throw Error("Transfer activity is unavailable for this scope.");
    const records=parseRequesterRecords(value,principal);
    const events=records.timeline.map(row=>({auditEventId:row.command_id,institutionDisplayName:principal.institutionDisplayName,actionCode:row.operation,targetType:records.requests.some(request=>request.transfer_id===row.resource_id)?"TRANSFER_REQUEST":"RESERVATION",targetReference:row.resource_id,outcome:row.status,safeErrorCode:null,correlationId:"Not supplied",ledgerTransactionId:row.ledger_transaction_id,eventTime:row.accepted_at}));
    if(events.some(row=>!Number.isFinite(Date.parse(row.eventTime)))||new Set(events.map(row=>row.auditEventId)).size!==events.length)throw Error("Transfer activity is incomplete.");
    return {scope:"INSTITUTION",classification:"SIMULATION_ONLY",events};
  }
  const body=value as (Omit<Audit,"events"> & {events:(AuditEvent & {institutionId?:string})[]})|null;
  const scope=principal.roleId==="ROLE-04"?"CITY_AGGREGATE":"INSTITUTION";
  if(!body||body.scope!==scope||body.classification!=="SIMULATION_ONLY"||!Array.isArray(body.events))throw Error("Activity history is unavailable for this scope.");
  const events=body.events.map(row=>{
    if(!row||![row.auditEventId,row.institutionDisplayName,row.actionCode,row.targetType,row.outcome,row.correlationId,row.eventTime].every(value=>typeof value==="string"&&value.length>0)||!Number.isFinite(Date.parse(row.eventTime))||(row.safeErrorCode!==null&&typeof row.safeErrorCode!=="string")||(row.ledgerTransactionId!==null&&typeof row.ledgerTransactionId!=="string")||(scope==="INSTITUTION"&&row.institutionId&&row.institutionId!==principal.institutionId))throw Error("Activity records are incomplete or outside your institution.");
    return {auditEventId:row.auditEventId,institutionDisplayName:row.institutionDisplayName,actionCode:row.actionCode,targetType:row.targetType,outcome:row.outcome,safeErrorCode:row.safeErrorCode,correlationId:row.correlationId,ledgerTransactionId:row.ledgerTransactionId,eventTime:row.eventTime};
  });
  if(new Set(events.map(row=>row.auditEventId)).size!==events.length)throw Error("Duplicate activity records are unavailable for export.");
  return {scope,classification:"SIMULATION_ONLY",events};
}
export function filterActivity(events:ActivityEvent[],action:string,search:string){
  const query=search.trim().toLowerCase();
  return events.filter(row=>(action==="ALL"||row.actionCode===action)&&[row.institutionDisplayName,row.actionCode,humanizeCode(row.actionCode),row.targetType,row.outcome,row.safeErrorCode??"",row.correlationId,row.ledgerTransactionId??"",row.targetReference??""].some(value=>value.toLowerCase().includes(query)));
}
// The safe read currently supplies institution source, not an acting person's identity.
export function activityReferences(row:ActivityEvent) {
  return {scanId:null,requestId:row.targetType==="TRANSFER_REQUEST"?row.targetReference??null:null,transferId:null};
}
export const activityHeaders=["Date & Time","Activity","User / Source","Scan ID","Request ID","Transfer ID","Blockchain ID","Status"];
export function activityRows(events:ActivityEvent[]){return events.map(row=>{const refs=activityReferences(row);return [formatManilaDateTime(row.eventTime),humanizeCode(row.actionCode),"Institution: "+row.institutionDisplayName,refs.scanId??"Not available",refs.requestId??"Not available",refs.transferId??"Not available",row.ledgerTransactionId??"Not available",humanizeCode(row.outcome)];});}
