import {COMMAND_PRESENTATION} from "../commands/command-state";
import type {ReceiptRecognition} from "../receipts/receipt-ocr";
import { OutboundVerification } from "./outbound-verification";
import { RefreshIcon } from "../../components/ui/refresh-button";
import { useEffect, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { submitReservationAction } from "../../services/api/v2";
import type { ReservationDetail } from "../../services/api/v2-navigation";
import { CommandStatusCard } from "../commands/command-status-card";
import { ReasonSelector } from "../commands/reason-selector";
import { useUatCommand } from "../commands/use-uat-command";
import { DELAY_REASONS, reservationActions, RESERVATION_ACTION_LABELS, type ReservationAction } from "./reservation-action-policy";
import { ReservationLocationAudit } from "./reservation-location-audit";
import { captureCheckpointLocation, locationLabel, type CheckpointLocation } from "./checkpoint-location";

export function ReservationActions({ reservation, principal, onRefresh, onLockChange, scannedRecognition }: { scannedRecognition?:ReceiptRecognition; onLockChange?:(locked:boolean)=>void; reservation?: ReservationDetail; principal: Principal; onRefresh: () => void }) {
  const command = useUatCommand(onRefresh);
  const [action, setAction] = useState<ReservationAction>(), [reason, setReason] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [evidenceId, setEvidenceId] = useState(""), [digest, setDigest] = useState(""), [preparedAt, setPreparedAt] = useState("");
  const [verificationLocked,setVerificationLocked]=useState(false);
  const [location,setLocation]=useState<CheckpointLocation>(),[locating,setLocating]=useState(false);
  const closeLocked=command.busy||command.ambiguous||verificationLocked||Boolean(command.command&&!COMMAND_PRESENTATION[command.command.status].terminal);
  useEffect(()=>{onLockChange?.(closeLocked);return()=>onLockChange?.(false);},[closeLocked,onLockChange]);
  const actions = reservation ? reservationActions(reservation, principal) : [];
  useEffect(() => { if (!command.locked) { setAction(undefined); setConfirmed(false); setReason(""); setEvidenceId(""); setDigest(""); setPreparedAt(""); command.correct(); } }, [reservation?.version]);
  const prepareValid = action !== "prepare" || (/^EVD_[A-Z0-9_-]+$/.test(evidenceId) && /^[a-f0-9]{64}$/.test(digest) && /(Z|[+-]\d{2}:\d{2})$/.test(preparedAt) && Number.isFinite(Date.parse(preparedAt)) && Date.parse(preparedAt) <= Date.now());
  const ready = action && actions.includes(action) && prepareValid && confirmed && (action !== "compromise" || !!reason) && (action !== "delay" || !!reason) && ((action !== "dispatch" && action !== "receive") || !!location);
  function choose(next: ReservationAction) {
    if(next !== action)command.correct(); setAction(next); setReason(""); setConfirmed(false); setLocation(undefined);
    // One reading per checkpoint, taken when the user opens dispatch or receipt.
    if (next === "dispatch" || next === "receive") { setLocating(true); void captureCheckpointLocation().then(value => { setLocation(value); setLocating(false); }); }
  }
  async function submit() {
    if (verificationLocked || !reservation || !action || (!ready && !command.ambiguous)) return;
    await command.submit(keys => {
      const eventTime = new Date().toISOString();
      return { resourceType: "TRANSFER", resourceId: reservation.reservationId, payload: {
        correlationId: keys.correlationId, eventTime, expectedVersion: reservation.version,
        ...(action === "prepare" ? { preparedAt: new Date(preparedAt).toISOString(), preparedEvidenceId: evidenceId, preparedEvidenceDigest: digest } : {}),
        ...(action === "compromise" || action === "delay" ? { reasonCode: reason } : {}),
        ...((action === "dispatch" || action === "receive") && location ? { location } : {}),
      } };
    }, (payload, keys) => submitReservationAction(reservation.reservationId, action, payload, keys, "V2.1"));
  }
  return <section className="v2-operation-card" aria-label="Reservation actions"><h3>Reservation actions</h3>
    {reservation && reservation.purpose === "TRANSFER" && ["DISPATCHED", "IN_TRANSIT", "DELAYED", "RECEIVED", "COMPROMISED"].includes(reservation.status) && <ReservationLocationAudit reservationId={reservation.reservationId} version={reservation.version}/>}
    {reservation?.status === "DELAYED" && <p role="status">Delayed — follow up with the other facility. Units stay in custody transit until received.</p>}
    {reservation?.status === "RECEIVED" && <p>Stock is RECEIVED. It is not usable inventory; manual disposition remains required (RQ-10).</p>}
    {!actions.length && !command.command && <p>No authorized action is available in the current reservation state.</p>}
    <div className="bank-detail-action-buttons">{actions.map(item => <button type="button" className="button compact" key={item} disabled={command.locked||verificationLocked} onClick={() => choose(item)}>{RESERVATION_ACTION_LABELS[item]}</button>)}</div>
    {action && <form onSubmit={event => { event.preventDefault(); void submit(); }}><fieldset disabled={command.locked}>
      <legend>{RESERVATION_ACTION_LABELS[action]}</legend>
      {action === "prepare" && <>{reservation&&<OutboundVerification scannedRecognition={scannedRecognition} key={reservation.reservationId+":"+reservation.version} reservation={reservation} onLockChange={setVerificationLocked} onVerified={result=>{setEvidenceId(result.evidenceId);setDigest(result.evidenceDigest);setPreparedAt(result.verifiedAt);setConfirmed(false);command.correct();}}/>}<p>Use the reviewed synthetic preparation evidence. Dates must include a timezone; no evidence is generated by this form.</p>
        <label>Preparation evidence ID<input required pattern="EVD_[A-Z0-9_-]+" value={evidenceId} onChange={event => {setEvidenceId(event.target.value); command.correct();}}/></label>
        <label>Preparation evidence SHA-256<input required pattern="[a-f0-9]{64}" value={digest} onChange={event => {setDigest(event.target.value); command.correct();}}/></label>
        <label>Prepared at (ISO 8601 with timezone)<input required value={preparedAt} onChange={event => {setPreparedAt(event.target.value); command.correct();}}/></label>
      </>}
      {action === "compromise" && <><p>This records quarantine pending manual review.</p><ReasonSelector kind="compromise" value={reason} onChange={value => {setReason(value); setConfirmed(false); command.correct();}} disabled={command.locked}/></>}
      {action === "receive" && <p>Receipt records RECEIVED stock. It does not make the units usable.</p>}
      {(action === "dispatch" || action === "receive") && <p className="checkpoint-location" role="status">{locating ? "Capturing checkpoint location…" : location ? locationLabel(location) : "Location unavailable"}. Only this checkpoint is recorded; the exact point stays off-chain for 30 days.</p>}
      {action === "delay" && <label>Delay reason<select required value={reason} onChange={event => {setReason(event.target.value); setConfirmed(false); command.correct();}}><option value="">Select a reason</option>{DELAY_REASONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>}
      {action === "resume" && <p>Resume returns the transfer to its state before the delay.</p>}
      {action === "cancel" && <p>Cancellation releases this active reservation. Expired labels still require expiry evaluation.</p>}
      <label><input type="checkbox" checked={confirmed} onChange={event => {setConfirmed(event.target.checked);}}/>I confirm {action === "compromise" ? "quarantine pending manual review" : RESERVATION_ACTION_LABELS[action].toLowerCase()} for this reservation.</label>
      <p>Expected reservation version: {reservation?.version ?? "Loading current record…"}</p>
    </fieldset><button className="button primary" type="submit" disabled={verificationLocked || command.busy || !!command.command || command.requiresCorrection || (!ready && !command.ambiguous)}>{command.busy ? "Submitting command…" : command.ambiguous ? "Retry same reservation command" : "Confirm reservation action"}</button></form>}
    {command.error && <p role="alert">{command.error}</p>}
    {command.ambiguous && <div><p>Saved request key: <code>{command.pendingKey}</code></p><button className="button" disabled={command.busy} onClick={() => void command.recover()}>Recover this attempt without resubmitting</button></div>}
    {command.requiresCorrection && <button className="button refresh-icon-button" onClick={onRefresh}><RefreshIcon/>Refresh reservation before continuing</button>}
    {command.command && <CommandStatusCard command={command.command} pollError={command.pollError} onClear={() => {command.clear(); setAction(undefined); onRefresh();}}/>}
  </section>;
}
