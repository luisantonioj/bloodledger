import {RecordTime} from "../../components/ui/record-time";
import {ActionButton} from "../../components/ui/action-button";
import {PaginatedTable} from "../../components/ui/record-pagination";
import {SortableHeader,TableViewBar,columnsFromExport,timeValue,useTableView} from "../../components/ui/table-view";
import {HistoryEventStatus} from "../../components/ui/history-event-status";
import {SCAN_ON_PHONE_NOTE} from "../../app/phone-scanner-mode";
import {useEffect,useState} from "react";
import {type Principal} from "../../auth/permissions";
import {ActionIcon} from "../../components/ui/action-icon";
import {InformationHelp} from "../../components/ui/information-help";
import {RefreshButton} from "../../components/ui/refresh-button";
import {humanizeCode,compactRecordReference} from "../../components/ui/display";
import {usePagedRead} from "../../hooks/use-paged-read";
import {parseUnitHistory} from "../../services/api/transaction-reads";
import {exportTablePdf} from "../../services/pdf/table-report";
import {unitHistoryHeaders,unitHistoryRows,unitHistoryMatches,unitIdentity,unitBlood} from "./unit-history-display";
import {V2RecordExplorer} from "../inventory/v2-record-explorer";
import {formatBloodType} from "../../components/ui/display";
import {componentLabel} from "../transfers/requester-transfer-data";
import type {RecordSelection} from "../../services/api/v2-navigation";
import type {UnitHistoryRow} from "../../services/api/transaction-reads";

const transactionColumns=columnsFromExport<UnitHistoryRow>(unitHistoryHeaders,row=>unitHistoryRows([row])[0],{Time:{sortValue:row=>timeValue(row.eventTime)}});
export function BloodUnitTransactionsPage({principal}:{principal:Principal}){
 const history=usePagedRead("/api/v2/unit-history",parseUnitHistory,"rowId",principal.institutionId);
 // Follow server cursors sequentially; stop on an error until an explicit refresh.
 useEffect(()=>{if(history.ready&&!history.busy&&!history.error&&history.nextCursor)history.loadMore();},[history.readKey,history.ready,history.busy,history.error,history.nextCursor,history.loadMore]);
 const [selected,setSelected]=useState<RecordSelection>();
 const [filter,setFilter]=useState("ALL"),[search,setSearch]=useState(""),[exporting,setExporting]=useState(false),[message,setMessage]=useState("");
 const visible=history.rows.filter(row=>(filter==="ALL"||row.direction===filter)&&unitHistoryMatches(row,search.trim().toLowerCase()));
 const view=useTableView("bank-transactions",transactionColumns,visible),show=view.isVisible;
 const busy=history.busy,refresh=history.refresh;
 async function exportPdf(){setExporting(true);setMessage("");try{await exportTablePdf({title:"Blood Unit Transactions",scope:principal.institutionDisplayName+" · SIMULATION_ONLY",filters:`Loaded rows only; Direction: ${filter}; Search: ${search||"None"}; Sort: ${view.sortDescription}`,headers:unitHistoryHeaders,rows:unitHistoryRows(view.rows),filename:"blood-unit-transactions"});}catch{setMessage("PDF export failed.");}finally{setExporting(false);}}
 return <div className="page blood-unit-transactions-page"><header className="page-head"><h1 className="page-title">Blood Unit Transactions</h1><div className="bank-toolbar-actions"><ActionButton className="button compact" disabled={!visible.length||exporting} unavailableReason={exporting?"The PDF is being prepared.":"Load matching transactions before exporting."} onClick={()=>void exportPdf()}><ActionIcon kind="download"/>{exporting?"Exporting…":"Export PDF"}</ActionButton><a className="button compact" href="/inventory">View Inventory</a><RefreshButton busy={busy} onRefresh={refresh}/></div></header>
 <section className="receipt-launch-card"><div className="receipt-launch-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></svg></div><div className="receipt-launch-copy"><span className="receipt-eyebrow">Mobile workflow</span><h2>Scan blood units on the phone</h2></div><p className="receipt-preview-note scan-on-phone-note" role="note">{SCAN_ON_PHONE_NOTE}</p></section> {message&&<p role="status">{message}</p>}
 <section className="bank-record-card receipt-history-card"><header className="bank-section-heading"><h2>Recent Blood Unit Transactions</h2><InformationHelp label="Recent Blood Unit Transactions">Recorded custody events, one row per unit. Only CONFIRMED indicates completed movement. Records load automatically. Search and PDF cover the records fetched so far while loading continues. Unit labels are never used as technical record keys.</InformationHelp></header><div className="bank-list-filters"><label className="bank-search">Search transactions<input type="search" value={search} placeholder="Search loaded labels, blood, references or status…" onChange={event=>setSearch(event.target.value)}/></label><label>Direction<span className="requester-select"><select aria-label="Direction" value={filter} onChange={event=>setFilter(event.target.value)}><option value="ALL">All directions</option><option value="INBOUND">Inbound</option><option value="OUTBOUND">Outbound</option></select></span></label><TableViewBar view={view}/></div>
 <PaginatedTable ready={history.ready} total={visible.length} label="Blood unit transactions" resetKey={filter+"|"+search+"|"+view.sortKey}><table className="data-table transaction-history-table"><thead><tr>{unitHistoryHeaders.map(header=><SortableHeader key={header} view={view} id={header}>{header}</SortableHeader>)}</tr></thead><tbody>{view.rows.map(row=><tr key={row.rowId}>{show("Time")&&<td><RecordTime value={row.eventTime}/></td>}{show("Type")&&<td><span className={"transaction-direction direction-"+row.direction.toLowerCase()}>{humanizeCode(row.direction)}</span></td>}{show("Scan ID")&&<td className="mono" title={row.scanId??undefined}>{row.scanId?compactRecordReference(row.scanId):"—"}</td>}{show("Transaction ID")&&<td className="mono" title={row.transactionId}>{compactRecordReference(row.transactionId)}</td>}{show("Unit ID")&&<td>{row.componentId?<button className={"requester-record-link "+(row.labelIdentity.status==="AVAILABLE"?"mono":"label-unavailable")} aria-label={"Open component "+row.componentId} onClick={()=>setSelected({kind:"component",id:row.componentId!})}>{unitIdentity(row)}</button>:<span className="label-unavailable">{unitIdentity(row)}</span>}</td>}{show("Blood")&&<td className="transaction-product" title={unitBlood(row)}>{row.bloodType?<strong>{formatBloodType(row.bloodType)}</strong>:<span>Not available</span>}{row.componentType&&<small>{componentLabel(row.componentType)}</small>}</td>}{show("Method")&&<td className="transaction-method">{row.method==="WEB_COMMAND"?"Web command":row.method??"Not recorded"}</td>}{show("Status")&&<td><HistoryEventStatus status={row.eventStatus} processingStatus={row.processingStatus} safeErrorCode={row.safeErrorCode}/>{row.safeErrorCode&&<small className="transaction-safe-code" title={row.safeErrorCode}>{humanizeCode(row.safeErrorCode)}</small>}</td>}{show("Blockchain ID")&&<td className="mono" title={row.ledger.transactionId??undefined}>{row.ledger.transactionId?compactRecordReference(row.ledger.transactionId):"Not committed"}</td>}</tr>)}{!visible.length&&<tr><td colSpan={view.visibleCount}><div className="requester-records-empty"><strong>{!history.ready?history.busy?"Loading transaction records…":"Transaction history unavailable":history.rows.length?"No transactions match your filters":"No blood-unit transactions recorded"}</strong></div></td></tr>}</tbody></table></PaginatedTable>
 {history.error&&<p role="alert">{history.error}</p>}</section>
 {selected&&<V2RecordExplorer initial={selected} principal={principal} onClose={()=>setSelected(undefined)} onRefresh={refresh}/>}</div>;
}
