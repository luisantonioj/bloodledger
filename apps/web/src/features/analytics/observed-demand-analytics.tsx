import { BankObservedDemand } from "./bank-observed-demand";
import { ActionButton } from "../../components/ui/action-button";
import { RefreshIcon } from "../../components/ui/refresh-button";
import { useState } from "react";
import type { Principal } from "../../auth/permissions";
import { InformationHelp } from "../../components/ui/information-help";
import { RefreshButton } from "../../components/ui/refresh-button";
import { useLiveData } from "../../hooks/use-live-data";
import { V2_BLOOD_TYPES,V2_COMPONENT_TYPES } from "../../services/api/v2";
import type { RequestRow } from "../transfers/requester-transfer-data";
import { canViewAnalyticsPage } from "./analytics-access";
import { ReportingFilters,emptyAnalyticsFilters,type AnalyticsFilters } from "./analytics-reporting-filters";
export const analyticsManilaDay=(value:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
// FR-05/12: bank demand is requests supplied by that bank; requester demand is its own requests.
export function observedRequests(value:unknown,principal:Principal):RequestRow[] {
  const body=value as {classification?:string;scope?:string;requests?:RequestRow[]}|null;
  if(!body||body.classification!=="SIMULATION_ONLY"||body.scope!=="INSTITUTION"||!Array.isArray(body.requests))throw Error("Request history is unavailable for this scope.");
  const requester=principal.accountCategory==="REQUESTOR"||principal.roleId==="ROLE-03";
  const selected=body.requests.filter(row=>row&&(requester?row.destination_institution_id===principal.institutionId:row.source_institution_id===principal.institutionId));
  const ids=new Set<string>();
  for(const row of selected){
    if(typeof row.transfer_id!=="string"||!row.transfer_id||ids.has(row.transfer_id)||typeof row.source_institution_id!=="string"||!row.source_institution_id||typeof row.destination_institution_id!=="string"||!row.destination_institution_id||!V2_BLOOD_TYPES.includes(row.blood_type as typeof V2_BLOOD_TYPES[number])||!V2_COMPONENT_TYPES.includes(row.component_type as typeof V2_COMPONENT_TYPES[number])||!Number.isSafeInteger(row.quantity)||row.quantity<1||typeof row.status!=="string"||!row.status||(row.ledger_transaction_id!==null&&typeof row.ledger_transaction_id!=="string"))throw Error("Request history is incomplete. Refresh to try again.");
    ids.add(row.transfer_id);
  }
  return selected.map(row=>({...row,request_time:row.request_time&&Number.isFinite(Date.parse(row.request_time))?row.request_time:null}));
}
export function filterObservedRequests(rows:RequestRow[],filters:AnalyticsFilters){
  if(filters.from&&filters.to&&filters.from>filters.to)return [];
  return rows.filter(row=>(!filters.bloodType||row.blood_type===filters.bloodType)&&(!filters.component||row.component_type===filters.component)&&(!filters.from&&!filters.to||row.request_time&&(!filters.from||analyticsManilaDay(row.request_time)>=filters.from)&&(!filters.to||analyticsManilaDay(row.request_time)<=filters.to)));
}
export function monthlyObservedRequests(rows:RequestRow[]){
  const months=new Map<string,{month:string;requests:number;units:number}>();
  for(const row of rows){if(!row.request_time)continue;const month=analyticsManilaDay(row.request_time).slice(0,7);const group=months.get(month)??{month,requests:0,units:0};group.requests++;group.units+=row.quantity;months.set(month,group);}
  return [...months.values()].sort((a,b)=>a.month.localeCompare(b.month));
}
export function ObservedDemandAnalytics({principal}:{principal:Principal}){
  if(!canViewAnalyticsPage(principal))return <div className="analytics-empty"><strong>Analytics unavailable for this account</strong></div>;
  if(principal.accountCategory === "BLOOD_BANK")return <BankObservedDemand/>;
  return <ObservedDemandContent principal={principal}/>;
}
function ObservedDemandContent({principal}:{principal:Principal}){
  const prc=principal.accountCategory==="PRC",requester=principal.accountCategory==="REQUESTOR"||principal.roleId==="ROLE-03";
  const state=useLiveData<unknown>(prc?null:"/api/v2/transfers");
  const [filters,setFilters]=useState<AnalyticsFilters>(emptyAnalyticsFilters);
  const [metric,setMetric]=useState<"units"|"requests">("units");
  let rows:RequestRow[]=[],ready=false,error=state.error;
  if(state.data){try{rows=observedRequests(state.data,principal);ready=true;}catch(reason){error=reason instanceof Error?reason.message:"Request history unavailable.";}}
  const shown=filterObservedRequests(rows,filters),months=monthlyObservedRequests(shown),dated=shown.filter(row=>row.request_time),received=shown.filter(row=>row.status==="RECEIVED"&&row.ledger_transaction_id!==null);
  const peak=[...months].sort((a,b)=>b.units-a.units)[0];const max=Math.max(1,...months.map(row=>row[metric]));
  const cards:[string,string|number|null,string][]=[
    ["Recorded Requests",ready?shown.length:null,requester?"Your facility’s returned requests that match these filters, across all statuses. This is recorded request activity, not a forecast or count of transfusions.":"Returned supply requests naming your blood bank as source, across all statuses. Your bank’s own procurement requests are excluded. This is not a complete departmental or clinical demand census."],
    ["Units Requested",ready?shown.reduce((total,row)=>total+row.quantity,0):null,"Requested quantities across matching records. Requested units do not establish units dispatched, received or transfused."],
    ["Highest Recorded Month",ready&&peak?peak.month:null,"Month with the most requested units among dated returned records. History coverage is not supplied, so this is not proof of the highest month across a full year."],
    [requester?"Requests Fulfilled":"Months with Records",ready?(requester?received.length:dated.length?months.length:null):null,requester?"Matching requests recorded as received with a confirmation reference. Quantities requested may differ from actual received units.":"Distinct months containing dated matching records. Unrepresented months remain unknown, not zero demand."],
  ];
  return <div className="observed-demand-workspace">
    <header className="page-head analytics-page-head"><h1 className="page-title">Analytics</h1>{prc?<ActionButton className="button compact dashboard-refresh" disabled unavailableReason="Network demand history is not connected yet, so there is no analytics data source to refresh."><RefreshIcon/>Refresh</ActionButton>:<RefreshButton busy={state.busy} onRefresh={state.manual}/>}</header>
    <p className="analytics-page-description">{prc ? "Network request history is separate from the current stock summary. Unavailable sections need a connected data source." : requester ? "Your facility’s recorded blood requests. Requested quantities are separate from units actually received." : "Recorded requests supplied by your facility. These totals describe request activity, not forecast demand."}</p>
    <ReportingFilters filters={filters} onChange={setFilters} groupLabel={prc?"Requesting hospital":"Requesting department"}/>
    <div className="consortium-summary-grid">{cards.map(([label,value,help])=><section className="consortium-summary" key={label}><header className="consortium-summary-title"><span>{label}</span><InformationHelp label={label}>{prc?"Dated network request aggregates are not available in the current authorized read. This value stays unavailable until that source is connected.":help}</InformationHelp></header><strong className="observed-summary-value">{value??"—"}</strong></section>)}</div>
    <div className="regulator-insight-grid">
      <section className="bank-record-card"><header className="bank-section-heading"><h2>{prc?"Which hospitals request blood most often?":"Which departments request blood most often?"}</h2><InformationHelp label={prc?"Hospital demand":"Department demand"}>Compare request frequency and total units separately. Rankings require recorded requesting {prc?"facilities in an authorized network history":"departments"}. Facility identity is not a department, and missing categories cannot be inferred.</InformationHelp></header><div className="analytics-empty"><strong>{prc?"Hospital demand history unavailable":"Department information unavailable"}</strong><p>{prc?"Dated network request aggregates are needed to rank requesting hospitals.":"Current request records do not identify the requesting department."}</p></div></section>
      <section className="bank-record-card"><header className="bank-section-heading"><h2>Which months have the greatest blood demand?</h2><InformationHelp label="Monthly demand">Compare recorded requests by their request date in Manila time. Toggle requested units or request count. This summarizes returned records, not forecast estimates. Missing months and incomplete history are not filled with zeros. Requests without dates are excluded from monthly totals.</InformationHelp></header>
        <div className="observed-metric-controls">{(["units","requests"] as const).map(value=><button key={value} className={"button compact"+(metric===value?" primary":"")} aria-pressed={metric===value} onClick={()=>setMetric(value)}>{value==="units"?"Units requested":"Request count"}</button>)}</div>
        {months.length&&ready?<div className="observed-month-chart">{months.map(row=><div className="observed-month-row" key={row.month}><span>{row.month}</span><div className="observed-month-track"><span style={{width:row[metric]/max*100+"%"}}/></div><strong>{row[metric]}</strong></div>)}<p>Returned records only · {dated.length} dated requests{shown.length>dated.length?" · "+(shown.length-dated.length)+" undated requests excluded":""}</p></div>:<div className="analytics-empty"><strong>{error?"Request history unavailable":prc?"Network demand history unavailable":state.busy&&!ready?"Loading request history…":ready&&shown.length?"Request dates unavailable":"No dated requests in this view"}</strong><p>{error||(prc?"Dated network requests are not provided by the current stock summary.":ready&&shown.length?shown.length+" matching request records have no usable request date. They cannot be assigned to a month.":"Monthly demand will appear when matching dated request records are available. Missing history is not zero demand.")}</p></div>}
      </section>
    </div>
    {requester?<section className="bank-record-card"><header className="bank-section-heading"><h2>Receipt History</h2><InformationHelp label="Receipt History">Compare confirmed inbound receipts over time when dated receipt quantities become available. Request submission dates and requested quantities are not receipt dates or measured receipt volumes.</InformationHelp></header><div className="analytics-empty"><strong>Receipt trends unavailable</strong><p>Dated confirmed receipt quantities are not available in this analytics read yet.</p></div></section>:<section className="bank-record-card"><header className="bank-section-heading"><h2>Redistribution Assessment</h2><InformationHelp label="Redistribution Assessment">Review backend-supplied eligible stock, expected demand, safety allowance, minimum reserve and assessed surplus. The frontend does not calculate clinical stock thresholds or surplus. Missing or stale evidence cannot authorize redistribution; an authorized person must review any future assessment.</InformationHelp></header><div className="table-wrap"><table className="data-table observed-assessment-table"><thead><tr>{[...(prc?["Facility"]:[]),"Blood type","Component","Eligible stock","Expected demand","Safety allowance","Minimum reserve","Estimated surplus","Assessment"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody><tr><td colSpan={prc?9:8}><div className="analytics-empty"><strong>Assessment unavailable</strong><p>Approved redistribution rules and backend assessment values are not available yet.</p></div></td></tr></tbody></table></div></section>}
    {error&&ready&&<p className="regulator-analytics-note" role="status">Refresh unavailable. Showing the last loaded request records.</p>}
  </div>;
}
