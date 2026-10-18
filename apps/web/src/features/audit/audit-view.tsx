import { RecordTime } from "../../components/ui/record-time";
import { ActionButton } from "../../components/ui/action-button";
import { PaginatedTable, RecordPagination } from "../../components/ui/record-pagination";
import { ActionIcon } from "../../components/ui/action-icon";
import { RefreshButton } from "../../components/ui/refresh-button";
import { exportTablePdf } from "../../services/pdf/table-report";
import { SortableHeader, TableViewBar, columnsFromExport, timeValue, useTableView } from "../../components/ui/table-view";
import { activityHeaders,activityRows,activityReferences,filterActivity,requesterActivity } from "./activity-export";
import type { Principal } from "../../auth/permissions";
import type { ReactNode } from "react";
import { useState } from "react";
import { InformationHelp } from "../../components/ui/information-help";
import { humanizeCode, statusClassName } from "../../components/ui/display";
import type { Audit } from "../../services/api/types";

const activityColumns=columnsFromExport<Audit["events"][number]>(activityHeaders,item=>activityRows([item])[0],{"Date & Time":{sortValue:item=>timeValue(item.eventTime)}});

export function AuditView({data,ready=true,principal,busy=false,onRefresh,notice}:{data:Audit;ready?:boolean;principal?:Principal;busy?:boolean;onRefresh?:()=>void;notice?:ReactNode}) {
  const [search,setSearch]=useState(""),[action,setAction]=useState("ALL");
  const actions=[...new Set(data.events.map(item=>item.actionCode))];
  const visible=filterActivity(data.events,action,search);
  const view=useTableView("activity-history",activityColumns,visible),show=view.isVisible;
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState("");
  const filters=`Activity type: ${action === "ALL" ? "All activities" : humanizeCode(action)}; Search: ${search.trim() || "None"}; Matching loaded records: ${visible.length}; Sort: ${view.sortDescription}`;
  const source=principal&&requesterActivity(principal)?"Permitted request/transfer command history":"Permitted audit read";
  const scope=(principal?.institutionDisplayName??"Authorized account")+" · "+humanizeCode(data.scope)+" · SIMULATION_ONLY";
  async function exportPdf(){setExporting(true);setExportError("");try{await exportTablePdf({title:"Activity History",scope:scope+" · "+source,filters,headers:activityHeaders,rows:activityRows(view.rows),filename:"activity-history"});}catch(reason){setExportError(reason instanceof Error?reason.message:"PDF export failed.");}finally{setExporting(false);}}
  const table=<table className="data-table audit-table"><thead><tr>{activityHeaders.map(label=><SortableHeader key={label} view={view} id={label}>{label}</SortableHeader>)}</tr></thead><tbody>{view.rows.map(item=>{
    const refs=activityReferences(item);
    return <tr key={item.auditEventId}>{show("Date & Time")&&<td className="data-time"><RecordTime value={item.eventTime}/></td>}{show("Activity")&&<td title={"Record: "+item.auditEventId+" · Correlation: "+item.correlationId}><strong>{humanizeCode(item.actionCode)}</strong><small className="v2-secondary-id">{humanizeCode(item.targetType)}</small></td>}{show("User / Source")&&<td><span className="audit-source-label">Institution source</span>{item.institutionDisplayName}</td>}{show("Scan ID")&&<td className="mono">{refs.scanId??"Not available"}</td>}{show("Request ID")&&<td><span className="evidence-reference mono" title={refs.requestId??undefined}>{refs.requestId??"Not available"}</span></td>}{show("Transfer ID")&&<td className="mono">{refs.transferId??"Not available"}</td>}{show("Blockchain ID")&&<td><span title={item.ledgerTransactionId??undefined} className="evidence-reference mono">{item.ledgerTransactionId??"Not available"}</span></td>}{show("Status")&&<td><span className={statusClassName(item.outcome)}>{humanizeCode(item.outcome)}</span>{item.safeErrorCode&&<small className="safe-error">{humanizeCode(item.safeErrorCode)}</small>}</td>}</tr>;
  })}{!visible.length&&<tr><td colSpan={view.visibleCount}><div className="requester-records-empty"><strong>{!ready?"Activity records will appear here":data.events.length?"No activity matches your filters":"No activity recorded"}</strong><span>{data.events.length?"Try another activity type or search.":"Permitted activity records will appear here."}</span></div></td></tr>}</tbody></table>;
  return <div className="blood-bank-audit">
    {principal && <header className="page-head"><h1 className="page-title">Activity History</h1><div className="bank-toolbar-actions"><ActionButton className="button compact" disabled={!ready||!visible.length||exporting} unavailableReason={exporting?"The PDF is being prepared. Please wait.":!ready?"Activity records must load before you can export.":"There are no loaded activity records matching your filters."} onClick={()=>void exportPdf()}><ActionIcon kind="download"/>{exporting?"Exporting…":"Export PDF"}</ActionButton>{onRefresh&&<RefreshButton busy={busy} onRefresh={onRefresh}/>}</div></header>}
    {notice}{exportError&&<p className="activity-export-error" role="alert">{exportError}</p>}


    <section className="bank-record-card"><header className="bank-section-heading"><h2>Activity records</h2><span>{ready?`${visible.length} of ${data.events.length}`:"—"}</span><InformationHelp label="Activity records">Read the actions and outcomes available within your account’s scope. Search the recorded action or reference, or filter by activity type. User / Source currently identifies the institution source, not an acting person. Scan, request and transfer references appear only when the authorized read explicitly links them; unavailable does not mean no such record exists. Blockchain ID uses the actual ledger reference. Recorded outcomes are not automatically completed custody actions. Exact locations and credentials are excluded. Export PDF includes all matching loaded records, beyond the current page, with account scope and applied filters. Requester activity uses its own permitted transfer command history; command states are not automatically ledger-confirmed outcomes.</InformationHelp></header>
      <div className="bank-filter-panel audit-filter-controls audit-record-filter-controls"><label>Activity type<span className="requester-select"><select aria-label="Activity type" value={action} onChange={event=>setAction(event.target.value)}><option value="ALL">All activities</option>{actions.map(value=><option key={value} value={value}>{humanizeCode(value)}</option>)}</select></span></label><label className="bank-search">Search activity<input type="search" value={search} placeholder="Action, outcome or reference…" onChange={event=>setSearch(event.target.value)}/></label><TableViewBar view={view}/></div>
      {visible.length?<PaginatedTable total={visible.length} label="Activity records" resetKey={action+"|"+search+"|"+view.sortKey}>{table}</PaginatedTable>:<div className="table-wrap">{table}</div>}
      {visible.length===0&&<RecordPagination total={0} ready={ready} label="Activity records"/>}
    </section>
  </div>;
}
