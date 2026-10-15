import { useCallback, useEffect, useRef, useState } from "react";
import { canAct, type Principal } from "../../auth/permissions";
import { ApiRequestError, retryAfterContextChange } from "../../services/api/client";
import { canReadPrcSupply, parsePrcSupplyList, readPrcDetail, PRC_DECLINE_REASONS, PRC_REFERENCE, prcSupplyError, type PrcAction, type PrcSupplyDetail, type PrcSupplyRequest } from "../../services/api/prc-supply";
import { usePagedRead } from "../../hooks/use-paged-read";
import { PagedReadControls } from "../../components/ui/paged-read-controls";
import { PaginatedTable } from "../../components/ui/record-pagination";
import { RefreshButton } from "../../components/ui/refresh-button";
import { compactRecordReference, formatBloodType, formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import { exportTablePdf } from "../../services/pdf/table-report";
import { componentLabel } from "./requester-transfer-data";
import { PrcSupplyRequestForm } from "./prc-supply-request-form";
import { usePrcMutation } from "./use-prc-mutation";

export const prcSupplyHeaders = ["Request ID", "Product", "Units", "Required By", "PRC Reference", "Status"];
export const prcUnits = (row: PrcSupplyRequest) => row.fulfilledQuantity === null ? String(row.requestedQuantity) : `${row.fulfilledQuantity} of ${row.requestedQuantity}`;
export const prcStatus = (row: PrcSupplyRequest) => row.status + (row.declineReason ? " · " + row.declineReason : "");
export const prcSupplyRows = (rows: PrcSupplyRequest[]) => rows.map(row => [row.requestId, formatBloodType(row.bloodType) + " · " + componentLabel(row.componentType), prcUnits(row), formatManilaDateTime(row.requiredBy), row.prcReference ?? "Awaiting PRC acknowledgement", prcStatus(row)]);
export const maySubmitPrc = (p: Principal) => p.accountCategory === "BLOOD_BANK" && p.roleId === "ROLE-02" && p.verificationRequired === true && canAct(p, "prc-supply:request");
export function prcAllowedActions(p: Principal, row: PrcSupplyRequest): PrcAction[] {
  if (!canReadPrcSupply(p) || !p.verificationRequired) return [];
  if (p.accountCategory === "BLOOD_BANK") return p.roleId === "ROLE-02" && row.requestingInstitution.institutionId === p.institutionId && row.status === "SUBMITTED" && canAct(p, "prc-supply:cancel") ? ["cancel"] : [];
  if (!canAct(p, "prc-supply:respond")) return [];
  return row.status === "SUBMITTED" ? ["acknowledge", "decline"] : row.status === "ACKNOWLEDGED" ? ["fulfil", "decline"] : [];
}
function PrcActionForm({row, actions, busy, onSubmit}: {row: PrcSupplyRequest; actions: PrcAction[]; busy: boolean; onSubmit: (action: PrcAction, fields: object) => void}) {
  const [action, setAction] = useState<PrcAction>(actions[0]), [reference, setReference] = useState("");
  const [quantity, setQuantity] = useState(String(row.requestedQuantity)), [reason, setReason] = useState<typeof PRC_DECLINE_REASONS[number]>("NO_STOCK");
  const [error, setError] = useState("");
  return <form className="prc-action-form" onSubmit={event => {event.preventDefault(); if (busy || !actions.includes(action)) return; if (action === "acknowledge" && !PRC_REFERENCE.test(reference)) {setError("Enter the PRC reference exactly: 3–32 uppercase letters, digits or hyphens.");return;} const amount = Number(quantity); if (action === "fulfil" && (!Number.isSafeInteger(amount) || amount < 1 || amount > row.requestedQuantity)) {setError("Fulfilled quantity must be 1 to the requested quantity.");return;} setError("");onSubmit(action, action === "acknowledge" ? {prcReference:reference} : action === "fulfil" ? {fulfilledQuantity:amount} : action === "decline" ? {reasonCode:reason} : {});}}>
    <fieldset disabled={busy}><label>Coordination action<select value={action} onChange={event => setAction(event.target.value as PrcAction)}>{actions.map(value => <option key={value} value={value}>{humanizeCode(value)}</option>)}</select></label>
      {action === "acknowledge" && <label>PRC Reference<input value={reference} onChange={event => setReference(event.target.value)} pattern={PRC_REFERENCE.source} minLength={3} maxLength={32} autoComplete="off" required/></label>}
      {action === "fulfil" && <label>Fulfilled Units<input type="number" min={1} max={row.requestedQuantity} step={1} value={quantity} onChange={event => setQuantity(event.target.value)} required/></label>}
      {action === "decline" && <label>Decline reason<select value={reason} onChange={event => setReason(event.target.value as typeof reason)}>{PRC_DECLINE_REASONS.map(value => <option key={value}>{value}</option>)}</select></label>}
      <button className="button primary compact" type="submit">{action === "cancel" ? "Cancel PRC request" : action === "acknowledge" ? "Acknowledge request" : action === "fulfil" ? "Record fulfilment" : "Decline request"}</button>
    </fieldset>{error && <p role="alert">{error}</p>}
  </form>;
}
export function PrcSupplyWorkspace({principal, embedded = false}: {principal: Principal; embedded?: boolean}) {
  const allowed = canReadPrcSupply(principal);
  const parser = useCallback((value: unknown) => parsePrcSupplyList(value, principal), [principal]);
  const list = usePagedRead(allowed ? "/api/v2/prc-supply-requests" : null, parser, "requestId", principal.accountCategory + "|" + principal.institutionId);
  const [search, setSearch] = useState(""), [formOpen, setFormOpen] = useState(false), [selected, setSelected] = useState(()=>new URLSearchParams(location.search).get("prcRequestId")??"");
  const formArea = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState(0), [detail, setDetail] = useState<PrcSupplyDetail>(), [detailError, setDetailError] = useState("");
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState("");
  const mutation = usePrcMutation(principal, row => {setFormOpen(false); setSelected(row.requestId); setRevision(value => value + 1); list.refresh();});
  useEffect(() => {
    setDetail(undefined); setDetailError("");
    if (!allowed || !selected) return;
    const controller = new AbortController();
    void retryAfterContextChange(() => readPrcDetail(selected, principal, controller.signal), () => !controller.signal.aborted).then(row => {if (!controller.signal.aborted) {setDetail(row);mutation.refreshed();}}).catch(reason => {if (!controller.signal.aborted) setDetailError(reason instanceof ApiRequestError && reason.status === 403 ? "You are not permitted to view this PRC request." : reason instanceof ApiRequestError && reason.code?.startsWith("PRC_SUPPLY_") ? prcSupplyError(reason) : "PRC request details could not be loaded. Refresh to try again.");});
    return () => controller.abort();
  }, [principal, selected, revision, allowed]);
  useEffect(() => {
    if (!formOpen) return;
    const frame = requestAnimationFrame(() => formArea.current?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",block:"start"}));
    return () => cancelAnimationFrame(frame);
  }, [formOpen]);
  if (!allowed) return <p role="alert">PRC supply requests are not available to this account.</p>;
  const visible = list.rows.filter(row => [...prcSupplyRows([row])[0], row.urgency, row.requestingInstitution.displayName, row.requestingInstitution.institutionId].some(value => value?.toLowerCase().includes(search.trim().toLowerCase())));
  const actions = detail ? prcAllowedActions(principal, detail) : [];
  function refresh() {list.refresh();setRevision(value => value + 1);}
  async function exportPdf() {setExporting(true);setExportError("");try {await exportTablePdf({title:"PRC Supply Requests",scope:principal.institutionDisplayName+" · SIMULATION_ONLY · Off-chain",filters:`Loaded rows only; Search: ${search || "None"}`,headers:prcSupplyHeaders,rows:prcSupplyRows(visible),filename:"prc-supply-requests"});} catch {setExportError("PDF export failed.");} finally {setExporting(false);}}
  return <div className={"prc-supply-workspace"+(embedded ? " prc-supply-embedded" : " page")}>
    {!embedded && <header className="page-head"><h1 className="page-title">PRC Supply Requests</h1></header>}
    <div className="prc-supply-toolbar"><span>SIMULATION_ONLY · Off-chain coordination</span><div className="bank-toolbar-actions">
      {maySubmitPrc(principal) && <button className="button primary compact" disabled={mutation.locked} aria-expanded={formOpen} onClick={() => {setFormOpen(true); if(formOpen)formArea.current?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",block:"start"});}}>+ Request PRC Supply</button>}
      <button className="button compact" disabled={!visible.length || exporting} onClick={() => void exportPdf()}>Export PDF</button><RefreshButton busy={list.busy || mutation.busy} onRefresh={refresh}/>
    </div></div>
    {mutation.error && <p role="alert" className="prc-supply-message">{mutation.error}</p>}{mutation.notice && <p role="status" className="prc-supply-message">{mutation.notice}</p>}
    {mutation.ambiguous && <button className="button compact" disabled={mutation.busy} onClick={mutation.retry}>Retry same attempt</button>}
    {exportError && <p role="alert">{exportError}</p>}
    {formOpen && maySubmitPrc(principal) && <div ref={formArea} className="bank-request-form-anchor"><PrcSupplyRequestForm onClose={() => setFormOpen(false)} enabled={list.ready && !list.error && !mutation.needsRefresh} busy={mutation.locked} onSubmit={draft => mutation.run("/api/v2/prc-supply-requests", correlationId => ({...draft,correlationId}))}/></div>}
    <section className="bank-record-card"><div className="bank-list-filters"><label>Search PRC requests<input type="search" placeholder="Search loaded references, products or status…" value={search} onChange={event => setSearch(event.target.value)}/></label></div>
      <PaginatedTable ready={list.ready} total={visible.length} label="PRC supply requests" resetKey={search}><table className="data-table bank-prc-supply-table"><thead><tr>{prcSupplyHeaders.map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>
        {visible.map(row => <tr key={row.requestId}><td><button className="requester-record-link mono" title={row.requestId} aria-label={"Open PRC request "+row.requestId} disabled={mutation.busy} onClick={() => setSelected(row.requestId)}>{compactRecordReference(row.requestId)}</button>{principal.accountCategory === "PRC" && <small>{row.requestingInstitution.displayName ?? row.requestingInstitution.institutionId}</small>}</td><td><strong>{formatBloodType(row.bloodType)}</strong><small>{componentLabel(row.componentType)}</small></td><td>{prcUnits(row)}</td><td>{formatManilaDateTime(row.requiredBy)}</td><td>{row.prcReference ?? "Awaiting PRC acknowledgement"}</td><td><span className={row.status==="CANCELLED"?"status neutral":statusClassName(row.status)}>{row.status}</span>{row.declineReason && <small>{row.declineReason}</small>}</td></tr>)}
        {!visible.length && <tr><td colSpan={6}><div className="requester-records-empty"><strong>{list.ready ? list.rows.length ? "No PRC requests match the loaded records" : "No PRC supply requests recorded" : list.busy ? "Loading PRC supply requests…" : "No PRC supply records available"}</strong>{!list.ready && !list.busy && <span>The PRC supply service is unavailable. Submission remains disabled.</span>}</div></td></tr>}
      </tbody></table></PaginatedTable><PagedReadControls ready={list.ready} count={list.rows.length} nextCursor={list.nextCursor} busy={list.busy} error={list.error} loadMore={list.loadMore}/>
    </section>
    {selected && <section className="bank-record-card prc-supply-detail" aria-label="PRC request details"><header className="bank-section-heading"><h2>PRC request details</h2><button className="button compact" disabled={mutation.locked} onClick={() => setSelected("")}>Close details</button></header>
      {detailError ? <p role="alert">{detailError}</p> : !detail ? <p role="status">Loading current PRC request…</p> : <>
        <dl className="prc-detail-facts"><div><dt>Request ID</dt><dd className="mono">{detail.requestId}</dd></div><div><dt>Requesting institution</dt><dd>{detail.requestingInstitution.displayName ?? detail.requestingInstitution.institutionId}</dd></div><div><dt>Record type</dt><dd>Off-chain</dd></div><div><dt>Coordination status</dt><dd>{prcStatus(detail)}</dd></div><div><dt>Required By (Asia/Manila)</dt><dd>{formatManilaDateTime(detail.requiredBy)}</dd></div><div><dt>Priority</dt><dd>{detail.urgency}</dd></div><div><dt>PRC Reference</dt><dd>{detail.prcReference ?? "Awaiting PRC acknowledgement"}</dd></div><div><dt>Reference provenance</dt><dd>{detail.referenceProvenance ?? "Not recorded"}</dd></div><div><dt>Version</dt><dd>{detail.version}</dd></div></dl>
        <p className="prc-supply-message">Required By cannot be edited. Cancel a submitted request and create a new one if the deadline changes. Fulfilment is coordination evidence; supplied units still require normal OCR intake.</p>
        {actions.length > 0 && <PrcActionForm key={detail.requestId+"|"+detail.version} row={detail} actions={actions} busy={mutation.locked || mutation.needsRefresh || !list.ready} onSubmit={(action, fields) => mutation.run("/api/v2/prc-supply-requests/"+detail.requestId+"/"+action, correlationId => ({expectedVersion:detail.version, correlationId, ...fields}), detail.requestId)}/>}
        <h3>Request history</h3><ol className="prc-request-history">{detail.history.map((entry, index) => <li key={index}><strong>{humanizeCode(entry.action)}</strong><span>{entry.priorStatus ?? "New request"} → {entry.resultingStatus}{entry.reasonCode ? " · "+entry.reasonCode : ""}</span><small>{entry.actor.displayName ?? "Display name unavailable"} · {formatManilaDateTime(entry.recordedAt)} · Off-chain</small></li>)}</ol>{!detail.history.length && <p>No request history returned.</p>}
      </>}
    </section>}
  </div>;
}
