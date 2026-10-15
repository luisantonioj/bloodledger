import { retryAfterContextChange } from "../../services/api/client";
import { useEffect, useState } from "react";
import { canAct, type Principal } from "../../auth/permissions";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES, readV2Components, submitV2Reservation, type V2Component } from "../../services/api/v2";
import { readSelectedRecord, type TransferRequestDetail } from "../../services/api/v2-navigation";
import { useRedistributionMatches, eligibleRedistribution } from "../dashboard/redistribution-matches";
import { useUatCommand } from "../commands/use-uat-command";
import { CommandStatusCard } from "../commands/command-status-card";
import { componentLabel, facilityLabel } from "./requester-transfer-data";
import { formatBloodType, compactRecordReference } from "../../components/ui/display";

import { RecordTime } from "../../components/ui/record-time";

export type RedistributionRequest = {transfer_id:string;source_institution_id?:string;destination_institution_id:string;blood_type:string;component_type:string;quantity:number;status:string;decision_state?:string;reservation_id?:string|null;reservation_status?:string|null;ledger_transaction_id:string|null};
export function redistributionUnits(components:V2Component[], institutionId:string, request:TransferRequestDetail, now:number) {
  if(components.some(row=>row.institutionId!==institutionId))throw Error("Stock outside source scope");
  return components.filter(row=>row.bloodType===request.blood_type&&row.componentType===request.component_type&&row.inventoryStatus==="AVAILABLE"&&row.expiryState==="CURRENT"&&!row.reservationId&&Date.parse(row.expiresAt)>now).sort((a,b)=>Date.parse(a.expiresAt)-Date.parse(b.expiresAt)||a.componentId.localeCompare(b.componentId)).slice(0,request.quantity);
}
export function redistributionRequestCandidates<T extends RedistributionRequest>(requests:T[],reservations:{transfer_id:string|null}[],institutionId:string,destination:string,blood:string,component:string) {
  return requests.filter(row=>row.source_institution_id===institutionId&&row.destination_institution_id===destination&&row.blood_type===blood&&row.component_type===component&&(row.decision_state==="AWAITING_DECISION"||row.decision_state===undefined&&row.status==="PENDING")&&!row.reservation_id&&row.ledger_transaction_id&&!reservations.some(res=>res.transfer_id===row.transfer_id));
}
export function RedistributionReview({principal,requests,reservations,requestId,onRefresh,onLockChange,redistribution=true}:{principal:Principal;requests:RedistributionRequest[];reservations:{transfer_id:string|null}[];requestId:string;onRefresh:()=>void;onLockChange:(locked:boolean)=>void;redistribution?:boolean}) {
  const query=new URLSearchParams(location.search);
  const selectedRequest=requests.find(row=>row.transfer_id===requestId);
  const blood=V2_BLOOD_TYPES.find(value=>value===(redistribution?query.get("bloodType"):selectedRequest?.blood_type)),component=V2_COMPONENT_TYPES.find(value=>value===(redistribution?query.get("componentType"):selectedRequest?.component_type)),destination=redistribution?query.get("destination"):selectedRequest?.destination_institution_id;
  const selected=requestId;
  const [snapshot,setSnapshot]=useState<{id:string;request:TransferRequestDetail;units:V2Component[];at:number}>();
  const [error,setError]=useState(""),[confirmed,setConfirmed]=useState(false),[revision,setRevision]=useState(0),[reservationId,setReservationId]=useState("");
  const [now,setNow]=useState(Date.now);
  const command=useUatCommand(()=>{setSnapshot(undefined);setConfirmed(false);onRefresh();});
  useEffect(()=>{onLockChange(command.locked);return()=>onLockChange(false);},[command.locked,onLockChange]);
  const candidates=redistributionRequestCandidates(requests,reservations,principal.institutionId,destination??"",blood??"",component??"");
  const request=candidates.find(row=>row.transfer_id===selected);
  const quantity=request?.quantity??Number(query.get("quantity")??1);
  const ranking=useRedistributionMatches(principal.institutionId,false,blood??"A_POSITIVE",component??"PACKED_RED_BLOOD_CELLS",redistribution&&blood&&component&&destination&&Number.isSafeInteger(quantity)&&quantity>0&&quantity<=999?quantity:null);
  const evidence=ranking.data[0];
  const matched=evidence&&eligibleRedistribution(evidence)&&evidence.ranked.some(row=>row.destinationInstitutionId===destination);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    let closed=false;setSnapshot(undefined);setError("");setConfirmed(false);
    if(!selected)return;
    void Promise.all([retryAfterContextChange(() => readSelectedRecord({kind:"request",id:selected},principal), () => !closed),retryAfterContextChange(() => readV2Components("V2.1"), () => !closed)]).then(([record,stock])=>{
      if(closed)return;
      if(record.kind!=="request"||record.value.status!=="PENDING"||record.value.decision_state!==undefined&&record.value.decision_state!=="AWAITING_DECISION"||Boolean(record.value.reservation_id)||record.value.source_institution_id!==principal.institutionId||record.value.destination_institution_id!==destination||record.value.blood_type!==blood||record.value.component_type!==component||!record.value.ledger_transaction_id)throw Error("Request changed");
      const at=Date.now(),units=redistributionUnits(stock.components,principal.institutionId,record.value,at);
      if(units.length!==record.value.quantity)throw Error("Insufficient eligible stock");
      setSnapshot({id:selected,request:record.value,units,at});
    }).catch(()=>{if(!closed)setError("Current request and FEFO allocation could not be verified. Refresh the allocation.");});
    return()=>{closed=true;};
  },[selected,principal,destination,blood,component,revision]);
  const fresh=snapshot?.id===selected&&request?.quantity===snapshot.request.quantity&&now-snapshot.at<60000&&snapshot.units.every(row=>Date.parse(row.expiresAt)>now);
  const authorized=principal.accountId?canAct(principal,"transfer:approve"):principal.roleId==="ROLE-02";
  const ready=authorized&&(!redistribution||matched&&!ranking.busy)&&fresh&&confirmed;
  async function submit(){
    if((!ready&&!command.ambiguous)||!snapshot)return;
    await command.submit(keys=>{const id="RES_WEB_"+keys.correlationId.slice("CORR_".length);setReservationId(id);return {resourceType:"TRANSFER",resourceId:snapshot.request.transfer_id,payload:{reservationId:id,transferId:snapshot.request.transfer_id,selectedComponentIds:snapshot.units.map(row=>row.componentId),expectedComponentVersions:snapshot.units.map(row=>row.inventoryVersion),eventTime:new Date().toISOString(),correlationId:keys.correlationId}};},(payload,keys)=>submitV2Reservation(payload,keys));
  }
  if(!blood||!component||!destination)return null;
  return <section className="redistribution-review bank-request-approval" aria-label="Transfer approval"><header className="bank-section-heading"><h3>Approve transfer</h3></header>
    <div className="dashboard-redistribution-body"><strong>{facilityLabel(destination,principal)} · {formatBloodType(blood)} {componentLabel(component)}</strong>
      <p className="approval-intro">Review the FEFO units below. Approval reserves the full request; prepare and dispatch under Transfers.</p>
      {redistribution&&!matched&&<p role="status">{ranking.busy?"Rechecking destination and source surplus…":"This destination is no longer an eligible match. Return to Dashboard and refresh the matches."}</p>}
      {!candidates.length&&<p>No pending unreserved request for this product and destination is assigned to your bank. A recommendation alone cannot create a request on another facility’s behalf.</p>}
      {error&&<p role="alert">{error}</p>}
      <div className="approval-allocation">
        <div className="approval-allocation-heading">
          <strong>{snapshot ? <>FEFO allocation · {snapshot.units.length} {snapshot.units.length===1?"unit":"units"}</> : "FEFO allocation"}</strong>
          <button className="button compact" disabled={command.locked||!selected} onClick={()=>{setRevision(value=>value+1);ranking.refresh();command.correct();}}>Refresh allocation</button>
        </div>
        {snapshot&&<>
          <table className="data-table approval-units"><thead><tr><th>Component</th><th>Expiry</th><th>Version</th></tr></thead><tbody>{snapshot.units.map(row=><tr key={row.componentId}><td><span title={row.componentId}>{compactRecordReference(row.componentId)}</span></td><td><RecordTime value={row.expiresAt}/></td><td>{row.inventoryVersion}</td></tr>)}</tbody></table>
          {!fresh&&<p role="status">Allocation expired or changed. Refresh it before confirming.</p>}
        </>}
      </div>
      <label className="redistribution-confirm"><input type="checkbox" checked={confirmed} disabled={!fresh||command.locked} onChange={event=>setConfirmed(event.target.checked)}/>I confirm this request and the selected FEFO units for {redistribution ? "redistribution" : "this transfer"}.</label>
      <button className="button primary" disabled={command.busy||!!command.command||command.requiresCorrection||(!ready&&!command.ambiguous)} onClick={()=>void submit()}>{command.ambiguous?"Retry same approval":"Approve Transfer"}</button>
      {!authorized&&<p>An authorized transfer approver is required.</p>}
      {command.error&&<p role="alert">{command.error}</p>}
      {command.ambiguous&&<button className="button" disabled={command.busy} onClick={()=>void command.recover()}>Recover approval attempt</button>}
      {command.command&&<CommandStatusCard command={command.command} pollError={command.pollError} onClear={()=>{command.clear();onRefresh();}}/>}
      {command.command?.status==="COMMITTED"&&<a className="button" href={"/transfers?record=reservation&recordId="+encodeURIComponent(reservationId)}>Open reserved transfer →</a>}
      <small>Approval is queued first. Units are reserved only after ledger commitment; dispatch is a separate step.</small>
    </div></section>;
}
