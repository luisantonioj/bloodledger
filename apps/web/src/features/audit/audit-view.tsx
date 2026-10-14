import { ActionButton } from "../../components/ui/action-button";
import { PaginatedTable, RecordPagination } from "../../components/ui/record-pagination";
import { ActionIcon } from "../../components/ui/action-icon";
import { RefreshButton } from "../../components/ui/refresh-button";
import { exportTablePdf } from "../../services/pdf/table-report";
import { activityHeaders,activityRows,filterActivity,requesterActivity } from "./activity-export";
import type { Principal } from "../../auth/permissions";
import type { ReactNode } from "react";
import { useState } from "react";
import { InformationHelp } from "../../components/ui/information-help";
import { formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import type { Audit } from "../../services/api/types";

export function AuditView({data,ready=true,principal,busy=false,onRefresh,notice}:{data:Audit;ready?:boolean;principal?:Principal;busy?:boolean;onRefresh?:()=>void;notice?:ReactNode}) {
  const [search,setSearch]=useState(""),[action,setAction]=useState("ALL");
  const actions=[...new Set(data.events.map(item=>item.actionCode))];
  const visible=filterActivity(data.events,action,search);
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState("");
  const filters=`Activity type: ${action === "ALL" ? "All activities" : humanizeCode(action)}; Search: ${search.trim() || "None"}; Matching loaded records: ${visible.length}`;
  const source=principal&&requesterActivity(principal)?"Permitted request/transfer command history":"Permitted audit read";
  const scope=(principal?.institutionDisplayName??"Authorized account")+" · "+humanizeCode(data.scope)+" · SIMULATION_ONLY";
  async function exportPdf(){setExporting(true);setExportError("");try{await exportTablePdf({title:"Activity History",scope:scope+" · "+source,filters,headers:activityHeaders,rows:activityRows(visible),filename:"activity-history"});}catch(reason){setExportError(reason instanceof Error?reason.message:"PDF export failed.");}finally{setExporting(false);}}
  const failures=data.events.filter(item=>["FAILED","REJECTED","ERROR"].includes(item.outcome)).length,ledgerLinked=data.events.filter(item=>item.ledgerTransactionId).length,institutions=new Set(data.events.map(item=>item.institutionDisplayName)).size;
  return <div className="blood-bank-audit">
    {principal && <header className="page-head"><h1 className="page-title">Activity History</h1><div className="bank-toolbar-actions"><ActionButton className="button compact" disabled={!ready||!visible.length||exporting} unavailableReason={exporting?"The PDF is being prepared. Please wait.":!ready?"Activity records must load before you can export.":"There are no loaded activity records matching your filters."} onClick={()=>void exportPdf()}><ActionIcon kind="download"/>{exporting?"Exporting…":"Export PDF"}</ActionButton>{onRefresh&&<RefreshButton busy={busy} onRefresh={onRefresh}/>}</div></header>}
    {notice}{exportError&&<p className="activity-export-error" role="alert">{exportError}</p>}

    <div className="stats audit-summary"><article><span>Permitted events</span><strong>{ready?data.events.length:"—"}</strong></article><article><span>Institutions shown</span><strong>{ready?institutions:"—"}</strong></article><article className={failures?"accent-critical":""}><span>Failed outcomes</span><strong>{ready?failures:"—"}</strong></article><article><span>Ledger-linked</span><strong>{ready?ledgerLinked:"—"}</strong></article></div>
    <section className="bank-record-card"><header className="bank-section-heading"><h2>Activity records</h2><span>{ready?`${visible.length} of ${data.events.length}`:"—"}</span><InformationHelp label="Activity records">Read the actions and outcomes available within your account’s scope. Search the recorded action or reference, or filter by activity type. Staff names, exact locations and credentials are excluded. A correlation reference tracks an application action; a ledger reference appears only when available. Export PDF includes all matching loaded records, beyond the current page, with account scope and applied filters. Requester activity uses its own permitted transfer command history; command states are not automatically ledger-confirmed outcomes.</InformationHelp></header>
      <div className="bank-filter-panel audit-filter-controls"><label>Activity type<span className="requester-select"><select aria-label="Activity type" value={action} onChange={event=>setAction(event.target.value)}><option value="ALL">All activities</option>{actions.map(value=><option key={value} value={value}>{humanizeCode(value)}</option>)}</select></span></label><label className="bank-search">Search activity<input type="search" value={search} placeholder="Action, outcome or reference…" onChange={event=>setSearch(event.target.value)}/></label></div>
      {visible.length?<PaginatedTable total={visible.length} label="Activity records" resetKey={action+"|"+search}><table className="data-table audit-table"><thead><tr><th>Date &amp; time</th><th>Activity</th><th>Institution</th><th>Outcome</th><th>Correlation</th><th>Ledger reference</th></tr></thead><tbody>{visible.map(item=><tr key={item.auditEventId}><td className="data-time">{formatManilaDateTime(item.eventTime)}</td><td><strong>{humanizeCode(item.actionCode)}</strong><small className="v2-secondary-id">{humanizeCode(item.targetType)}</small>{"targetReference" in item&&<small className="evidence-reference mono">{String(item.targetReference)}</small>}</td><td>{item.institutionDisplayName}</td><td><span className={statusClassName(item.outcome)}>{humanizeCode(item.outcome)}</span>{item.safeErrorCode&&<small className="safe-error">{humanizeCode(item.safeErrorCode)}</small>}</td><td><span title={item.correlationId} className="evidence-reference mono">{item.correlationId}</span></td><td><span title={item.ledgerTransactionId??undefined} className="evidence-reference mono">{item.ledgerTransactionId??"Not applicable"}</span></td></tr>)}</tbody></table></PaginatedTable>:<div className="requester-records-empty"><strong>{!ready?"Activity records will appear here":data.events.length?"No activity matches your filters":"No activity recorded"}</strong><span>{data.events.length?"Try another activity type or search.":"Permitted activity records will appear here."}</span></div>}
      {visible.length===0&&<RecordPagination total={0} ready={ready} label="Activity records"/>}
    </section>
  </div>;
}
