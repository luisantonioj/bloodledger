import { TransferSummaryTable, transferSummaryHeaders, transferSummaryRows, type TransferViewSnapshot } from "./transfer-summary-table";
import { URGENCIES, urgencyRank } from "../../services/api/transaction-reads";
import { bankRequestState, type BankRequestRow, type BankReservationRow } from "./bank-transfer-list";
import { RedistributionReview, redistributionRequestCandidates } from "./redistribution-review";
import { PaginatedTable, RecordPagination } from "../../components/ui/record-pagination";
import { SortableHeader, TableViewBar, useTableView, type TableColumn } from "../../components/ui/table-view";
import { useLiveData } from "../../hooks/use-live-data";
import { humanizeCode, formatBloodType, statusClassName, compactRecordReference } from "../../components/ui/display";
import { InformationHelp } from "../../components/ui/information-help";
import { RefreshButton } from "../../components/ui/refresh-button";
import {canAct} from "../../auth/permissions";
import {V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "../../services/api/v2";
import type { Principal } from "../../auth/permissions";
import { BankRecordDetails } from "./bank-record-details";
import { BankRecordActions } from "./bank-record-actions";
import { PrcSupplyWorkspace, prcSupplyHeaders, prcSupplyRows, maySubmitPrc } from "./prc-supply-workspace";
import { canReadPrcSupply, type PrcSupplyRequest } from "../../services/api/prc-supply";
import { exportTablePdf } from "../../services/pdf/table-report";
import { V2TransferRequest, V2LocalRelease } from "./v2-operations";
import { componentLabel, facilityLabel } from "./requester-transfer-data";
import { useEffect,useRef,useState } from "react";
import { V2RecordExplorer } from "../inventory/v2-record-explorer";
import { selectionFromSearch, type RecordSelection } from "../../services/api/v2-navigation";
import { useRequestPriorities, type RequestPriority } from "../coordination/request-priority";
type RequestSummaryRow = { status: string; transfer_count: number; unit_count: number };
const summaryColumns: TableColumn<RequestSummaryRow>[] = [
  { id: "state", label: "Request state", sortValue: row => humanizeCode(row.status) },
  { id: "requests", label: "Requests", sortValue: row => row.transfer_count },
  { id: "units", label: "Units", sortValue: row => row.unit_count },
];
const requestColumns = (principal: Principal, priorities: Map<string, RequestPriority>, withRps: boolean): TableColumn<BankRequestRow>[] => [
  { id: "request", label: "Request ID", sortValue: row => row.transfer_id },
  { id: "bloodType", label: "Blood Type", sortValue: row => formatBloodType(row.blood_type) },
  { id: "component", label: "Component", sortValue: row => componentLabel(row.component_type) },
  { id: "units", label: "Units", sortValue: row => row.quantity },
  { id: "destination", label: "Destination", sortValue: row => facilityLabel(row.destination_institution_id, principal) },
  { id: "priority", label: "Priority", sortValue: row => urgencyRank(row.urgency) },
  ...(withRps ? [{ id: "rps", label: "RPS rank", sortValue: (row: BankRequestRow) => priorities.get(row.transfer_id)?.rank ?? Number.MAX_SAFE_INTEGER }] : []),
  { id: "status", label: "Status", sortValue: row => humanizeCode(bankRequestState(row)) },
];
export function V2TransferEvidenceView({ principal }: { principal: Principal }) {
  const initial=selectionFromSearch(location.search);
  const [selected,setSelected]=useState<RecordSelection|undefined>(initial);
  const [tab,setTab]=useState<"requests"|"transfers"|"prc">(initial?.kind==="reservation"?"transfers":canReadPrcSupply(principal)&&new URLSearchParams(location.search).get("tab")==="prc"?"prc":"requests");
  const queryParams=new URLSearchParams(location.search);
  const [approvalLocked,setApprovalLocked]=useState(false);
  const reviewContext=(principal.accountCategory==="BLOOD_BANK"&&(queryParams.get("review")==="redistribution"||queryParams.get("tab")==="redistribution")&&V2_BLOOD_TYPES.some(value=>value===queryParams.get("bloodType"))&&V2_COMPONENT_TYPES.some(value=>value===queryParams.get("componentType"))&&Boolean(queryParams.get("destination")));
  const shortcutHandled=useRef(false);
  const destination=queryParams.get("destination")??"",reviewBlood=queryParams.get("bloodType")??"",reviewComponent=queryParams.get("componentType")??"";
  const mayRequest=principal.accountId?canAct(principal,"transfer:request"):principal.roleId==="ROLE-03";
  const [formOpen,setFormOpen]=useState(mayRequest&&!initial&&queryParams.get("newRequest")==="1");
  const [localReleaseOpen,setLocalReleaseOpen]=useState(false);
  const canLocalRelease=principal.accountCategory==="BLOOD_BANK";
  const transferViewRef=useRef<TransferViewSnapshot|null>(null);
  const [transferExporting,setTransferExporting]=useState(false),[transferExportError,setTransferExportError]=useState("");
  const [transferCanExport,setTransferCanExport]=useState(false);
  const prcActionsRef=useRef<{openForm:()=>void;refresh:()=>void}|null>(null);
  const prcViewRef=useRef<{rows:PrcSupplyRequest[];search:string;sortDescription:string}|null>(null);
  const [prcExporting,setPrcExporting]=useState(false),[prcExportError,setPrcExportError]=useState("");
  const [prcCanExport,setPrcCanExport]=useState(false),[prcBusy,setPrcBusy]=useState(false),[prcRequestLocked,setPrcRequestLocked]=useState(false);
  const initialBloodType=V2_BLOOD_TYPES.find(value=>value===queryParams.get("bloodType")),initialComponentType=V2_COMPONENT_TYPES.find(value=>value===queryParams.get("componentType"));
  const [search,setSearch]=useState(""),[status,setStatus]=useState("ALL");
  const state=useLiveData<{requests:BankRequestRow[];reservations:BankReservationRow[];scope?:string;transferSummary?:{status:string;transfer_count:number;unit_count:number}[]}>("/api/v2/transfers");
  const requests=state.data?.requests??[],reservations=state.data?.reservations??[];
  const invalidUrgency=requests.some(row=>row.urgency!==undefined&&!URGENCIES.includes(row.urgency as typeof URGENCIES[number]));
  const query=search.trim().toLowerCase();
  const statuses=[...new Set(tab==="requests"?requests.map(bankRequestState):reservations.map(row=>row.status))];
  const matchingRequests=redistributionRequestCandidates(requests,reservations,principal.institutionId,destination,reviewBlood,reviewComponent);
  useEffect(()=>{if(!reviewContext||shortcutHandled.current||!state.data||approvalLocked||formOpen)return;shortcutHandled.current=true;if(!selected&&matchingRequests.length===1){const row=matchingRequests[0];setSelected({kind:"request",id:row.transfer_id});const params=new URLSearchParams(location.search);params.set("tab","requests");params.set("review","redistribution");params.set("record","request");params.set("recordId",row.transfer_id);history.replaceState(null,"",location.pathname+"?"+params);}},[reviewContext,selected,state.data,approvalLocked,formOpen]);
  const shownRequests=requests.filter(row=>(status==="ALL"||bankRequestState(row)===status)&&[row.transfer_id,row.destination_institution_id,row.blood_type,row.component_type,row.urgency??"",bankRequestState(row),row.reservation_status??"",row.ledger_transaction_id??""].some(value=>value.toLowerCase().includes(query)));
  const summary=useTableView("request-summary",summaryColumns,state.data?.transferSummary??[]),showSummary=summary.isVisible;
  const rpsVisible=tab==="requests"&&principal.accountCategory==="BLOOD_BANK"&&["ROLE-01","ROLE-02"].includes(principal.roleId);
  const priorities=useRequestPriorities(principal,requests,rpsVisible,state.data?1:0);
  const requestView=useTableView("bank-requests",requestColumns(principal,priorities.byId,rpsVisible),shownRequests),showRequest=requestView.isVisible;
  function changeTab(next:"requests"|"transfers"|"prc"){if(approvalLocked)return;setTab(next);setFormOpen(false);setLocalReleaseOpen(false);setSelected(undefined);setSearch("");setStatus("ALL");}
  async function exportTransfersPdf(){const snap=transferViewRef.current;if(!snap)return;setTransferExporting(true);setTransferExportError("");try{await exportTablePdf({title:"Transfers",scope:principal.institutionDisplayName+" · SIMULATION_ONLY",filters:`Loaded rows only; Status: ${snap.status}; Search: ${snap.search||"None"}; Sort: ${snap.sortDescription}`,headers:transferSummaryHeaders,rows:transferSummaryRows(snap.rows),filename:"transfers"});}catch{setTransferExportError("PDF export failed.");}finally{setTransferExporting(false);}}
  async function exportPrcPdf(){const snap=prcViewRef.current;if(!snap)return;setPrcExporting(true);setPrcExportError("");try{await exportTablePdf({title:"PRC Supply Requests",scope:principal.institutionDisplayName+" · SIMULATION_ONLY · Off-chain",filters:`Loaded rows only; Search: ${snap.search||"None"}; Sort: ${snap.sortDescription}`,headers:prcSupplyHeaders,rows:prcSupplyRows(snap.rows),filename:"prc-supply-requests"});}catch{setPrcExportError("PDF export failed.");}finally{setPrcExporting(false);}}

  const recordModal=(tab==="requests"&&selected?.kind==="request")||(tab==="transfers"&&selected?.kind==="reservation");
  const recordDetail=selected&&<V2RecordExplorer inline={!recordModal} className={recordModal?"bank-detail-card bank-record-modal":undefined} navigationLocked={approvalLocked} onActionLockChange={setApprovalLocked} showRecovery={false} key={selected.kind+selected.id} initial={selected} principal={principal} onClose={()=>{if(!approvalLocked)setSelected(undefined);}} onRefresh={state.manual} renderBody={(record,open)=><BankRecordDetails record={record} principal={principal} open={open}/>} renderExtra={(record,open)=><BankRecordActions record={record} principal={principal} reservations={reservations} open={open} approval={record.kind==="request"&&record.value.source_institution_id===principal.institutionId&&(record.value.decision_state==="AWAITING_DECISION"||reviewContext&&record.value.decision_state===undefined)&&!record.value.reservation_id?<RedistributionReview principal={principal} requests={requests} reservations={reservations} requestId={record.value.transfer_id} onRefresh={state.manual} onLockChange={setApprovalLocked} redistribution={Boolean(reviewContext&&record.value.destination_institution_id===destination&&record.value.blood_type===reviewBlood&&record.value.component_type===reviewComponent)}/>:undefined}/>} headerHelp={<InformationHelp label="Record details">Review the current authorized record, linked components and ledger evidence. Pending commands and confirmed inventory or custody states remain separate.</InformationHelp>}/>;

  return <div className="blood-bank-transfers">
    <div className="bank-page-toolbar"><div className="requester-transfer-tabs" role="tablist" aria-label="Request and transfer records"><button role="tab" disabled={approvalLocked} id="bank-requests-tab" aria-controls="bank-records" aria-selected={tab==="requests"} onClick={()=>changeTab("requests")}>Blood Requests <span>{state.data?requests.length:"—"}</span></button><button role="tab" disabled={approvalLocked} id="bank-transfers-tab" aria-controls="bank-records" aria-selected={tab==="transfers"} onClick={()=>changeTab("transfers")}>Transfers</button>{canReadPrcSupply(principal)&&principal.accountCategory==="BLOOD_BANK"&&<button role="tab" disabled={approvalLocked} id="bank-prc-tab" aria-controls="bank-records" aria-selected={tab==="prc"} onClick={()=>changeTab("prc")}>PRC Supply Requests <span>—</span></button>}</div><div className="bank-toolbar-actions">{tab!=="prc"&&mayRequest&&<button className="button primary compact" disabled={approvalLocked} aria-haspopup="dialog" onClick={()=>setFormOpen(true)}>+ New Blood Request</button>}{tab!=="prc"&&canLocalRelease&&<button className="button compact" disabled={approvalLocked} aria-haspopup="dialog" onClick={()=>setLocalReleaseOpen(true)}>+ Local Release</button>}{tab!=="prc"&&<RefreshButton busy={state.busy} onRefresh={state.manual}/>}{tab==="prc"&&maySubmitPrc(principal)&&<button className="button primary compact" disabled={prcRequestLocked} aria-haspopup="dialog" onClick={()=>prcActionsRef.current?.openForm()}>+ Request PRC Supply</button>}{tab==="prc"&&<RefreshButton busy={prcBusy} onRefresh={()=>prcActionsRef.current?.refresh()}/>}</div></div>
    {tab!=="prc"&&state.error&&<div className="requester-transfer-notice" role="status"><span className="requester-notice-icon" aria-hidden="true">!</span><div className="requester-notice-copy"><strong>Records could not refresh</strong><p>{state.error}</p>{state.data&&<p>Showing the last successfully loaded records.</p>}</div><button className="button compact dashboard-refresh" onClick={state.manual}>Retry records</button></div>}
    <div className={"bank-record-layout"+(tab==="requests"?" bank-request-layout":"")+(tab==="prc"?" prc-record-layout":"")+(tab==="transfers"||tab==="prc"?" bank-record-layout-wide":"")+(tab==="prc"||!selected?" no-record-selection":"")}>
      <section className="bank-record-card" role="tabpanel" id="bank-records" aria-labelledby={tab==="requests"?"bank-requests-tab":tab==="prc"?"bank-prc-tab":"bank-transfers-tab"}>
        <header className="bank-section-heading"><h2>{tab==="requests"?"Blood Requests":tab==="prc"?"PRC Supply Requests":"Transfers"}</h2>{(tab==="transfers"||tab==="prc")&&<button className="button compact" disabled={tab==="transfers"?!transferCanExport||transferExporting:!prcCanExport||prcExporting} onClick={tab==="transfers"?()=>void exportTransfersPdf():()=>void exportPrcPdf()}>{tab==="transfers"&&transferExporting||tab==="prc"&&prcExporting?"Exporting…":"Export PDF"}</button>}<InformationHelp label={tab==="requests"?"Blood Requests":tab==="prc"?"PRC Supply Requests":"Transfers"}>{tab==="prc"?"Request replenishment through the PRC coordination channel. This is off-chain coordination. Supplied units enter only through normal OCR intake.":tab==="requests"?"Review recorded requests available to your facility. Select a request to inspect its product, destination and state. A request without a ledger reference is awaiting confirmation; it is not an approval.":"Review recorded transfers and local releases. Transfer ID identifies the reservation; its linked request is labeled Request ID. Selection opens the exact reservation. Requested and allocated quantities are shown separately; neither is proof of dispatch or receipt. Missing product or facility information is unavailable until the read contract supplies it."}</InformationHelp></header>
        {tab==="transfers"&&transferExportError&&<p role="alert">{transferExportError}</p>}
        {tab==="prc"&&prcExportError&&<p role="alert">{prcExportError}</p>}
        {tab==="requests"&&<div className="bank-list-filters"><label className="bank-search">Search {tab==="requests"?"requests":"transfers"}<input type="search" placeholder="Reference or status…" value={search} onChange={event=>setSearch(event.target.value)}/></label><label>Status<span className="requester-select"><select value={status} onChange={event=>setStatus(event.target.value)}><option value="ALL">All statuses</option>{statuses.map(value=><option key={value} value={value}>{humanizeCode(value)}</option>)}</select></span></label><TableViewBar view={requestView}/></div>}
        {tab==="prc"?<PrcSupplyWorkspace principal={principal} embedded viewRef={prcViewRef} actionsRef={prcActionsRef} onCanExport={setPrcCanExport} onBusy={setPrcBusy} onRequestLocked={setPrcRequestLocked}/>:tab==="transfers"?<TransferSummaryTable principal={principal} selectedId={selected?.kind==="reservation"?selected.id:undefined} open={id=>setSelected({kind:"reservation",id})} viewRef={transferViewRef} onCanExport={setTransferCanExport}/>:invalidUrgency?<p role="alert">Request priority data is unavailable.</p>:!state.data?<div className="requester-records-empty"><strong>{state.error?"Records unavailable":"Loading records…"}</strong><span>{state.error?"Use Refresh to try again.":"Waiting for your facility’s recorded information."}</span></div>:tab==="requests"?<>
          {state.data.scope==="CITY_AGGREGATE"&&<PaginatedTable total={state.data.transferSummary?.length??0} label="Request summary" resetKey={tab+"|"+summary.sortKey} toolbar={<TableViewBar view={summary}/>}><table className="data-table"><thead><tr><SortableHeader view={summary} id="state">Request state</SortableHeader><SortableHeader view={summary} id="requests">Requests</SortableHeader><SortableHeader view={summary} id="units">Units</SortableHeader></tr></thead><tbody>{summary.rows.map(row=><tr key={row.status}>{showSummary("state")&&<td>{humanizeCode(row.status)}</td>}{showSummary("requests")&&<td>{row.transfer_count}</td>}{showSummary("units")&&<td>{row.unit_count}</td>}</tr>)}</tbody></table></PaginatedTable>}
          {shownRequests.length?<PaginatedTable total={shownRequests.length} label="Blood requests" resetKey={tab+"|"+status+"|"+search+"|"+requestView.sortKey}><table className="data-table bank-blood-requests-table"><thead><tr><SortableHeader view={requestView} id="request">Request ID</SortableHeader><SortableHeader view={requestView} id="bloodType">Blood Type</SortableHeader><SortableHeader view={requestView} id="component">Component</SortableHeader><SortableHeader view={requestView} id="units">Units</SortableHeader><SortableHeader view={requestView} id="destination">Destination</SortableHeader><SortableHeader view={requestView} id="priority">Priority</SortableHeader>{rpsVisible&&<SortableHeader view={requestView} id="rps">RPS rank</SortableHeader>}<SortableHeader view={requestView} id="status">Status</SortableHeader></tr></thead><tbody>{requestView.rows.map(row=><tr key={row.transfer_id} onClick={event=>{if(approvalLocked)return;event.currentTarget.querySelector("button")?.focus({preventScroll:true});setSelected({kind:"request",id:row.transfer_id});}} className={selected?.id===row.transfer_id?"selected":""}>{showRequest("request")&&<td><button className="requester-record-link mono" disabled={approvalLocked} aria-label={"Open request "+row.transfer_id} title={row.transfer_id} aria-haspopup="dialog">{compactRecordReference(row.transfer_id)}</button></td>}{showRequest("bloodType")&&<td><span className="bank-request-blood-type">{formatBloodType(row.blood_type)}</span></td>}{showRequest("component")&&<td>{componentLabel(row.component_type)}</td>}{showRequest("units")&&<td>{row.quantity}</td>}{showRequest("destination")&&<td>{facilityLabel(row.destination_institution_id,principal)}</td>}{showRequest("priority")&&<td>{row.urgency ? humanizeCode(row.urgency) : "Not available"}</td>}{rpsVisible&&showRequest("rps")&&<td className="bank-request-rps">{(()=>{const rps=priorities.byId.get(row.transfer_id);return rps?<span title={"RPS score "+rps.score.toFixed(4)+" = urgency "+rps.urgencyContribution.toFixed(4)+" + wait "+rps.waitContribution.toFixed(4)+" ("+rps.waitHours.toFixed(1)+" h). Advisory ranking only; approval stays with the supplier. Policy "+rps.policyVersion} aria-label={"RPS rank "+rps.rank+" of "+rps.groupSize+", score "+rps.score.toFixed(4)}>#{rps.rank} of {rps.groupSize} · {rps.score.toFixed(3)}</span>:<span className="muted">{priorities.error?"Unavailable":"—"}</span>;})()}</td>}{showRequest("status")&&<td className="bank-request-status"><span className={statusClassName(bankRequestState(row))}>{humanizeCode(bankRequestState(row))}</span></td>}</tr>)}</tbody></table></PaginatedTable>:<div className="requester-records-empty"><strong>{requests.length?"No requests match your filters":"No blood requests recorded"}</strong><span>{requests.length?"Try another status or search.":"Requests available to your facility will appear here."}</span></div>}
        </>:null}
        {tab==="requests"&&(!state.data||shownRequests.length===0)&&<RecordPagination total={0} ready={Boolean(state.data)} label="Blood requests"/>}
      </section>
      {tab!=="prc"&&!recordModal&&selected&&<aside className="bank-detail-card">{recordDetail}</aside>}
    </div>
    {recordModal&&recordDetail}
    {tab!=="prc"&&formOpen&&mayRequest&&<V2TransferRequest principal={principal} onRefresh={state.manual} requesterPresentation={Boolean(principal.accountId)&&principal.accountCategory==="BLOOD_BANK"} modal onCancel={()=>setFormOpen(false)} initialBloodType={initialBloodType} initialComponentType={initialComponentType}/>}
    {tab!=="prc"&&localReleaseOpen&&canLocalRelease&&<V2LocalRelease principal={principal} onRefresh={state.manual} modal onCancel={()=>setLocalReleaseOpen(false)}/>}
  </div>;
}
