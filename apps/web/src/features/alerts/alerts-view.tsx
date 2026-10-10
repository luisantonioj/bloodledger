import { useRef, useState } from "react";
import { formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";
import type { Alert, AlertAggregate, Alerts } from "../../services/api/types";
import { acknowledgeAlert } from "./alert-api";
import { filterAlerts } from "./alert-filter";

function AcknowledgeAlert({alertId,onDone}:{alertId:string;onDone:()=>void}) {
  const keys=useRef<MutationKeys|undefined>(undefined);
  const[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(){
    setBusy(true);setError("");keys.current??=newMutationKeys();
    try{await acknowledgeAlert(alertId,{correlationId:keys.current.correlationId},keys.current);keys.current=undefined;onDone()}
    catch(reason){setError(reason instanceof Error?reason.message:"Acknowledgement failed.")}
    finally{setBusy(false)}
  }
  return <div className="ack-action"><button className="button primary compact" disabled={busy} onClick={()=>void submit()}>{busy?"Acknowledging...":error?"Retry acknowledgement":"Acknowledge"}</button>{error&&<span role="alert">{error}</span>}</div>;
}

export function AlertsView({data,canAcknowledge,onRefresh}:{data:Alerts;canAcknowledge:boolean;onRefresh:()=>void}) {
  const[severity,setSeverity]=useState("ALL");
  const items=data.scope==="CITY_AGGREGATE"?data.aggregates:data.alerts,filtered=filterAlerts<Alert|AlertAggregate>(items,{severity,status:"ALL"});
  const critical=items.filter(item=>item.severity==="CRITICAL").length;
  const warnings=items.filter(item=>item.severity==="WARNING").length;
  const information=items.filter(item=>item.severity==="INFORMATION").length;
  const summary=<div className="stats alert-summary"><article><span>All alerts</span><strong>{items.length}</strong></article><article className="accent-critical"><span>Critical</span><strong>{critical}</strong></article><article className="accent-warning"><span>Warnings</span><strong>{warnings}</strong></article><article className="accent-information"><span>Information</span><strong>{information}</strong></article></div>;
  const filters=<div className="alert-severity-filters" aria-label="Alert severity filters">{[["ALL","All",items.length],["CRITICAL","Critical",critical],["WARNING","Warnings",warnings],["INFORMATION","Information",information]].map(([value,label,count])=><button key={value} type="button" className="alert-filter-chip" aria-pressed={severity===value} onClick={()=>setSeverity(String(value))}>{label}<span>{count}</span></button>)}</div>;
  if(items.length===0)return <>{summary}{filters}<div className="empty alert-empty"><span className="empty-mark" aria-hidden="true">BL</span><strong>No alerts</strong>No authorized alert currently requires display.</div></>;
  if(filtered.length===0)return <>{summary}{filters}<div className="empty"><strong>No alerts match these filters</strong>Choose another severity to view alert records.</div></>;
  if(data.scope==="CITY_AGGREGATE")return <>{summary}{filters}<div className="alert-list">{(filtered as AlertAggregate[]).map((item,index)=><article className={`alert-card severity-${item.severity.toLowerCase()}`} key={`${item.institutionDisplayName}-${item.alertType}-${index}`}><div className="alert-copy"><div className="alert-heading"><span className={statusClassName(item.severity)}>{humanizeCode(item.severity)}</span><span>{formatManilaDateTime(item.lastEvaluatedAt)}</span></div><h3>{humanizeCode(item.alertType)}</h3><p>{item.institutionDisplayName}</p><div className="alert-meta"><span><small>Status</small><strong>{humanizeCode(item.status)}</strong></span><span><small>Alert count</small><strong>{item.count}</strong></span></div></div><div className="alert-action"><span className="muted-action">Network summary</span></div></article>)}</div></>;

  return <>{summary}{filters}<div className="alert-list">{(filtered as Alert[]).map(item=><article className={`alert-card severity-${item.severity.toLowerCase()}`} key={item.alertId}><div className="alert-copy"><div className="alert-heading"><span className={statusClassName(item.severity)}>{humanizeCode(item.severity)}</span><span>{formatManilaDateTime(item.evaluatedAt)}</span></div><h3>{humanizeCode(item.alertType)}</h3><p>{item.unitId?<><span className="mono">{item.unitId}</span>{item.bloodType&&item.component?` · ${humanizeCode(item.bloodType)} / ${humanizeCode(item.component)}`:""}</>:"Aggregate operational alert"}</p><div className="alert-meta"><span><small>Status</small><strong>{humanizeCode(item.status)}</strong></span><span><small>Expiration</small><strong>{formatManilaDateTime(item.expiresAt)}</strong></span></div></div><div className="alert-action">{item.acknowledged?<span className="status">Acknowledged</span>:canAcknowledge&&item.status==="OPEN"?<AcknowledgeAlert alertId={item.alertId} onDone={onRefresh}/>:<span className="muted-action">Not acknowledged</span>}</div></article>)}</div></>;
}
