import { compactRecordReference } from "../../components/ui/display";
import { PaginatedTable, RecordPagination } from "../../components/ui/record-pagination";
import { SortableHeader, TableViewBar, timeValue, useTableView, type TableColumn } from "../../components/ui/table-view";
import { urgencyRank } from "../../services/api/transaction-reads";
import { RefreshButton, RefreshIcon } from "../../components/ui/refresh-button";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "../../services/api/v2";
import { RequestFormHelp } from "./request-form-help";
import { useEffect, useRef, useState } from "react";
import { can, canAct, type Principal } from "../../auth/permissions";
import { BloodTypeBadge } from "../../components/ui/aggregate-tables";
import { formatBloodType, formatManilaDateTime, statusClassName } from "../../components/ui/display";
import { useLiveData } from "../../hooks/use-live-data";
import { selectionFromSearch, type RecordSelection } from "../../services/api/v2-navigation";
import { V2RecordExplorer } from "../inventory/v2-record-explorer";
import { V2TransferRequest } from "./v2-operations";
import { componentLabel, facilityLabel, parseRequesterRecords, readableCode, type RequesterRecords } from "./requester-transfer-data";

const stages = [["Submit Request", "Provide requirements"], ["Await Approval", "Monitor the decision"], ["Track Request", "Follow transfer status"], ["Receive Blood", "Confirm inbound receipt"]];

type RequestRow = RequesterRecords["requests"][number];
type TransferRow = RequesterRecords["transfers"][number];
type TimelineRow = RequesterRecords["timeline"][number];
const requestColumns: TableColumn<RequestRow>[] = [
  { id: "request", label: "Request ID", sortValue: row => row.transfer_id },
  { id: "bloodType", label: "Blood Type", sortValue: row => formatBloodType(row.blood_type) + " " + componentLabel(row.component_type) },
  { id: "units", label: "Units", sortValue: row => row.quantity },
  { id: "priority", label: "Priority", sortValue: row => urgencyRank(row.urgency) },
  { id: "facility", label: "Requesting Facility" },
  { id: "status", label: "Status", sortValue: row => readableCode(row.status) },
];
const transferColumns = (principal: Principal): TableColumn<TransferRow>[] => [
  { id: "transfer", label: "Transfer ID", sortValue: row => row.reservation_id },
  { id: "bloodType", label: "Blood Type", sortValue: row => formatBloodType(row.request.blood_type) + " " + componentLabel(row.request.component_type) },
  { id: "units", label: "Units", sortValue: row => row.request.quantity },
  { id: "from", label: "From", sortValue: row => facilityLabel(row.request.source_institution_id, principal) },
  { id: "to", label: "To" },
  { id: "status", label: "Status", sortValue: row => readableCode(row.status) },
];
const timelineColumns: TableColumn<TimelineRow>[] = [
  { id: "operation", label: "Operation", sortValue: row => readableCode(row.operation) },
  { id: "status", label: "Status", sortValue: row => readableCode(row.status) },
  { id: "recorded", label: "Recorded", sortValue: row => timeValue(row.accepted_at) },
  { id: "ledger", label: "Ledger reference", sortValue: row => row.ledger_transaction_id },
];

export function RequesterTransfersPage({ principal }: { principal: Principal }) {
  const initial = selectionFromSearch(location.search);
  const query = new URLSearchParams(location.search);
  const initialBloodType = V2_BLOOD_TYPES.find(value => value === query.get("bloodType"));
  const initialComponentType = V2_COMPONENT_TYPES.find(value => value === query.get("componentType"));
  const [tab, setTab] = useState<"requests" | "transfers">(initial?.kind === "reservation" ? "transfers" : "requests");
  const [selected, setSelected] = useState<RecordSelection | undefined>(initial);
  const mayRequest = can(principal, "transfers:read") && (principal.accountId ? canAct(principal, "transfer:request") : can(principal, "transfers:write"));
  const [formOpen, setFormOpen] = useState(mayRequest && new URLSearchParams(location.search).get("newRequest") === "1");
  const requestForm = useRef<HTMLDivElement>(null);
  function scrollToRequestForm() {
    requestForm.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  useEffect(() => {
    if (!formOpen) return;
    const frame = window.requestAnimationFrame(scrollToRequestForm);
    return () => window.cancelAnimationFrame(frame);
  }, [formOpen]);
  const state = useLiveData<unknown>(can(principal, "transfers:read") ? "/api/v2/transfers" : null);
  let records: RequesterRecords | undefined, recordError = "";
  if (state.data) { try { records = parseRequesterRecords(state.data, principal); } catch (reason) { recordError = reason instanceof Error ? reason.message : "Requests unavailable."; } }
  const error = state.error || recordError;
  const count = (value: number | undefined) => value === undefined ? "—" : value;
  const changeTab = (next: "requests" | "transfers") => {setTab(next); setSelected(undefined);};
  const listDescription = tab === "requests"
    ? "Review blood requests submitted by your facility, including blood type, component, units, priority and current status. Select a request ID to see its details in the panel beside the list. Use Refresh to check for updates. The details panel shows ledger confirmation separately from request status."
    : "Track transfer reservations linked to your facility’s blood requests. Each row shows the supplying facility, requested product and units, destination and recorded transfer status. Select a transfer ID to inspect the linked reservation. Request status and transfer status are tracked separately.";
  const detailDescription = tab === "requests"
    ? "Select a request from the list to review its supplying facility, destination, blood product, requested units and recorded status. Details are checked again when you open a record. A pending confirmation does not mean that blood has been approved or received. Requester, pickup and document details will appear when they become supported."
    : "Select a transfer to review its recorded reservation status, supplying facility, destination and reserved units. You can open linked request or component records when available. Open a current reservation to review the actions authorized for your operator and its custody state.";
  const open = (kind: "request" | "reservation", id: string) => setSelected({kind, id});
  const requestView = useTableView("requester-requests", requestColumns, records?.requests ?? []), showRequest = requestView.isVisible;
  const transferView = useTableView("requester-transfers", transferColumns(principal), records?.transfers ?? []), showTransfer = transferView.isVisible;
  const timelineView = useTableView("requester-activity", timelineColumns, records?.timeline ?? []), showEvent = timelineView.isVisible;
  return <div className="page requester-transfers-page">
    <header className="page-head"><div><h1 className="page-title">Requests &amp; Transfers</h1></div>
      <div className="requester-page-actions"><RefreshButton busy={state.busy} onRefresh={state.manual}/>{mayRequest && <button className="button primary compact" type="button" aria-expanded={formOpen} aria-controls="requester-new-request-form" onClick={() => {if (formOpen) scrollToRequestForm(); else setFormOpen(true);}}>+ New Blood Request</button>}</div>
    </header>
    <div className="requester-transfer-tabs" role="tablist" aria-label="Requests and transfers">
      <button type="button" id="requester-requests-tab" role="tab" aria-selected={tab === "requests"} aria-controls="requester-records-panel" tabIndex={tab === "requests" ? 0 : -1} onKeyDown={event => {if (["ArrowRight", "ArrowLeft", "End"].includes(event.key)) {event.preventDefault(); changeTab("transfers"); document.getElementById("requester-transfers-tab")?.focus();}}} onClick={() => changeTab("requests")}>Blood Requests <span>{count(records?.requests.length)}</span></button>
      <button type="button" id="requester-transfers-tab" role="tab" aria-selected={tab === "transfers"} aria-controls="requester-records-panel" tabIndex={tab === "transfers" ? 0 : -1} onKeyDown={event => {if (["ArrowRight", "ArrowLeft", "Home"].includes(event.key)) {event.preventDefault(); changeTab("requests"); document.getElementById("requester-requests-tab")?.focus();}}} onClick={() => changeTab("transfers")}>Transfers <span>{count(records?.transfers.length)}</span></button>
    </div>
    <section className="requester-workflow" aria-label="Current facility workflow">
      <div className="requester-workflow-copy"><span>Current facility workflow</span><strong>Requester workflow</strong></div>
      <ol>{stages.map(([label, hint], index) => <li key={label}><span>{index + 1}</span><div><strong>{label}</strong><small>{hint}</small></div></li>)}</ol>
      <RequestFormHelp label="Requester workflow">
        <span className="requester-workflow-help-intro">Submit requirements, monitor request and transfer updates, then review recorded receipt status.</span>
        <span className="requester-workflow-help-step"><strong>1. Submit a request.</strong> Select New Blood Request to open the form below the records. Choose a source blood bank, blood type, component, quantity and urgency. Submit request may ask you to verify an authorized operator and PIN. Disabled details and attachments are not submitted yet.</span>
        <span className="requester-workflow-help-step"><strong>2. Monitor the request.</strong> Find your request in Blood Requests and select its ID to review details. Use Refresh for updates. Submission or pending confirmation does not mean approval.</span>
        <span className="requester-workflow-help-step"><strong>3. Track the transfer.</strong> Open Transfers when a linked reservation appears. Select its ID to review the recorded status, source, destination and reserved units. Request and transfer statuses are separate.</span>
        <span className="requester-workflow-help-step"><strong>4. Review receipt status.</strong> Check the recorded transfer status for receipt updates. Dispatch and receipt confirmation controls are not available on this page yet.</span>
      </RequestFormHelp>
    </section>
    {error && <div className="requester-transfer-notice" role="status">
      <svg className="requester-notice-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4v.1"/></svg>
      <div className="requester-notice-copy"><strong>{records ? "Update unavailable" : "Unable to load records"}</strong><p>{records ? "Showing the last confirmed records. " : ""}{error}</p></div>
      <button className="button compact dashboard-refresh" type="button" onClick={state.manual} disabled={state.busy} aria-busy={state.busy}><RefreshIcon/>Retry records</button>
    </div>}
    <div id="requester-records-panel" role="tabpanel" aria-labelledby={tab === "requests" ? "requester-requests-tab" : "requester-transfers-tab"} className="requester-records-grid">
      <section className="requester-records-card"><header className="requester-records-heading"><h2>{tab === "requests" ? "Blood Requests" : "Transfers"}</h2><RequestFormHelp label={tab === "requests" ? "Blood Requests" : "Transfers"}>{listDescription}</RequestFormHelp></header>
        {!records ? <div className="requester-records-empty requester-records-state" aria-live="polite">
            {error ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4v.1"/></svg> : <svg className="requester-loading-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9"/></svg>}
            <strong>{error ? "Records unavailable" : "Loading records…"}</strong><span>{error ? "Use Retry records or Refresh to try again." : "Your request and transfer records will appear here."}</span>
          </div>
          : tab === "requests" ? records.requests.length === 0 ? <div className="requester-records-empty"><strong>No blood requests yet</strong><span>Your submitted requests will appear here.</span></div>
            : <PaginatedTable total={records.requests.length} label="Blood requests" resetKey={tab + "|" + requestView.sortKey} toolbar={<TableViewBar view={requestView}/>}><table className="data-table requester-transfer-table"><thead><tr><SortableHeader view={requestView} id="request">Request ID</SortableHeader><SortableHeader view={requestView} id="bloodType">Blood Type</SortableHeader><SortableHeader view={requestView} id="units" className="numeric">Units</SortableHeader><SortableHeader view={requestView} id="priority">Priority</SortableHeader><SortableHeader view={requestView} id="facility">Requesting Facility</SortableHeader><SortableHeader view={requestView} id="status">Status</SortableHeader></tr></thead><tbody>{requestView.rows.map(row => <tr key={row.transfer_id} className={selected?.id === row.transfer_id ? "selected" : ""} onClick={() => open("request", row.transfer_id)}>{showRequest("request")&&<td><button className="requester-record-link mono" onClick={() => open("request", row.transfer_id)} aria-label={"Open request " + row.transfer_id} title={row.transfer_id} aria-pressed={selected?.kind === "request" && selected.id === row.transfer_id}>{compactRecordReference(row.transfer_id)}</button>{row.request_time && <small>{formatManilaDateTime(row.request_time)}</small>}</td>}{showRequest("bloodType")&&<td><BloodTypeBadge value={row.blood_type}/><small>{componentLabel(row.component_type)}</small></td>}{showRequest("units")&&<td className="numeric">{row.quantity}</td>}{showRequest("priority")&&<td>{readableCode(row.urgency)}</td>}{showRequest("facility")&&<td>{principal.institutionDisplayName}</td>}{showRequest("status")&&<td><span className={statusClassName(row.status)}>{readableCode(row.status)}</span></td>}</tr>)}</tbody></table></PaginatedTable>
          : records.transfers.length === 0 ? <div className="requester-records-empty"><strong>No transfers yet</strong><span>Transfers will appear once a reservation is recorded for your request.</span></div>
            : <PaginatedTable total={records.transfers.length} label="Transfers" resetKey={tab + "|" + transferView.sortKey} toolbar={<TableViewBar view={transferView}/>}><table className="data-table requester-transfer-table"><thead><tr><SortableHeader view={transferView} id="transfer">Transfer ID</SortableHeader><SortableHeader view={transferView} id="bloodType">Blood Type</SortableHeader><SortableHeader view={transferView} id="units" className="numeric">Units</SortableHeader><SortableHeader view={transferView} id="from">From</SortableHeader><SortableHeader view={transferView} id="to">To</SortableHeader><SortableHeader view={transferView} id="status">Status</SortableHeader></tr></thead><tbody>{transferView.rows.map(row => <tr key={row.reservation_id} className={selected?.id === row.reservation_id ? "selected" : ""}>{showTransfer("transfer")&&<td><button className="requester-record-link mono" onClick={() => open("reservation", row.reservation_id)} aria-label={"Open reservation " + row.reservation_id} title={row.reservation_id} aria-pressed={selected?.kind === "reservation" && selected.id === row.reservation_id}>{compactRecordReference(row.reservation_id)}</button><small className="mono">Request ID: {row.transfer_id}</small></td>}{showTransfer("bloodType")&&<td><BloodTypeBadge value={row.request.blood_type}/><small>{componentLabel(row.request.component_type)}</small></td>}{showTransfer("units")&&<td className="numeric">{row.request.quantity}</td>}{showTransfer("from")&&<td>{facilityLabel(row.request.source_institution_id, principal)}</td>}{showTransfer("to")&&<td>{principal.institutionDisplayName}</td>}{showTransfer("status")&&<td><span className={statusClassName(row.status)}>{readableCode(row.status)}</span></td>}</tr>)}</tbody></table></PaginatedTable>}
        {(!records||(tab==="requests"?records.requests:records.transfers).length===0)&&<RecordPagination total={0} ready={Boolean(records)} label={tab==="requests"?"Blood requests":"Transfers"}/>}
      </section>
      <section className="requester-records-card requester-details-card" aria-label={tab === "requests" ? "Request details" : "Transfer details"}>
        {selected && records ? <V2RecordExplorer key={selected.kind + selected.id} initial={selected} principal={principal} inline headerHelp={<RequestFormHelp label={tab === "requests" ? "Request Details" : "Transfer Details"}>{detailDescription}</RequestFormHelp>} onClose={() => setSelected(undefined)} onRefresh={state.manual}/> : <><header className="requester-records-heading"><h2>{tab === "requests" ? "Request Details" : "Transfer Details"}</h2><RequestFormHelp label={tab === "requests" ? "Request Details" : "Transfer Details"}>{detailDescription}</RequestFormHelp></header><div className="requester-records-empty"><strong>Select a {tab === "requests" ? "request" : "transfer"}</strong><span>Choose a record from the list to view its details.</span></div></>}
      </section>
    </div>
    {formOpen && mayRequest && <div id="requester-new-request-form" ref={requestForm}><V2TransferRequest principal={principal} onRefresh={state.manual} requesterPresentation initialBloodType={initialBloodType} initialComponentType={initialComponentType} onCancel={() => setFormOpen(false)}/></div>}
    {records && records.timeline.length > 0 && <details className="requester-recorded-activity"><summary>Recorded activity</summary><PaginatedTable total={records.timeline.length} label="Recorded activity" resetKey={timelineView.sortKey} toolbar={<TableViewBar view={timelineView}/>}><table className="data-table"><thead><tr><SortableHeader view={timelineView} id="operation">Operation</SortableHeader><SortableHeader view={timelineView} id="status">Status</SortableHeader><SortableHeader view={timelineView} id="recorded">Recorded</SortableHeader><SortableHeader view={timelineView} id="ledger">Ledger reference</SortableHeader></tr></thead><tbody>{timelineView.rows.map(row => <tr key={row.command_id}>{showEvent("operation")&&<td>{readableCode(row.operation)}</td>}{showEvent("status")&&<td>{readableCode(row.status)}</td>}{showEvent("recorded")&&<td>{Number.isFinite(Date.parse(row.accepted_at)) ? formatManilaDateTime(row.accepted_at) : "Unavailable"}</td>}{showEvent("ledger")&&<td className="mono">{row.ledger_transaction_id ?? "Awaiting confirmation"}</td>}</tr>)}</tbody></table></PaginatedTable></details>}
  </div>;
}
