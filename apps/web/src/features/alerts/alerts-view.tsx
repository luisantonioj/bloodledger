import { useRef, useState } from "react";
import { formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";
import type { Alert, AlertAggregate, Alerts } from "../../services/api/types";
import { acknowledgeAlert } from "./alert-api";
import { alertOptions, filterAlerts } from "./alert-filter";

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
  const[severity,setSeverity]=useState("ALL"),[status,setStatus]=useState("ALL");
  const items=data.scope==="CITY_AGGREGATE"?data.aggregates:data.alerts,filtered=filterAlerts<Alert|AlertAggregate>(items,{severity,status});
  const critical=items.filter(item=>item.severity==="CRITICAL").length;
  const warnings=items.filter(item=>item.severity==="WARNING").length;
  const open=items.filter(item=>item.status==="OPEN").length;
  const summary=<div className="stats alert-summary"><article><span>All alerts</span><strong>{items.length}</strong></article><article className={critical?"accent-critical":""}><span>Critical</span><strong>{critical}</strong></article><article className={warnings?"accent-warning":""}><span>Warnings</span><strong>{warnings}</strong></article><article><span>Open</span><strong>{open}</strong></article></div>;
  const filters=<div className="filter-bar alert-filters" aria-label="Alert filters"><div className="filter-intro"><span aria-hidden="true">!</span><strong>Filter alerts</strong></div><label>Severity<select value={severity} onChange={event=>setSeverity(event.target.value)}><option value="ALL">All severities</option>{alertOptions<Alert|AlertAggregate>(items,"severity").map(value=><option value={value} key={value}>{humanizeCode(value)}</option>)}</select></label><label>Status<select value={status} onChange={event=>setStatus(event.target.value)}><option value="ALL">All statuses</option>{alertOptions<Alert|AlertAggregate>(items,"status").map(value=><option value={value} key={value}>{humanizeCode(value)}</option>)}</select></label><span className="record-count" role="status">{filtered.length} of {items.length} records</span></div>;
  if(items.length===0)return <>{summary}<div className="filter-bar alert-filters"><div className="filter-intro"><span aria-hidden="true">!</span><strong>Filter alerts</strong></div><span className="record-count" role="status">0 records</span></div><div className="empty alert-empty"><span className="empty-mark" aria-hidden="true">BL</span><strong>No alerts</strong>No authorized alert currently requires display.</div></>;
  if(filtered.length===0)return <>{filters}<div className="empty"><strong>No alerts match these filters</strong>Change one or more filters to view the authorized alert records.</div></>;
  if(data.scope==="CITY_AGGREGATE")return <>{summary}{filters}<div className="table-wrap"><table className="data-table"><thead><tr><th>Institution</th><th>Alert</th><th>Severity</th><th>Status</th><th>Count</th><th>Evaluated</th></tr></thead><tbody>{(filtered as AlertAggregate[]).map((item,index)=><tr key={`${item.institutionDisplayName}-${item.alertType}-${index}`}><td><strong>{item.institutionDisplayName}</strong></td><td>{humanizeCode(item.alertType)}</td><td><span className={statusClassName(item.severity)}>{humanizeCode(item.severity)}</span></td><td>{humanizeCode(item.status)}</td><td className="numeric">{item.count}</td><td className="data-time">{formatManilaDateTime(item.lastEvaluatedAt)}</td></tr>)}</tbody></table></div></>;
  return <>{summary}{filters}<div className="alert-list">{(filtered as Alert[]).map(item=><article className={`alert-card severity-${item.severity.toLowerCase()}`} key={item.alertId}><div className="alert-copy"><div className="alert-heading"><span className={statusClassName(item.severity)}>{humanizeCode(item.severity)}</span><span>{formatManilaDateTime(item.evaluatedAt)}</span></div><h3>{humanizeCode(item.alertType)}</h3><p>{item.unitId?<><span className="mono">{item.unitId}</span>{item.bloodType&&item.component?` · ${humanizeCode(item.bloodType)} / ${humanizeCode(item.component)}`:""}</>:"Aggregate operational alert"}</p><div className="alert-meta"><span><small>Status</small><strong>{humanizeCode(item.status)}</strong></span><span><small>Expiration</small><strong>{formatManilaDateTime(item.expiresAt)}</strong></span></div></div><div className="alert-action">{item.acknowledged?<span className="status">Acknowledged</span>:canAcknowledge&&item.status==="OPEN"?<AcknowledgeAlert alertId={item.alertId} onDone={onRefresh}/>:<span className="muted-action">Not acknowledged</span>}</div></article>)}</div></>;
}
