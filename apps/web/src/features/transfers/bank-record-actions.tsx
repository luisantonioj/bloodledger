import type { ReactNode } from "react";
import { ActionButton } from "../../components/ui/action-button";
import { canAct, type Principal } from "../../auth/permissions";
import type { RecordSelection, SelectedRecord } from "../../services/api/v2-navigation";
import { InformationHelp } from "../../components/ui/information-help";

export function BankRecordActions({record, principal, reservations, open, approval}: {approval?: ReactNode; record: SelectedRecord; principal: Principal; reservations: {reservation_id: string; transfer_id: string | null}[]; open: (kind: RecordSelection["kind"], id: string) => void}) {
  if (record.kind === "component") return null;
  const request = record.kind === "request" ? record.value : undefined;
  const transfer = record.kind === "reservation" ? record.value : undefined;
  const linked = request ? reservations.find(row => row.transfer_id === request.transfer_id) : undefined;
  const supplying = (request?.source_institution_id ?? transfer?.sourceInstitutionId) === principal.institutionId;
  const receiving = (request?.destination_institution_id ?? transfer?.destinationInstitutionId) === principal.institutionId;
  const pending = request && (request.decision_state ? request.decision_state==="AWAITING_DECISION" : ["REQUESTED", "SUBMITTED", "PENDING"].includes(request.status));
  if (transfer) return receiving && transfer.status === "IN_TRANSIT" && canAct(principal, "inventory:capture") ? <section className="bank-detail-actions"><a className="button" href="/transactions">Record inbound receipt by label</a><p>Use the existing verified OCR flow for bank receipt. Received stock remains RECEIVED.</p></section> : null;
  const blocked = "RQ-18: request rejection, cancellation and partial offers need approved transitions. Reservation cancellation is a separate action.";
  return <section className="bank-detail-actions">
    {request && <>
      {linked && <button className="button compact" onClick={() => open("reservation", linked.reservation_id)}>View linked transfer</button>}
    </>}
    {pending && !approval && <>
      <header><h3>Actions</h3><InformationHelp label="Record actions">Check the current request and FEFO allocation before approving a redistribution match. Cancellation and partial offers remain unavailable here. Preparation, dispatch and receipt follow the permitted transfer workflow.</InformationHelp></header>
      <div className="bank-detail-action-buttons">
        {pending && <ActionButton className="button compact" disabled  unavailableReason={blocked}>Cancel Request</ActionButton>}
        {pending && supplying && request.quantity > 1 && <ActionButton className="button compact" disabled  unavailableReason={blocked}>Offer Available Units</ActionButton>}
        {pending && supplying && !approval && <ActionButton className="button primary compact" disabled  unavailableReason={blocked}>Approve Transfer</ActionButton>}
      </div>{!approval && <p className="bank-action-note">Request decision actions are awaiting an approved backend contract.</p>}
    </>}
    {approval}
  </section>;
}
