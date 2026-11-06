import {ReservationOutcome,LinkedReservationOutcome} from "./reservation-outcome";
import type { Principal } from "../../auth/permissions";
import { formatBloodType, formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import type { RecordSelection, SelectedRecord } from "../../services/api/v2-navigation";
import { componentLabel, facilityLabel } from "./requester-transfer-data";
import { RequestDetailPanel } from "./request-detail-panel";

function Reference({value}: {value: string | null}) {
  return value ? <span className="bank-review-reference mono" title={value}>{value}</span> : <span className="bank-review-muted">Not available</span>;
}
export function BankRecordDetails({record, principal, open}: {record: SelectedRecord; principal: Principal; open: (kind: RecordSelection["kind"], id: string) => void}) {
  if (record.kind === "component") return null;
  if (record.kind === "request") {
    const request = record.value;
    return <div className="bank-review-content bank-detail-overview">
      <div className="bank-detail-grid">
        <section className="bank-detail-summary" aria-label="Blood request">
          <header><h3>Blood request</h3></header>
          <dl>
            <dt>Request ID</dt><dd><Reference value={request.transfer_id}/></dd>
            <dt>Requesting facility</dt><dd>{facilityLabel(request.destination_institution_id, principal)}</dd>
            <dt>Supplying blood bank</dt><dd>{facilityLabel(request.source_institution_id, principal)}</dd>
            <dt>Blood type</dt><dd>{formatBloodType(request.blood_type)}</dd>
            <dt>Component</dt><dd>{componentLabel(request.component_type)}</dd>
            <dt>Requested units</dt><dd><strong>{request.quantity}</strong></dd>
            <dt>Reservation status</dt><dd>{request.reservation_status ? humanizeCode(request.reservation_status) : "Not reserved"}</dd>
            <dt>Ledger reference</dt><dd>{request.ledger_transaction_id ? <Reference value={request.ledger_transaction_id}/> : <span className="bank-review-muted">Awaiting ledger confirmation</span>}</dd>
          </dl>
          {request.reservation_id&&<LinkedReservationOutcome reservationId={request.reservation_id} principal={principal}/>}
        </section>
        <RequestDetailPanel key={request.transfer_id} transferId={request.transfer_id}/>
      </div>
    </div>;
  }
  const transfer = record.value;
  const status = transfer.status;
  const unavailable = <span className="bank-review-muted">Not available</span>;
  const stages = ["Reserved", "Prepared", "Dispatched", "In transit", "Received"];
  const stage = status === "ACTIVE" && transfer.preparedEvidencePresent ? 1 : {ACTIVE:0, RESERVED:0, PREPARED:1, DISPATCHED:2, IN_TRANSIT:3, RECEIVED:4}[status as "RESERVED"];
  const requestId = transfer.transferId;
  return <div className="bank-review-content bank-detail-overview">
    <div className="bank-detail-grid">
      <section className="bank-detail-summary" aria-label="Transfer summary">
        <header><h3>Transfer summary</h3></header>
        <dl>
          <dt>Transfer ID</dt><dd><Reference value={transfer.reservationId}/></dd>
          {requestId&&<><dt>Request ID</dt><dd><button className="bank-review-link mono" onClick={() => open("request", requestId)} title={requestId}>{requestId}</button></dd></>}
          {transfer.localReleaseId&&<><dt>Local release ID</dt><dd><Reference value={transfer.localReleaseId}/></dd><dt>Record type</dt><dd>Local release reservation</dd></>}
          <dt>From</dt><dd>{facilityLabel(transfer.sourceInstitutionId, principal)}</dd>
          <dt>To</dt><dd>{transfer.destinationInstitutionId ? facilityLabel(transfer.destinationInstitutionId, principal) : "Local release"}</dd>
          <dt>Status</dt><dd><span className={statusClassName(status)}>{humanizeCode(status)}</span></dd>
          <dt>Preparation evidence</dt><dd>{transfer.preparedEvidencePresent ? "Recorded" : "Not recorded"}</dd>
          <dt>Prepared at</dt><dd>{transfer.preparedAt ? formatManilaDateTime(transfer.preparedAt) : unavailable}</dd>
          <dt>Last updated</dt><dd>{formatManilaDateTime(transfer.updatedAt)}</dd>
        </dl>
      </section>
      <ReservationOutcome reservation={transfer} className="bank-detail-summary"/>
    </div>
    {transfer.purpose === "TRANSFER" && <section className="bank-review-section"><h3>Transfer progress</h3><ol className="bank-review-progress" aria-label="Current transfer stage">{stages.map((label,index) => <li key={label} className={stage === index ? "current" : ""} aria-current={stage === index ? "step" : undefined}><span aria-hidden="true">{index+1}</span><small>{label}</small></li>)}</ol></section>}
    <details className="bank-transfer-units">
      <summary>Reserved units <span>{transfer.components.length}</span></summary>
      {transfer.components.length ? <ul className="bank-review-members">{transfer.components.map(member => <li key={member.componentId}><button className="bank-review-link mono" title={member.componentId} onClick={() => open("component", member.componentId)} aria-label={"Open member " + member.componentId}>{member.componentId}</button><small>{componentLabel(member.componentType)} · {humanizeCode(member.inventoryStatus)}</small></li>)}</ul> : <p className="bank-review-muted">No reserved units were returned.</p>}
    </details>
  </div>;
}
