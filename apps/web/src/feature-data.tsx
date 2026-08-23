import { useCallback, useEffect, useRef, useState } from "react";
import { pollingDelay } from "./polling";
import { newMutationKeys, type MutationKeys } from "./mutation-keys";

type Aggregate = { institutionId:string; institutionDisplayName:string; bloodType:string; component:string; inventoryStatus:string; confirmedCount:number; lastProjectedAt:string };
type Unit = { unitId:string; bloodType:string; component:string; expiresAt:string; inventoryStatus:string; projectedAt:string };
type Dashboard = { composition:string; scope:string; inventory:Aggregate[]; pendingScans:{status:string;count:number}[]; lastSuccessfulProjectionAt:string|null; classification:"SIMULATION_ONLY" };
type Inventory = { scope:string; aggregates:Aggregate[]; units:Unit[]; classification:"SIMULATION_ONLY" };
type Alert = { alertId:string; alertType:string; severity:string; unitId:string|null; bloodType:string|null; component:string|null; expiresAt:string|null; evaluatedAt:string; status:string; acknowledged:boolean };
type AlertAggregate = { institutionDisplayName:string; alertType:string; severity:string; status:string; count:number; lastEvaluatedAt:string };
type Alerts = { scope:string; alerts:Alert[]; aggregates:AlertAggregate[]; classification:"SIMULATION_ONLY" };
type Transfer = { transferId:string; sourceInstitutionId:string; destinationInstitutionId:string; bloodType:string; component:string; quantity:number; urgency:string; requestTime:string; status:string; reasonCode:string|null; ledgerVersion:number; projectedAt:string; dispatchEvidenceRecorded:boolean; receiptEvidenceRecorded:boolean };
type Transfers = { scope:string; transfers:Transfer[]; classification:"SIMULATION_ONLY" };
type TransferSummary = { status:string; transferCount:number; unitCount:number };
type Consortium = { scope:"CITY_AGGREGATE"; inventory:Aggregate[]; alerts:AlertAggregate[]; transferSummary:TransferSummary[]; lastSuccessfulProjectionAt:string|null; classification:"SIMULATION_ONLY" };
type AuditEvent = { auditEventId:string; institutionDisplayName:string; actionCode:string; targetType:string; outcome:string; safeErrorCode:string|null; correlationId:string; ledgerTransactionId:string|null; eventTime:string };
type Audit = { scope:"INSTITUTION"|"CITY_AGGREGATE"; events:AuditEvent[]; classification:"SIMULATION_ONLY" };
type Report = { reportType:"CITY_INVENTORY_SUMMARY"; scope:"CITY_AGGREGATE"; generatedAt:string; inventory:Aggregate[]; alerts:AlertAggregate[]; transferSummary:TransferSummary[]; disclaimer:string; classification:"SIMULATION_ONLY" };
type FeatureResponse = Dashboard | Inventory | Alerts | Transfers | Consortium | Audit | Report;

async function load<T>(path:string, signal:AbortSignal):Promise<T> {
  const response = await fetch(path, { credentials:"same-origin", headers:{ Accept:"application/json" }, signal });
  const body = await response.json().catch(() => null) as { error?:{ message?:string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "The data service is unavailable.");
  return body as T;
}

function useLiveData<T>(endpoint:string|null) {
  const [data,setData] = useState<T>();
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [retry,setRetry] = useState(0);
  const manual = useCallback(() => setRetry(value => value + 1), []);
  useEffect(() => {
    if (!endpoint) return;
    let timer:ReturnType<typeof globalThis.setTimeout>|undefined;
    let failures=0, closed=false, attempt=0;
    let controller:AbortController|undefined;
    const run=async()=>{
      if(closed||document.hidden)return;
      const current=++attempt;
      controller?.abort(); controller=new AbortController(); setBusy(true);
      try { setData(await load<T>(endpoint,controller.signal)); setError(""); failures=0; }
      catch(reason) { if(!controller.signal.aborted){ failures++; setError(reason instanceof Error?reason.message:"The data service is unavailable."); } }
      finally { if(!closed&&current===attempt){ setBusy(false); timer=globalThis.setTimeout(()=>void run(),pollingDelay(failures)); } }
    };
    const visible=()=>{ globalThis.clearTimeout(timer); if(!document.hidden)void run(); };
    document.addEventListener("visibilitychange",visible); void run();
    return()=>{ closed=true; controller?.abort(); globalThis.clearTimeout(timer); document.removeEventListener("visibilitychange",visible); };
  },[endpoint,retry]);
  return { data,error,busy,manual };
}

const format=(value:string|null)=>value?new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"Not yet projected";
const words=(value:string)=>value.replaceAll("_"," ");
const chip=(value:string)=>`status ${["CRITICAL","FAILED","COMPROMISED","REJECTED"].includes(value)?"critical":["WARNING","DELAYED","PENDING"].includes(value)?"warning":""}`;

function AggregateTable({items}:{items:Aggregate[]}) {
  if(items.length===0)return <div className="empty"><strong>No committed inventory</strong>No ledger-confirmed projection is available for this scope.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Institution</th><th>Blood type</th><th>Component</th><th>Status</th><th>Confirmed</th><th>Projected</th></tr></thead><tbody>{items.map((item,index)=><tr key={`${item.institutionId}-${item.bloodType}-${item.component}-${item.inventoryStatus}-${index}`}><td>{item.institutionDisplayName}</td><td>{words(item.bloodType)}</td><td>{words(item.component)}</td><td><span className={chip(item.inventoryStatus)}>{words(item.inventoryStatus)}</span></td><td>{item.confirmedCount}</td><td>{format(item.lastProjectedAt)}</td></tr>)}</tbody></table></div>;
}

function AcknowledgeAlert({alertId,onDone}:{alertId:string;onDone:()=>void}) {
  const keys=useRef<MutationKeys|undefined>(undefined);
  const[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(){
    setBusy(true);setError("");keys.current??=newMutationKeys();
    try{
      const response=await fetch("/api/v1/alerts/"+encodeURIComponent(alertId)+"/acknowledgements",{method:"POST",credentials:"same-origin",headers:{Accept:"application/json","Content-Type":"application/json","Idempotency-Key":keys.current.idempotencyKey},body:JSON.stringify({correlationId:keys.current.correlationId})});
      const body=await response.json().catch(()=>null) as {error?:{message?:string}}|null;
      if(!response.ok)throw new Error(body?.error?.message??"Acknowledgement failed.");
      keys.current=undefined;onDone();
    }catch(reason){setError(reason instanceof Error?reason.message:"Acknowledgement failed.");}
    finally{setBusy(false)}
  }
  return <div className="ack-action"><button className="button" disabled={busy} onClick={()=>void submit()}>{busy?"Acknowledging...":error?"Retry acknowledgement":"Acknowledge"}</button>{error&&<span role="alert">{error}</span>}</div>;
}

function AlertsTable({data,canAcknowledge,onRefresh}:{data:Alerts;canAcknowledge:boolean;onRefresh:()=>void}) {
  if(data.scope==="CITY_AGGREGATE")return data.aggregates.length===0?<div className="empty"><strong>No aggregate alerts</strong>No approved alert aggregate is available.</div>:<div className="table-wrap"><table><thead><tr><th>Institution</th><th>Alert</th><th>Severity</th><th>Status</th><th>Count</th><th>Evaluated</th></tr></thead><tbody>{data.aggregates.map((item,index)=><tr key={`${item.institutionDisplayName}-${item.alertType}-${index}`}><td>{item.institutionDisplayName}</td><td>{words(item.alertType)}</td><td><span className={chip(item.severity)}>{item.severity}</span></td><td>{item.status}</td><td>{item.count}</td><td>{format(item.lastEvaluatedAt)}</td></tr>)}</tbody></table></div>;
  return data.alerts.length===0?<div className="empty"><strong>No alerts</strong>No authorized alert currently requires display.</div>:<div className="table-wrap"><table><thead><tr><th>Alert</th><th>Unit</th><th>Blood/component</th><th>Severity</th><th>Expires</th><th>Acknowledgement</th></tr></thead><tbody>{data.alerts.map(item=><tr key={item.alertId}><td>{words(item.alertType)}</td><td className="mono">{item.unitId??"Not applicable"}</td><td>{item.bloodType&&item.component?`${words(item.bloodType)} / ${words(item.component)}`:"Not applicable"}</td><td><span className={chip(item.severity)}>{item.severity}</span></td><td>{format(item.expiresAt)}</td><td>{item.acknowledged?"Acknowledged":canAcknowledge&&item.status==="OPEN"?<AcknowledgeAlert alertId={item.alertId} onDone={onRefresh}/>:"Not acknowledged"}</td></tr>)}</tbody></table></div>;
}

function TransfersTable({data}:{data:Transfers}) {
  if(data.transfers.length===0)return <div className="empty"><strong>No transfers</strong>No ledger-confirmed transfer is available for this scope.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Transfer</th><th>Route</th><th>Blood/component</th><th>Quantity</th><th>Urgency</th><th>Status</th><th>Evidence</th><th>Projected</th></tr></thead><tbody>{data.transfers.map(item=><tr key={item.transferId}><td className="mono">{item.transferId}</td><td>{item.sourceInstitutionId} to {item.destinationInstitutionId}</td><td>{words(item.bloodType)} / {words(item.component)}</td><td>{item.quantity}</td><td>{item.urgency}</td><td><span className={chip(item.status)}>{words(item.status)}</span></td><td>Dispatch {item.dispatchEvidenceRecorded?"recorded":"pending"}; receipt {item.receiptEvidenceRecorded?"recorded":"pending"}</td><td>{format(item.projectedAt)}</td></tr>)}</tbody></table></div>;
}

function AlertAggregateTable({items}:{items:AlertAggregate[]}) {
  if(items.length===0)return <div className="empty"><strong>No aggregate alerts</strong>No approved alert aggregate is available.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Institution</th><th>Alert</th><th>Severity</th><th>Status</th><th>Count</th><th>Evaluated</th></tr></thead><tbody>{items.map((item,index)=><tr key={item.institutionDisplayName+"-"+item.alertType+"-"+index}><td>{item.institutionDisplayName}</td><td>{words(item.alertType)}</td><td><span className={chip(item.severity)}>{item.severity}</span></td><td>{words(item.status)}</td><td>{item.count}</td><td>{format(item.lastEvaluatedAt)}</td></tr>)}</tbody></table></div>;
}

function TransferSummaryTable({items}:{items:TransferSummary[]}) {
  if(items.length===0)return <div className="empty"><strong>No transfer summary</strong>No ledger-confirmed transfer aggregate is available.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Status</th><th>Transfers</th><th>Units</th></tr></thead><tbody>{items.map(item=><tr key={item.status}><td><span className={chip(item.status)}>{words(item.status)}</span></td><td>{item.transferCount}</td><td>{item.unitCount}</td></tr>)}</tbody></table></div>;
}

function ConsortiumView({data}:{data:Consortium}) {
  const confirmed=data.inventory.reduce((sum,item)=>sum+item.confirmedCount,0);
  const alerts=data.alerts.reduce((sum,item)=>sum+item.count,0);
  const transfers=data.transferSummary.reduce((sum,item)=>sum+item.transferCount,0);
  return <><p className="report-note">Application-level city aggregate. PRC and secondary hospitals are not represented as Fabric peer organizations.</p><div className="stats"><article><span>Ledger-confirmed units</span><strong>{confirmed}</strong></article><article><span>Aggregate alerts</span><strong>{alerts}</strong></article><article><span>Transfers</span><strong>{transfers}</strong></article></div><h3>Inventory by institution</h3><AggregateTable items={data.inventory}/><h3>Alert summary</h3><AlertAggregateTable items={data.alerts}/><h3>Transfer summary</h3><TransferSummaryTable items={data.transferSummary}/></>;
}

function AuditView({data}:{data:Audit}) {
  if(data.events.length===0)return <div className="empty"><strong>No audit events</strong>No permitted redacted application event is available for this scope.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Institution</th><th>Action</th><th>Target</th><th>Outcome</th><th>Correlation</th><th>Ledger reference</th><th>Time</th></tr></thead><tbody>{data.events.map(item=><tr key={item.auditEventId}><td>{item.institutionDisplayName}</td><td>{words(item.actionCode)}</td><td>{words(item.targetType)}</td><td><span className={chip(item.outcome)}>{words(item.outcome)}</span>{item.safeErrorCode?" - "+words(item.safeErrorCode):""}</td><td className="mono">{item.correlationId}</td><td className="mono">{item.ledgerTransactionId??"Not applicable"}</td><td>{format(item.eventTime)}</td></tr>)}</tbody></table></div>;
}

function ReportView({data}:{data:Report}) {
  return <><div className="report-toolbar"><p><strong>SIMULATION ONLY.</strong> {data.disclaimer}<br/>Generated {format(data.generatedAt)}.</p><a className="button" href="/api/v1/reports/inventory.csv" download>Download simulation CSV</a></div><h3>Inventory aggregate</h3><AggregateTable items={data.inventory}/><h3>Alert aggregate</h3><AlertAggregateTable items={data.alerts}/><h3>Transfer aggregate</h3><TransferSummaryTable items={data.transferSummary}/></>;
}

export function FeatureData({path,canAcknowledge=false}:{path:string;canAcknowledge?:boolean}) {
  const endpoint:Record<string,string>={"/":"/api/v1/dashboard","/inventory":"/api/v1/inventory","/alerts":"/api/v1/alerts","/transfers":"/api/v1/transfers","/consortium":"/api/v1/consortium","/audit":"/api/v1/audit","/reporting":"/api/v1/reports/inventory"};
  const state=useLiveData<FeatureResponse>(endpoint[path]??null);
  if(!endpoint[path])return <div className="empty"><strong>Data unavailable</strong>The official feature API is not implemented yet. Runtime mock fallback is disabled.</div>;
  if(!state.data&&state.busy)return <div className="empty" aria-live="polite"><strong>Loading authorized data</strong>Waiting for the official API.</div>;
  if(!state.data)return <div className="empty" role="alert"><strong>Unable to load data</strong>{state.error}<br/><button className="button" onClick={state.manual}>Retry</button></div>;
  if(path==="/"){
    const data=state.data as Dashboard,total=data.inventory.reduce((sum,item)=>sum+item.confirmedCount,0),pending=data.pendingScans.reduce((sum,item)=>sum+item.count,0);
    return <><div className="stats"><article><span>Ledger-confirmed</span><strong>{total}</strong></article><article><span>Uncommitted scan states</span><strong>{pending}</strong></article><article><span>Last projection</span><strong className="time">{format(data.lastSuccessfulProjectionAt)}</strong></article></div>{state.error&&<p className="notice" role="status">Showing the last confirmed view. Refresh failed: {state.error} <button className="button" onClick={state.manual}>Retry</button></p>}<AggregateTable items={data.inventory}/></>;
  }
  if(path==="/consortium")return <ConsortiumView data={state.data as Consortium}/>;
  if(path==="/audit")return <AuditView data={state.data as Audit}/>;
  if(path==="/reporting")return <ReportView data={state.data as Report}/>;
  if(path==="/alerts")return <AlertsTable data={state.data as Alerts} canAcknowledge={canAcknowledge} onRefresh={state.manual}/>;
  if(path==="/transfers")return <TransfersTable data={state.data as Transfers}/>;
  const data=state.data as Inventory;
  if(data.scope==="CITY_AGGREGATE")return <AggregateTable items={data.aggregates}/>;
  return data.units.length===0?<div className="empty"><strong>No committed units</strong>No ledger-confirmed units are available for this institution.</div>:<div className="table-wrap"><table><thead><tr><th>Unit</th><th>Blood type</th><th>Component</th><th>Status</th><th>Expires</th><th>Projected</th></tr></thead><tbody>{data.units.map(item=><tr key={item.unitId}><td className="mono">{item.unitId}</td><td>{words(item.bloodType)}</td><td>{words(item.component)}</td><td><span className={chip(item.inventoryStatus)}>{words(item.inventoryStatus)}</span></td><td>{format(item.expiresAt)}</td><td>{format(item.projectedAt)}</td></tr>)}</tbody></table></div>;
}
