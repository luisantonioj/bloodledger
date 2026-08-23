import { useRef, useState } from "react";
import { formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import { requestJson } from "../../services/api/client";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";
import type { Alert, AlertAggregate, Alerts } from "../../services/api/types";
import { alertOptions, filterAlerts } from "./alert-filter";

function AcknowledgeAlert({alertId,onDone}:{alertId:string;onDone:()=>void}) {
  const keys=useRef<MutationKeys|undefined>(undefined);
  const[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(){
    setBusy(true);setError("");keys.current??=newMutationKeys();
    try{await requestJson("/api/v1/alerts/"+encodeURIComponent(alertId)+"/acknowledgements",{method:"POST",headers:{"Idempotency-Key":keys.current.idempotencyKey},body:JSON.stringify({correlationId:keys.current.correlationId})},"Acknowledgement failed.");keys.current=undefined;onDone()}
    catch(reason){setError(reason instanceof Error?reason.message:"Acknowledgement failed.")}
    finally{setBusy(false)}
  }
  return <div className="ack-action"><button className="button" disabled={busy} onClick={()=>void submit()}>{busy?"Acknowledging...":error?"Retry acknowledgement":"Acknowledge"}</button>{error&&<span role="alert">{error}</span>}</div>;
}

export function AlertsView({data,canAcknowledge,onRefresh}:{data:Alerts;canAcknowledge:boolean;onRefresh:()=>void}) {
  const[severity,setSeverity]=useState("ALL"),[status,setStatus]=useState("ALL");
  const items=data.scope==="CITY_AGGREGATE"?data.aggregates:data.alerts,filtered=filterAlerts<Alert|AlertAggregate>(items,{severity,status});
  const filters=<div className="filter-bar" aria-label="Alert filters"><label>Severity<select value={severity} onChange={event=>setSeverity(event.target.value)}><option value="ALL">All severities</option>{alertOptions<Alert|AlertAggregate>(items,"severity").map(value=><option value={value} key={value}>{humanizeCode(value)}</option>)}</select></label><label>Status<select value={status} onChange={event=>setStatus(event.target.value)}><option value="ALL">All statuses</option>{alertOptions<Alert|AlertAggregate>(items,"status").map(value=><option value={value} key={value}>{humanizeCode(value)}</option>)}</select></label><span role="status">{filtered.length} of {items.length} records</span></div>;
  if(items.length===0)return <><div className="filter-bar"><span role="status">0 records</span></div><div className="empty"><strong>No alerts</strong>No authorized alert currently requires display.</div></>;
  if(filtered.length===0)return <>{filters}<div className="empty"><strong>No alerts match these filters</strong>Change one or more filters to view the authorized alert records.</div></>;
  if(data.scope==="CITY_AGGREGATE")return <>{filters}<div className="table-wrap"><table><thead><tr><th>Institution</th><th>Alert</th><th>Severity</th><th>Status</th><th>Count</th><th>Evaluated</th></tr></thead><tbody>{(filtered as AlertAggregate[]).map((item,index)=><tr key={`${item.institutionDisplayName}-${item.alertType}-${index}`}><td>{item.institutionDisplayName}</td><td>{humanizeCode(item.alertType)}</td><td><span className={statusClassName(item.severity)}>{item.severity}</span></td><td>{humanizeCode(item.status)}</td><td>{item.count}</td><td>{formatManilaDateTime(item.lastEvaluatedAt)}</td></tr>)}</tbody></table></div></>;
  return <>{filters}<div className="table-wrap"><table><thead><tr><th>Alert</th><th>Unit</th><th>Blood/component</th><th>Severity</th><th>Expires</th><th>Acknowledgement</th></tr></thead><tbody>{(filtered as Alert[]).map(item=><tr key={item.alertId}><td>{humanizeCode(item.alertType)}</td><td className="mono">{item.unitId??"Not applicable"}</td><td>{item.bloodType&&item.component?`${humanizeCode(item.bloodType)} / ${humanizeCode(item.component)}`:"Not applicable"}</td><td><span className={statusClassName(item.severity)}>{item.severity}</span></td><td>{formatManilaDateTime(item.expiresAt)}</td><td>{item.acknowledged?"Acknowledged":canAcknowledge&&item.status==="OPEN"?<AcknowledgeAlert alertId={item.alertId} onDone={onRefresh}/>:"Not acknowledged"}</td></tr>)}</tbody></table></div></>;
}
