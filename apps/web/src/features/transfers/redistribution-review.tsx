import { useEffect, useState } from "react";
import { canAct, type Principal } from "../../auth/permissions";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES, readV2Components, submitV2Reservation, type V2Component } from "../../services/api/v2";
import { readSelectedRecord, type TransferRequestDetail } from "../../services/api/v2-navigation";
import { useRedistributionMatches, eligibleRedistribution } from "../dashboard/redistribution-matches";
import { DashboardRedistribution } from "../dashboard/dashboard-redistribution";
import { useUatCommand } from "../commands/use-uat-command";
import { CommandStatusCard } from "../commands/command-status-card";
import { componentLabel, facilityLabel } from "./requester-transfer-data";
import { formatBloodType, formatManilaDateTime } from "../../components/ui/display";

export type RedistributionRequest = {transfer_id:string;source_institution_id?:string;destination_institution_id:string;blood_type:string;component_type:string;quantity:number;status:string;ledger_transaction_id:string|null};
export function redistributionUnits(components:V2Component[], institutionId:string, request:TransferRequestDetail, now:number) {
  if(components.some(row=>row.institutionId!==institutionId))throw Error("Stock outside source scope");
  return components.filter(row=>row.bloodType===request.blood_type&&row.componentType===request.component_type&&row.inventoryStatus==="AVAILABLE"&&row.expiryState==="CURRENT"&&!row.reservationId&&Date.parse(row.expiresAt)>now).sort((a,b)=>Date.parse(a.expiresAt)-Date.parse(b.expiresAt)||a.componentId.localeCompare(b.componentId)).slice(0,request.quantity);
}
export function RedistributionReview({principal,requests,reservations,onRefresh}:{principal:Principal;requests:RedistributionRequest[];reservations:{transfer_id:string|null}[];onRefresh:()=>void}) {
  const query=new URLSearchParams(location.search);
  const blood=V2_BLOOD_TYPES.find(value=>value===query.get("bloodType")),component=V2_COMPONENT_TYPES.find(value=>value===query.get("componentType")),destination=query.get("destination");
  const [selected,setSelected]=useState("");
  const [snapshot,setSnapshot]=useState<{id:string;request:TransferRequestDetail;units:V2Component[];at:number}>();
  const [error,setError]=useState(""),[confirmed,setConfirmed]=useState(false),[revision,setRevision]=useState(0),[reservationId,setReservationId]=useState("");
  const [now,setNow]=useState(Date.now);
  const command=useUatCommand(()=>{setSnapshot(undefined);setConfirmed(false);onRefresh();});
  const candidates=requests.filter(row=>row.source_institution_id===principal.institutionId&&row.destination_institution_id===destination&&row.blood_type===blood&&row.component_type===component&&row.status==="PENDING"&&row.ledger_transaction_id&&!reservations.some(res=>res.transfer_id===row.transfer_id));
  const request=candidates.find(row=>row.transfer_id===selected);
  const quantity=request?.quantity??Number(query.get("quantity")??1);
  const ranking=useRedistributionMatches(principal.institutionId,false,blood??"A_POSITIVE",component??"PACKED_RED_BLOOD_CELLS",blood&&component&&destination&&Number.isSafeInteger(quantity)&&quantity>0&&quantity<=999?quantity:null);
  const evidence=ranking.data[0];
  const matched=evidence&&eligibleRedistribution(evidence)&&evidence.ranked[0].destinationInstitutionId===destination;
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    let closed=false;setSnapshot(undefined);setError("");setConfirmed(false);
    if(!selected)return;
    void Promise.all([readSelectedRecord({kind:"request",id:selected},principal),readV2Components("V2.1")]).then(([record,stock])=>{
      if(closed)return;
      if(record.kind!=="request"||record.value.status!=="PENDING"||record.value.source_institution_id!==principal.institutionId||record.value.destination_institution_id!==destination||record.value.blood_type!==blood||record.value.component_type!==component)throw Error("Request changed");
      const at=Date.now(),units=redistributionUnits(stock.components,principal.institutionId,record.value,at);
      if(units.length!==record.value.quantity)throw Error("Insufficient eligible stock");
      setSnapshot({id:selected,request:record.value,units,at});
    }).catch(()=>{if(!closed)setError("Current request and FEFO allocation could not be verified. Refresh the allocation.");});
    return()=>{closed=true;};
  },[selected,principal,destination,blood,component,revision]);
  const fresh=snapshot?.id===selected&&request?.quantity===snapshot.request.quantity&&now-snapshot.at<60000&&snapshot.units.every(row=>Date.parse(row.expiresAt)>now);
  const authorized=principal.accountId?canAct(principal,"transfer:approve"):principal.roleId==="ROLE-02";
  const ready=authorized&&matched&&!ranking.busy&&fresh&&confirmed;
  async function submit(){
    if((!ready&&!command.ambiguous)||!snapshot)return;
    await command.submit(keys=>{const id="RES_WEB_"+keys.correlationId.slice("CORR_".length);setReservationId(id);return {resourceType:"TRANSFER",resourceId:snapshot.request.transfer_id,payload:{reservationId:id,transferId:snapshot.request.transfer_id,selectedComponentIds:snapshot.units.map(row=>row.componentId),expectedComponentVersions:snapshot.units.map(row=>row.inventoryVersion),eventTime:new Date().toISOString(),correlationId:keys.correlationId}};},(payload,keys)=>submitV2Reservation(payload,keys));
  }
  if(!blood||!component||!destination)return <section className="redistribution-review"><p>Select a destination on the Dashboard to review its matching request and allocation.</p><DashboardRedistribution principal={principal}/></section>;
  return <section className="bank-record-card redistribution-review" aria-label="Redistribution review"><header className="bank-section-heading"><h2>Review redistribution</h2></header>
    <div className="dashboard-redistribution-body"><strong>{facilityLabel(destination,principal)} · {formatBloodType(blood)} {componentLabel(component)}</strong>
      <p>Review a pending request assigned to this blood bank. Approval reserves its full quantity using FEFO; preparation and dispatch follow under Transfers.</p>
      {!matched&&<p role="status">{ranking.busy?"Rechecking destination and source surplus…":"This destination is no longer the top eligible match. Return to Dashboard and refresh the matches."}</p>}
      <label>Matching request<select aria-label="Redistribution request" value={selected} disabled={command.locked} onChange={event=>{setSelected(event.target.value);command.correct();}}><option value="">Choose a request</option>{candidates.map(row=><option key={row.transfer_id} value={row.transfer_id}>{row.transfer_id} · {row.quantity} {row.quantity===1?"unit":"units"}</option>)}</select></label>
      {!candidates.length&&<p>No pending unreserved request for this product and destination is assigned to your bank. A recommendation alone cannot create a request on another facility’s behalf.</p>}
      {error&&<p role="alert">{error}</p>}
      {snapshot&&<><strong>FEFO allocation · {snapshot.units.length} {snapshot.units.length===1?"unit":"units"}</strong><div className="table-wrap"><table className="data-table"><thead><tr><th>Component</th><th>Expiry</th><th>Version</th></tr></thead><tbody>{snapshot.units.map(row=><tr key={row.componentId}><td>{row.componentId}</td><td>{formatManilaDateTime(row.expiresAt)}</td><td>{row.inventoryVersion}</td></tr>)}</tbody></table></div>{!fresh&&<p role="status">Allocation expired or changed. Refresh it before confirming.</p>}</>}
      <button className="button compact" disabled={command.locked||!selected} onClick={()=>{setRevision(value=>value+1);ranking.refresh();command.correct();}}>Refresh allocation</button>
      <label className="redistribution-confirm"><input type="checkbox" checked={confirmed} disabled={!fresh||command.locked} onChange={event=>setConfirmed(event.target.checked)}/>I confirm this request and the selected FEFO units for redistribution.</label>
      <button className="button primary" disabled={command.busy||!!command.command||command.requiresCorrection||(!ready&&!command.ambiguous)} onClick={()=>void submit()}>{command.ambiguous?"Retry same approval":"Approve and reserve redistribution"}</button>
      {!authorized&&<p>An authorized transfer approver is required.</p>}
      {command.error&&<p role="alert">{command.error}</p>}
      {command.ambiguous&&<button className="button" disabled={command.busy} onClick={()=>void command.recover()}>Recover approval attempt</button>}
      {command.command&&<CommandStatusCard command={command.command} pollError={command.pollError} onClear={()=>{command.clear();setSelected("");onRefresh();}}/>}
      {command.command?.status==="COMMITTED"&&<a className="button" href={"/transfers?record=reservation&recordId="+encodeURIComponent(reservationId)}>Open reserved transfer →</a>}
      <small>Command acceptance means queued. Only a committed command confirms reservation; it does not dispatch the units.</small>
    </div></section>;
}
