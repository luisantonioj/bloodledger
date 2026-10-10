import { canAct, type Principal } from "../../auth/permissions";
import type { RecordSelection, SelectedRecord } from "../../services/api/v2-navigation";
import { InformationHelp } from "../../components/ui/information-help";

export function BankRecordActions({record, principal, reservations, open}: {record: SelectedRecord; principal: Principal; reservations: {reservation_id: string; transfer_id: string | null}[]; open: (kind: RecordSelection["kind"], id: string) => void}) {
  if (record.kind === "component") return null;
  const request = record.kind === "request" ? record.value : undefined;
  const transfer = record.kind === "reservation" ? record.value : undefined;
  const linked = request ? reservations.find(row => row.transfer_id === request.transfer_id) : undefined;
  const supplying = (request?.source_institution_id ?? transfer?.sourceInstitutionId) === principal.institutionId;
  const receiving = (request?.destination_institution_id ?? transfer?.destinationInstitutionId) === principal.institutionId;
  const pending = request && ["REQUESTED", "SUBMITTED", "PENDING"].includes(request.status);
  if (transfer) return receiving && transfer.status === "IN_TRANSIT" && canAct(principal, "inventory:capture") ? <section className="bank-detail-actions"><a className="button" href="/transactions">Record inbound receipt by label</a><p>Use the existing verified OCR flow for bank receipt. Received stock remains RECEIVED.</p></section> : null;
  const blocked = "This action is unavailable until its verified workflow and operator authorization are connected.";
  return <section className="bank-detail-actions">
    {request && <>
      {linked && <button className="button compact" onClick={() => open("reservation", linked.reservation_id)}>View linked transfer</button>}
    </>}
    {pending && <>
      <header><h3>Actions</h3><InformationHelp label="Record actions">Request cancellation, partial offers and approval need verified decision commands. Transfer receipt and outbound scan must match the reservation, custody state and authorized operator. These controls remain unavailable here until that integration is complete.</InformationHelp></header>
      <div className="bank-detail-action-buttons">
        {pending && <button className="button compact" disabled title={blocked}>Cancel Request</button>}
        {pending && supplying && request.quantity > 1 && <button className="button compact" disabled title={blocked}>Offer Available Units</button>}
        {pending && supplying && <button className="button primary compact" disabled title={blocked}>Approve Transfer</button>}
      </div><p className="bank-action-note">Request decision actions are awaiting an approved backend contract.</p>
    </>}
  </section>;
}
