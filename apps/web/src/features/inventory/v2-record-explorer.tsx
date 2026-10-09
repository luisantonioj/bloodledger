import { useEffect, useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import { readSelectedRecord, recordErrorMessage, type RecordSelection, type SelectedRecord } from "../../services/api/v2-navigation";

export function V2RecordExplorer({initial, principal, onClose}: {initial: RecordSelection; principal: Principal; onClose: () => void}) {
  const [history, setHistory] = useState<RecordSelection[]>([initial]);
  const [record, setRecord] = useState<SelectedRecord>();
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const panel = useRef<HTMLElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const selected = history[history.length - 1];
  useEffect(() => {
    const controller = new AbortController(); let closed = false;
    setRecord(undefined); setError(""); setBusy(true);
    void readSelectedRecord(selected, principal, controller.signal).then(value => {if (!closed) setRecord(value);}).catch(reason => {if (!closed) setError(recordErrorMessage(reason));}).finally(() => {if (!closed) setBusy(false);});
    return () => {closed = true; controller.abort();};
  }, [selected, principal, retry]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => {if (previous?.isConnected) previous.focus();};
  }, []);
  useEffect(() => {closeButton.current?.focus();}, [selected]);
  function open(kind: RecordSelection["kind"], id: string) {setRecord(undefined); setBusy(true); setError(""); setHistory(rows => [...rows, {kind, id}]);}
  function keyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {event.stopPropagation(); onClose();}
    if (event.key !== "Tab") return;
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],select,input,[tabindex="0"]') ?? []);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
  }
  const component = record?.kind === "component" ? record.value : undefined;
  const reservation = record?.kind === "reservation" ? record.value : undefined;
  const request = record?.kind === "request" ? record.value : undefined;
  return <div className="preview-modal-backdrop"><section ref={panel} className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="record-explorer-title" onKeyDown={keyDown}>
    <header><div><h2 id="record-explorer-title">{selected.kind === "component" ? "Component details" : selected.kind === "reservation" ? "Reservation details" : "Transfer request details"}</h2><p className="mono">{selected.id}</p></div><button ref={closeButton} aria-label="Close record details" onClick={onClose}>×</button></header>
    <div className="preview-modal-body">
      {history.length > 1 && <button className="button compact" onClick={() => {setRecord(undefined); setBusy(true); setHistory(rows => rows.slice(0, -1));}}>Back to previous record</button>}
      {busy && <p role="status">Loading current authorized record…</p>}
      {error && <div role="alert"><p>{error}</p><button className="button" onClick={() => setRetry(value => value + 1)}>Retry record</button></div>}
      {component && <><dl className="v2-operation-card">
        <dt>Donation</dt><dd className="mono">{component.donationId}</dd><dt>Blood / component</dt><dd>{humanizeCode(component.bloodType)} / {humanizeCode(component.componentType)}</dd>
        <dt>Collection</dt><dd>{formatManilaDateTime(component.collectedAt)}</dd><dt>Expiry</dt><dd>{formatManilaDateTime(component.expiresAt)}</dd>
        <dt>Original issuer</dt><dd>{component.issuerInstitutionId}</dd><dt>Current custodian</dt><dd>{component.institutionId}</dd>
        <dt>Inventory state</dt><dd><span className={statusClassName(component.inventoryStatus)}>{humanizeCode(component.inventoryStatus)}</span></dd>
        <dt>Inventory version</dt><dd>{component.inventoryVersion}</dd><dt>Reservation version</dt><dd>{component.reservationVersion ?? "Not reserved"}</dd>
      </dl>{component.reservationId ? <button className="button" onClick={() => open("reservation", component.reservationId!)}>Open linked reservation</button> : <p>No linked reservation.</p>}<p>Dates describe this unit. Near-expiry alerts remain disabled.</p></>}
      {reservation && <><dl><dt>Purpose</dt><dd>{humanizeCode(reservation.purpose)}</dd><dt>Reservation state</dt><dd>{humanizeCode(reservation.status)}</dd><dt>Version</dt><dd>{reservation.version}</dd><dt>Source institution</dt><dd>{reservation.sourceInstitutionId}</dd><dt>Destination</dt><dd>{reservation.destinationInstitutionId ?? "Local release — no destination"}</dd><dt>Preparation evidence</dt><dd>{reservation.preparedEvidencePresent ? "Recorded" : "Not recorded"}</dd></dl>
        {reservation.purpose === "TRANSFER" && reservation.transferId && <button className="button" onClick={() => open("request", reservation.transferId!)}>Open linked transfer request</button>}
        {reservation.purpose === "LOCAL_RELEASE" && <section><h3>Local-release workflow</h3><p className="mono">{reservation.localReleaseId}</p><p>This reservation supplies the local-release purpose and members. A separate local-release detail API is unavailable.</p></section>}
        <h3>Reserved component members</h3>{reservation.components.length === 0 ? <p>No current component members are returned.</p> : <ul>{reservation.components.map(member => <li key={member.componentId}><button className="button compact" onClick={() => open("component", member.componentId)} aria-label={"Open member " + member.componentId}>{member.componentId}</button> · {humanizeCode(member.componentType)} · {humanizeCode(member.inventoryStatus)} · Version {member.inventoryVersion}</li>)}</ul>}
      </>}
      {request && <dl><dt>Source</dt><dd>{request.source_institution_id}</dd><dt>Destination</dt><dd>{request.destination_institution_id}</dd><dt>Blood / component</dt><dd>{humanizeCode(request.blood_type)} / {humanizeCode(request.component_type)}</dd><dt>Requested units</dt><dd>{request.quantity}</dd><dt>Request state</dt><dd>{humanizeCode(request.status)}</dd><dt>Ledger reference</dt><dd className="mono">{request.ledger_transaction_id ?? "Pending — no commitment"}</dd></dl>}
      <p>Current API projection · SIMULATION_ONLY. Request, reservation and synchronization states are separate.</p>
    </div>
  </section></div>;
}
