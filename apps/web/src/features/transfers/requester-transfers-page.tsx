import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "../../services/api/v2";
import { RequestFormHelp } from "./request-form-help";
import { useEffect, useRef, useState } from "react";
import { can, canAct, type Principal } from "../../auth/permissions";
import { BloodTypeBadge } from "../../components/ui/aggregate-tables";
import { formatManilaDateTime, statusClassName } from "../../components/ui/display";
import { useLiveData } from "../../hooks/use-live-data";
import { selectionFromSearch, type RecordSelection } from "../../services/api/v2-navigation";
import { V2RecordExplorer } from "../inventory/v2-record-explorer";
import { V2TransferRequest } from "./v2-operations";
import { componentLabel, facilityLabel, parseRequesterRecords, readableCode, type RequesterRecords } from "./requester-transfer-data";

const stages = [["Submit Request", "Provide requirements"], ["Await Approval", "Monitor the decision"], ["Track Request", "Follow transfer status"], ["Receive Blood", "Confirm inbound receipt"]];

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
    ? "Review blood requests submitted by your facility, including blood type, component, units, priority and current status. Select a request ID to see its details in the panel beside the list. Use Refresh to check for updates. Awaiting ledger confirmation means the request is not yet confirmed; it does not indicate approval or receipt."
    : "Track transfer reservations linked to your facility’s blood requests. Each row shows the supplying facility, requested product and units, destination and recorded transfer status. Select a transfer ID to inspect the linked reservation. Request status and transfer status are tracked separately.";
  const detailDescription = tab === "requests"
    ? "Select a request from the list to review its supplying facility, destination, blood product, requested units and recorded status. Details are checked again when you open a record. A pending confirmation does not mean that blood has been approved or received. Requester, pickup and document details will appear when they become supported."
    : "Select a transfer to review its recorded reservation status, supplying facility, destination and reserved units. You can open linked request or component records when available. This panel shows recorded information; dispatch, custody and receipt actions are not available here yet.";
  const open = (kind: "request" | "reservation", id: string) => setSelected({kind, id});
  return <div className="page requester-transfers-page">
    <header className="page-head"><div><h1 className="page-title">Requests &amp; Transfers</h1></div>
      <div className="requester-page-actions"><button className="button compact dashboard-refresh" type="button" onClick={state.manual} disabled={state.busy} aria-busy={state.busy}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4v6h6M20 20v-6h-6M5 14a8 8 0 0 0 14 4M19 10a8 8 0 0 0-14-4"/></svg>{state.busy ? "Refreshing…" : "Refresh"}</button>{mayRequest && <button className="button primary compact" type="button" aria-expanded={formOpen} aria-controls="requester-new-request-form" onClick={() => {if (formOpen) scrollToRequestForm(); else setFormOpen(true);}}>+ New Blood Request</button>}</div>
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
      <button className="button compact dashboard-refresh" type="button" onClick={state.manual} disabled={state.busy} aria-busy={state.busy}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4v6h6M20 20v-6h-6M5 14a8 8 0 0 0 14 4M19 10a8 8 0 0 0-14-4"/></svg>Retry records</button>
    </div>}
    <div id="requester-records-panel" role="tabpanel" aria-labelledby={tab === "requests" ? "requester-requests-tab" : "requester-transfers-tab"} className="requester-records-grid">
      <section className="requester-records-card"><header className="requester-records-heading"><h2>{tab === "requests" ? "Blood Requests" : "Transfers"}</h2><RequestFormHelp label={tab === "requests" ? "Blood Requests" : "Transfers"}>{listDescription}</RequestFormHelp></header>
        {!records ? <div className="requester-records-empty requester-records-state" aria-live="polite">
            {error ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4v.1"/></svg> : <svg className="requester-loading-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9"/></svg>}
            <strong>{error ? "Records unavailable" : "Loading records…"}</strong><span>{error ? "Use Retry records or Refresh to try again." : "Your request and transfer records will appear here."}</span>
          </div>
          : tab === "requests" ? records.requests.length === 0 ? <div className="requester-records-empty"><strong>No blood requests yet</strong><span>Your submitted requests will appear here.</span></div>
            : <div className="table-wrap"><table className="data-table requester-transfer-table"><thead><tr><th>Request ID</th><th>Blood Type</th><th className="numeric">Units</th><th>Priority</th><th>Requesting Facility</th><th>Status</th></tr></thead><tbody>{records.requests.map(row => <tr key={row.transfer_id} className={selected?.id === row.transfer_id ? "selected" : ""}><td><button className="requester-record-link mono" onClick={() => open("request", row.transfer_id)} aria-label={"Open request " + row.transfer_id}>{row.transfer_id}</button>{row.request_time && <small>{formatManilaDateTime(row.request_time)}</small>}</td><td><BloodTypeBadge value={row.blood_type}/><small>{componentLabel(row.component_type)}</small></td><td className="numeric">{row.quantity}</td><td>{readableCode(row.urgency)}</td><td>{principal.institutionDisplayName}</td><td><span className={statusClassName(row.status)}>{readableCode(row.status)}</span>{!row.ledger_transaction_id && <small>Awaiting ledger confirmation</small>}</td></tr>)}</tbody></table></div>
          : records.transfers.length === 0 ? <div className="requester-records-empty"><strong>No transfers yet</strong><span>Transfers will appear once a reservation is recorded for your request.</span></div>
            : <div className="table-wrap"><table className="data-table requester-transfer-table"><thead><tr><th>Transfer ID</th><th>Blood Type</th><th className="numeric">Units</th><th>From</th><th>To</th><th>Status</th></tr></thead><tbody>{records.transfers.map(row => <tr key={row.reservation_id} className={selected?.id === row.reservation_id ? "selected" : ""}><td><button className="requester-record-link mono" onClick={() => open("reservation", row.reservation_id)} aria-label={"Open reservation " + row.reservation_id}>{row.transfer_id}</button><small className="mono">{row.reservation_id}</small></td><td><BloodTypeBadge value={row.request.blood_type}/><small>{componentLabel(row.request.component_type)}</small></td><td className="numeric">{row.request.quantity}</td><td>{facilityLabel(row.request.source_institution_id, principal)}</td><td>{principal.institutionDisplayName}</td><td><span className={statusClassName(row.status)}>{readableCode(row.status)}</span></td></tr>)}</tbody></table></div>}
      </section>
      <section className="requester-records-card requester-details-card" aria-label={tab === "requests" ? "Request details" : "Transfer details"}>
        {selected && records ? <V2RecordExplorer key={selected.kind + selected.id} initial={selected} principal={principal} inline headerHelp={<RequestFormHelp label={tab === "requests" ? "Request Details" : "Transfer Details"}>{detailDescription}</RequestFormHelp>} onClose={() => setSelected(undefined)}/> : <><header className="requester-records-heading"><h2>{tab === "requests" ? "Request Details" : "Transfer Details"}</h2><RequestFormHelp label={tab === "requests" ? "Request Details" : "Transfer Details"}>{detailDescription}</RequestFormHelp></header><div className="requester-records-empty"><strong>Select a {tab === "requests" ? "request" : "transfer"}</strong><span>Choose a record from the list to view its details.</span></div></>}
      </section>
    </div>
    {formOpen && mayRequest && <div id="requester-new-request-form" ref={requestForm}><V2TransferRequest principal={principal} onRefresh={state.manual} requesterPresentation initialBloodType={initialBloodType} initialComponentType={initialComponentType} onCancel={() => setFormOpen(false)}/></div>}
    {records && records.timeline.length > 0 && <details className="requester-recorded-activity"><summary>Recorded activity</summary><div className="table-wrap"><table className="data-table"><thead><tr><th>Operation</th><th>Status</th><th>Recorded</th><th>Ledger reference</th></tr></thead><tbody>{records.timeline.map(row => <tr key={row.command_id}><td>{readableCode(row.operation)}</td><td>{readableCode(row.status)}</td><td>{Number.isFinite(Date.parse(row.accepted_at)) ? formatManilaDateTime(row.accepted_at) : "Unavailable"}</td><td className="mono">{row.ledger_transaction_id ?? "Awaiting confirmation"}</td></tr>)}</tbody></table></div></details>}
  </div>;
}
