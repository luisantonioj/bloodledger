import { useCallback, useEffect, useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { formatManilaDateTime, humanizeCode } from "../../components/ui/display";
import { CommandStatusCard } from "../commands/command-status-card";
import { useCommandStatus } from "../commands/use-command-status";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";
import { ApiRequestError } from "../../services/api/client";
import { contractVersionFor, readCompromiseReasons, readReconciliationReasons, readReservation, readReservations, readV2Components, recoverAcceptedCommand, submitReservationAction, submitV2Reconciliation, type CompromiseReasons, type ReconciliationReasons, type V2Component, type V2Reservation } from "../../services/api/v2";

type Action = "prepare" | "dispatch" | "transit" | "receive" | "cancel" | "compromise" | "local-release-complete";

export function permittedReservationActions(reservation: V2Reservation, role: Principal["roleId"]): Action[] {
  const source = role === "ROLE-01" || role === "ROLE-02";
  const recipient = role === "ROLE-03";
  if (!source && !recipient) return [];
  if (recipient && reservation.purpose === "LOCAL_RELEASE") return [];
  if (reservation.status === "ACTIVE") {
    const actions: Action[] = [];
    if (source && !reservation.preparedEvidencePresent) actions.push("prepare");
    if (source && reservation.preparedEvidencePresent) actions.push(reservation.purpose === "LOCAL_RELEASE" ? "local-release-complete" : "dispatch");
    actions.push("cancel");
    return actions;
  }
  if (reservation.purpose !== "TRANSFER") return [];
  if (reservation.status === "DISPATCHED") return source ? ["transit", "compromise"] : ["compromise"];
  if (reservation.status === "IN_TRANSIT") return recipient ? ["receive", "compromise"] : ["compromise"];
  if (reservation.status === "RECEIVED") return ["compromise"];
  return [];
}

export function ReservationWorkspace({ principal, onRefresh }: { principal: Principal; onRefresh: () => void }) {
  const [reservations, setReservations] = useState<V2Reservation[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<V2Reservation>();
  const [action, setAction] = useState<Action>();
  const [compromisePolicy, setCompromisePolicy] = useState<CompromiseReasons>();
  const [compromisePolicyError, setCompromisePolicyError] = useState("");
  const [compromiseReason, setCompromiseReason] = useState("");
  const [confirmQuarantine, setConfirmQuarantine] = useState(false);
  const [evidenceId, setEvidenceId] = useState("");
  const [evidenceDigest, setEvidenceDigest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempted = useRef<{ keys: MutationKeys; payload: Record<string, unknown>; reservationId: string; action: Action } | undefined>(undefined);
  const status = useCommandStatus(() => { void reload(); onRefresh(); });

  const reload = useCallback(async () => {
    try {
      const page = await readReservations();
      setReservations(page.items);
      setCursor(page.nextCursor);
      if (selected) setSelected(await readReservation(selected.reservationId));
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Reservations are unavailable."); }
  }, [selected?.reservationId]);
  useEffect(() => { void reload(); }, [principal.institutionId, principal.userId]);
  useEffect(() => {
    setCompromisePolicy(undefined);
    void readCompromiseReasons().then((policy) => { setCompromisePolicy(policy); setCompromisePolicyError(""); }).catch(() => setCompromisePolicyError("Compromise reasons are unavailable. The action is disabled."));
  }, [principal.institutionId, principal.userId]);

  async function select(reservationId: string) {
    setBusy(true);
    setAction(undefined); setCompromiseReason(""); setConfirmQuarantine(false);
    attempted.current = undefined;
    status.clear();
    try { setSelected(await readReservation(reservationId)); setError(""); }
    catch (reason) { setSelected(undefined); setError(reason instanceof Error ? reason.message : "Reservation detail is unavailable."); }
    finally { setBusy(false); }
  }

  async function loadMore() {
    if (!cursor) return;
    setBusy(true);
    try { const page = await readReservations(cursor); setReservations((old) => [...old, ...page.items]); setCursor(page.nextCursor); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "More reservations are unavailable."); }
    finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !action || !permittedReservationActions(selected, principal.roleId).includes(action)) return;
    if (action === "compromise" && (!compromisePolicy?.reasons.some((item) => item.code === compromiseReason) || !confirmQuarantine)) return;
    setBusy(true);
    setError("");
    const attempt = attempted.current ?? (() => {
      const keys = newMutationKeys();
      const eventTime = new Date().toISOString();
      const payload: Record<string, unknown> = { expectedVersion: selected.version, eventTime, correlationId: keys.correlationId };
      if (action === "prepare") Object.assign(payload, { preparedAt: eventTime, preparedEvidenceId: evidenceId.trim(), preparedEvidenceDigest: evidenceDigest.trim().toLowerCase() });
      if (action === "compromise") payload.reasonCode = compromiseReason;
      return { keys, payload, reservationId: selected.reservationId, action };
    })();
    attempted.current = attempt;
    try {
      status.accept(await submitReservationAction(attempt.reservationId, attempt.action, attempt.payload, attempt.keys, selected.components.some((item) => contractVersionFor(item.componentType) === "V2.1") ? "V2.1" : "V2"));
      attempted.current = undefined;
      setAction(undefined); setCompromiseReason(""); setConfirmQuarantine(false);
    } catch (reason) {
      try { const recovered = await recoverAcceptedCommand(attempt.keys.idempotencyKey); if (recovered) { status.accept(recovered); attempted.current = undefined; setAction(undefined); return; } } catch { /* Keep the same in-memory attempt for explicit retry. */ }
      setError(reason instanceof Error ? reason.message : "The reservation action was not accepted.");
      // A stale version requires a fresh read and renewed operator confirmation.
      if (reason instanceof ApiRequestError && (reason.status === 409 || /VERSION|STALE|CONFLICT/.test(reason.code ?? ""))) { attempted.current = undefined; setAction(undefined); await reload(); }
    } finally { setBusy(false); }
  }

  const actions = selected ? permittedReservationActions(selected, principal.roleId).filter((item) => item !== "compromise" || Boolean(compromisePolicy)) : [];
  return <section className="v2-operation-card">
    <header><div><p className="eyebrow">Committed projection · SIMULATION ONLY</p><h3>Reservations and custody</h3><p>Actions use the current authorized reservation ID and version.</p></div><button className="button compact" type="button" onClick={() => void reload()}>Refresh</button></header>
    {error && <p role="alert">{error}</p>}
    {compromisePolicyError && <p role="status">{compromisePolicyError}</p>}
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Reservation</th><th>Purpose</th><th>Status</th><th>Version</th><th>Components</th><th></th></tr></thead><tbody>
      {reservations.map((item) => <tr key={item.reservationId}><td className="mono">{item.reservationId}</td><td>{humanizeCode(item.purpose)}</td><td>{humanizeCode(item.status)}</td><td>{item.version}</td><td>{item.components.map((component) => humanizeCode(component.componentType)).join(", ") || "—"}</td><td><button type="button" className="button compact" onClick={() => void select(item.reservationId)}>Review</button></td></tr>)}
    </tbody></table></div>
    {reservations.length === 0 && <p>No committed reservations are available in this scope.</p>}
    {cursor && <button type="button" className="button compact" disabled={busy} onClick={() => void loadMore()}>Load more</button>}
    {selected && <div className="v2-operation-form"><p><strong>{selected.reservationId}</strong> · {humanizeCode(selected.status)} · version {selected.version} · updated {formatManilaDateTime(selected.updatedAt)}</p><p>Prepared evidence: {selected.preparedEvidencePresent ? "recorded" : "not recorded"}. No Donation No. or patient details are shown.</p>
      {actions.length > 0 && <form onSubmit={(event) => void submit(event)}>
        <label>Action<select value={action ?? ""} disabled={busy || Boolean(status.command)} onChange={(event) => { setAction(event.target.value as Action || undefined); setCompromiseReason(""); setConfirmQuarantine(false); attempted.current = undefined; setError(""); }}><option value="">Choose action</option>{actions.map((item) => <option key={item} value={item}>{humanizeCode(item)}</option>)}</select></label>
        {action === "prepare" && <><label>Approved evidence ID<input required pattern="EVD_[A-Z0-9_-]{1,56}" value={evidenceId} onChange={(event) => { setEvidenceId(event.target.value); attempted.current = undefined; }}/></label><label>Evidence SHA-256 digest<input required pattern="[A-Fa-f0-9]{64}" value={evidenceDigest} onChange={(event) => { setEvidenceDigest(event.target.value); attempted.current = undefined; }}/></label></>}
        {action === "compromise" && compromisePolicy && <><label>Reported incident reason<select required value={compromiseReason} onChange={(event) => { setCompromiseReason(event.target.value); attempted.current = undefined; }}><option value="">Choose a reported concern</option>{compromisePolicy.reasons.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label><label><input type="checkbox" checked={confirmQuarantine} onChange={(event) => { setConfirmQuarantine(event.target.checked); attempted.current = undefined; }} /> I understand this quarantines the selected components pending manual review. It does not decide clinical usability or disposal.</label></>}
        <button className="button primary" disabled={!action || busy || Boolean(status.command) || (action === "compromise" && (!compromiseReason || !confirmQuarantine))}>{busy ? "Submitting…" : "Confirm action"}</button>
      </form>}
      {["DISPATCHED", "IN_TRANSIT", "RECEIVED"].includes(selected.status) && !compromisePolicy && <p>Compromise submission is unavailable until the approved synthetic reason policy loads.</p>}
      {status.command && <CommandStatusCard command={status.command} pollError={status.pollError} onClear={status.clear}/>}
    </div>}
  </section>;
}

export function ReconciliationWorkspace({ onRefresh }: { onRefresh: () => void }) {
  const [policy, setPolicy] = useState<ReconciliationReasons>();
  const [components, setComponents] = useState<V2Component[]>([]);
  const [componentId, setComponentId] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ keys: MutationKeys; payload: { caseId: string; componentId: string; reasonCode: string; correlationId: string }; version: "V2" | "V2.1" } | undefined>(undefined);
  const status = useCommandStatus(onRefresh);
  useEffect(() => { void Promise.all([readReconciliationReasons(), readV2Components("V2.1")]).then(([reasons, inventory]) => { setPolicy(reasons); setComponents(inventory.components); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Reconciliation is unavailable.")); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!policy?.reasons.some((item) => item.code === reasonCode)) return;
    const component = components.find((item) => item.componentId === componentId);
    if (!component) return;
    setBusy(true);
    const current = attempt.current ?? (() => { const keys = newMutationKeys(); return { keys, payload: { caseId: "RECON_WEB_" + keys.correlationId.slice(5), componentId, reasonCode, correlationId: keys.correlationId }, version: contractVersionFor(component.componentType) }; })();
    attempt.current = current;
    try { status.accept(await submitV2Reconciliation(current.payload, current.keys, current.version)); attempt.current = undefined; setError(""); }
    catch (reason) { try { const recovered = await recoverAcceptedCommand(current.keys.idempotencyKey); if (recovered) { status.accept(recovered); attempt.current = undefined; return; } } catch { /* Keep the same in-memory attempt for explicit retry. */ } setError(reason instanceof Error ? reason.message : "Reconciliation hold was not accepted."); }
    finally { setBusy(false); }
  }
  return <section className="v2-operation-card"><header><div><p className="eyebrow">{policy?.policyVersion ?? "SIMULATION_ONLY"}</p><h3>Request reconciliation hold</h3><p>This requests a hold; it does not correct a record, release stock, or establish suitability.</p></div></header>
    {error && <p role="alert">{error}</p>}
    <form className="v2-operation-form" onSubmit={(event) => void submit(event)}><label>Component<select required value={componentId} disabled={Boolean(status.command)} onChange={(event) => { setComponentId(event.target.value); attempt.current = undefined; }}><option value="">Choose committed component</option>{components.map((item) => <option key={item.componentId} value={item.componentId}>{item.componentId} · {humanizeCode(item.componentType)}</option>)}</select></label><label>Reason<select required value={reasonCode} disabled={Boolean(status.command)} onChange={(event) => { setReasonCode(event.target.value); attempt.current = undefined; }}><option value="">Choose reason</option>{policy?.reasons.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label><button className="button primary" disabled={!policy || busy || Boolean(status.command)}>{busy ? "Submitting…" : "Request hold"}</button></form>
    {status.command && <CommandStatusCard command={status.command} pollError={status.pollError} onClear={status.clear}/>}
  </section>;
}
