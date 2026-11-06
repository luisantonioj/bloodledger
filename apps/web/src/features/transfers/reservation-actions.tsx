import {COMMAND_PRESENTATION} from "../commands/command-state";
import type {ReceiptRecognition} from "../receipts/receipt-ocr";
import { OutboundVerification } from "./outbound-verification";
import { SCAN_ON_PHONE_NOTE } from "../../app/phone-scanner-mode";
import { RefreshIcon } from "../../components/ui/refresh-button";
import { useEffect, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { submitReservationAction } from "../../services/api/v2";
import type { ReservationDetail } from "../../services/api/v2-navigation";
import { CommandStatusCard } from "../commands/command-status-card";
import { ReasonSelector } from "../commands/reason-selector";
import { useUatCommand } from "../commands/use-uat-command";
import { DELAY_REASONS, reservationActions, RESERVATION_ACTION_LABELS, reservationSubmitLabel, type ReservationAction } from "./reservation-action-policy";
import { ReservationLocationAudit } from "./reservation-location-audit";
import { captureCheckpointLocation, locationLabel, type CheckpointLocation } from "./checkpoint-location";

const actionGuidance: Partial<Record<ReservationAction, string>> = {
  dispatch: "Confirm the units are ready to leave your facility.",
  transit: "Record that the shipment is on its way to the receiving facility.",
  receive: "Confirm the shipment arrived. The units stay out of usable stock until reviewed.",
  compromise: "This records quarantine pending manual review.",
  resume: "Resume the transfer from where it was before the delay.",
  cancel: "This releases the reserved units. Expired labels still need review.",
};
const confirmationLabels: Partial<Record<ReservationAction, string>> = {
  prepare: "I checked the reserved units and they are ready for handover.",
  dispatch: "I confirm these units are being handed over.",
  transit: "I confirm the shipment is on its way.",
  receive: "I confirm the shipment arrived at this facility.",
  compromise: "I confirm the units need to be quarantined for review.",
};
const completedLabels: Record<ReservationAction, string> = {
  prepare: "Transfer prepared",
  dispatch: "Transfer dispatched",
  transit: "Transfer in transit",
  receive: "Transfer received",
  cancel: "Reservation cancelled",
  "local-release-complete": "Local release recorded",
  compromise: "Compromise recorded",
  delay: "Delay recorded",
  resume: "Transfer resumed",
};

export function ReservationActions({ reservation, principal, onRefresh, onLockChange, scannedRecognition, scanOnPhone = false }: { scanOnPhone?: boolean; scannedRecognition?:ReceiptRecognition; onLockChange?:(locked:boolean)=>void; reservation?: ReservationDetail; principal: Principal; onRefresh: () => void }) {
  const command = useUatCommand(onRefresh);
  const [action, setAction] = useState<ReservationAction>(), [reason, setReason] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [submittedAction, setSubmittedAction] = useState<ReservationAction>();
  const [evidenceId, setEvidenceId] = useState(""), [digest, setDigest] = useState(""), [preparedAt, setPreparedAt] = useState("");
  const [verificationLocked,setVerificationLocked]=useState(false);
  const [location,setLocation]=useState<CheckpointLocation>(),[locating,setLocating]=useState(false);
  const closeLocked=command.busy||command.ambiguous||verificationLocked||Boolean(command.command&&!COMMAND_PRESENTATION[command.command.status].terminal);
  useEffect(()=>{onLockChange?.(closeLocked);return()=>onLockChange?.(false);},[closeLocked,onLockChange]);
  const actions = reservation ? reservationActions(reservation, principal) : [];
  const nextStep = actions.find(item => ["prepare", "dispatch", "transit", "receive"].includes(item));
  useEffect(() => { if (!command.locked) { setAction(undefined); setConfirmed(false); setReason(""); setEvidenceId(""); setDigest(""); setPreparedAt(""); command.correct(); } }, [reservation?.version]);
  const prepareValid = action !== "prepare" || (/^EVD_[A-Z0-9_-]+$/.test(evidenceId) && /^[a-f0-9]{64}$/.test(digest) && /(Z|[+-]\d{2}:\d{2})$/.test(preparedAt) && Number.isFinite(Date.parse(preparedAt)) && Date.parse(preparedAt) <= Date.now());
  const ready = action && actions.includes(action) && prepareValid && confirmed && (action !== "compromise" || !!reason) && (action !== "delay" || !!reason) && ((action !== "dispatch" && action !== "receive") || !!location);
  function choose(next: ReservationAction) {
    if(command.command?.status==="COMMITTED")command.clear();
    if(next !== action)command.correct(); setAction(next); setReason(""); setConfirmed(false); setLocation(undefined);
    // One reading per checkpoint, taken when the user opens dispatch or receipt.
    if (next === "dispatch" || next === "receive") { setLocating(true); void captureCheckpointLocation().then(value => { setLocation(value); setLocating(false); }); }
  }
  async function submit() {
    if (verificationLocked || !reservation || !action || (!ready && !command.ambiguous)) return;
    setSubmittedAction(action);
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
  return <section className="v2-operation-card reservation-actions" aria-label="Reservation actions"><h3>Transfer actions</h3>
    {reservation?.receiptDiscrepancy?.status==="OPEN"&&<p role="alert">Recount and verify the units before confirming receipt.</p>}
    {reservation?.status === "DELAYED" && <p role="status">Delayed — follow up with the other facility.</p>}
    {reservation?.status === "RECEIVED" && <p>Received units are awaiting review before they can be used.</p>}
    {!actions.length && !command.command && reservation?.status !== "RECEIVED" && <p>No actions are available for your account at this step.</p>}
    {actions.length>0&&<div className="bank-detail-action-buttons">{actions.map(item => <button type="button" className={"button compact"+(item===nextStep?" primary":"")} key={item} aria-pressed={item===action} disabled={command.locked||verificationLocked} onClick={() => choose(item)}>{RESERVATION_ACTION_LABELS[item]}</button>)}</div>}
    {action === "prepare" && scanOnPhone && <p className="scan-on-phone-note" role="note">Preparing requires scanning every reserved unit. {SCAN_ON_PHONE_NOTE} Choose Outbound, then this transfer.</p>}
    {action && !(action === "prepare" && scanOnPhone) && <form className="transfer-action-form" onSubmit={event => { event.preventDefault(); void submit(); }}><fieldset disabled={command.locked}>
      <legend>{RESERVATION_ACTION_LABELS[action]}</legend>
      {actionGuidance[action]&&<p>{actionGuidance[action]}</p>}
      {action === "prepare" && <>{reservation&&<OutboundVerification scannedRecognition={scannedRecognition} key={reservation.reservationId+":"+reservation.version} reservation={reservation} onLockChange={setVerificationLocked} onVerified={result=>{setEvidenceId(result.evidenceId);setDigest(result.evidenceDigest);setPreparedAt(result.verifiedAt);setConfirmed(false);command.correct();}}/>}
        <details className="transfer-evidence-fields"><summary>Use existing preparation evidence</summary>
          <p>Verified scans fill these fields automatically. Enter the recorded values if you already have evidence.</p>
          <label>Preparation evidence ID<input required pattern="EVD_[A-Z0-9_-]+" value={evidenceId} onChange={event => {setEvidenceId(event.target.value); command.correct();}}/></label>
          <label>Preparation evidence SHA-256<input required pattern="[a-f0-9]{64}" value={digest} onChange={event => {setDigest(event.target.value); command.correct();}}/></label>
          <label>Prepared at (ISO 8601 with timezone)<input required value={preparedAt} onChange={event => {setPreparedAt(event.target.value); command.correct();}}/></label>
        </details>
      </>}
      {action === "compromise" && <ReasonSelector kind="compromise" value={reason} onChange={value => {setReason(value); setConfirmed(false); command.correct();}} disabled={command.locked}/>}
      {(action === "dispatch" || action === "receive") && <p className="checkpoint-location" role="status">{locating ? "Checking handover location…" : location ? locationLabel(location) : "Location unavailable"}. Exact locations are retained privately for 30 days.</p>}
      {action === "delay" && <label>Delay reason<select required value={reason} onChange={event => {setReason(event.target.value); setConfirmed(false); command.correct();}}><option value="">Select a reason</option>{DELAY_REASONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>}
      <label className="transfer-action-confirm"><input type="checkbox" checked={confirmed} onChange={event => {setConfirmed(event.target.checked);}}/>{confirmationLabels[action]??`I confirm this action: ${RESERVATION_ACTION_LABELS[action]}.`}</label>
    </fieldset><button className="button primary" type="submit" data-testid={action === "dispatch" ? "outbound-confirm-transaction" : "reservation-action-submit"} disabled={verificationLocked || command.busy || !!command.command || command.requiresCorrection || (!ready && !command.ambiguous)}>{reservationSubmitLabel(action, command)}</button></form>}
    {command.error && <p role="alert">{command.error}</p>}
    {command.ambiguous && <div><button className="button" disabled={command.busy} onClick={() => void command.recover()}>Recover this attempt without resubmitting</button><details className="transfer-evidence-fields"><summary>Attempt reference</summary><code>{command.pendingKey}</code></details></div>}
    {command.requiresCorrection && <button className="button refresh-icon-button" onClick={onRefresh}><RefreshIcon/>Refresh reservation before continuing</button>}
    {command.command && <CommandStatusCard command={command.command} pollError={command.pollError} summary={{complete:submittedAction?completedLabels[submittedAction]:"Transfer updated"}} onClear={() => {command.clear(); setAction(undefined); onRefresh();}}/>}
    {reservation && reservation.purpose === "TRANSFER" && ["DISPATCHED", "IN_TRANSIT", "DELAYED", "RECEIVED", "COMPROMISED"].includes(reservation.status) && <details className="transfer-evidence-fields"><summary>Handover and receipt locations</summary><ReservationLocationAudit reservationId={reservation.reservationId} version={reservation.version}/></details>}
  </section>;
}
