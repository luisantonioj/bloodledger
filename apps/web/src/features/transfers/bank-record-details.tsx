import type { ReactNode } from "react";
import type { Principal } from "../../auth/permissions";
import { formatBloodType, formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import type { RecordSelection, SelectedRecord } from "../../services/api/v2-navigation";
import { componentLabel, facilityLabel } from "./requester-transfer-data";

function DetailRows({rows}: {rows: [string, ReactNode][]}) {
  return <dl className="bank-review-kv">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
function Reference({value}: {value: string | null}) {
  return value ? <span className="bank-review-reference mono" title={value}>{value}</span> : <span className="bank-review-muted">Not available</span>;
}
export function BankRecordDetails({record, principal, open}: {record: SelectedRecord; principal: Principal; open: (kind: RecordSelection["kind"], id: string) => void}) {
  if (record.kind === "component") return null;
  const request = record.kind === "request" ? record.value : undefined;
  const transfer = record.kind === "reservation" ? record.value : undefined;
  const id = request?.transfer_id ?? transfer!.reservationId;
  const status = request?.status ?? transfer!.status;
  const unavailable = <span className="bank-review-muted">Not available</span>;
  const stages = ["Reserved", "Prepared", "Dispatched", "In transit", "Received"];
  const stage = {ACTIVE:0, RESERVED:0, PREPARED:1, DISPATCHED:2, IN_TRANSIT:3, RECEIVED:4}[status as "RESERVED"];
  return <div className="bank-review-content">
    <div className="bank-review-identity"><div><Reference value={id}/><small>{request ? "Blood request" : transfer!.purpose === "LOCAL_RELEASE" ? "Local release reservation" : "Transfer record"}</small></div><span className={statusClassName(status)}>{humanizeCode(status)}</span></div>
    {request && <>
      <DetailRows rows={[
        ["Requesting Facility", facilityLabel(request.destination_institution_id, principal)],
        ["Supplying Blood Bank", facilityLabel(request.source_institution_id, principal)],
        ["Blood type", formatBloodType(request.blood_type)], ["Component", componentLabel(request.component_type)],
        ["Requested units", <strong>{request.quantity} unit(s)</strong>],
        ["Ledger reference", request.ledger_transaction_id ? <Reference value={request.ledger_transaction_id}/> : <span className="bank-review-muted">Awaiting ledger confirmation</span>]
      ]}/>
      <section className="bank-review-section"><h3>Requester and clinical details</h3><DetailRows rows={[["Required By", unavailable],["Requested By", unavailable],["Attending Physician", unavailable],["Case Reference", unavailable],["Authorized Pickup", unavailable],["Supporting Documents", unavailable],["Notes", unavailable]]}/></section>
    </>}
    {transfer && <>
      <DetailRows rows={[
        ["From", facilityLabel(transfer.sourceInstitutionId, principal)],
        ["To", transfer.destinationInstitutionId ? facilityLabel(transfer.destinationInstitutionId, principal) : "Local release"],
        ["Purpose", humanizeCode(transfer.purpose)],
        ["Preparation evidence", transfer.preparedEvidencePresent ? "Recorded" : "Not recorded"]
      ]}/>
      {transfer.purpose === "TRANSFER" && <section className="bank-review-section"><h3>Transfer Progress</h3><ol className="bank-review-progress" aria-label="Current transfer stage">{stages.map((label,index) => <li key={label} className={stage === index ? "current" : ""} aria-current={stage === index ? "step" : undefined}><span aria-hidden="true">{index+1}</span><small>{label}</small></li>)}</ol></section>}
      <section className="bank-review-section"><h3>Transfer Lifecycle Summary</h3><DetailRows rows={[
        ["Request Reference", transfer.transferId ? <button className="bank-review-link mono" onClick={() => open("request", transfer.transferId!)} title={transfer.transferId}>{transfer.transferId}</button> : unavailable],
        ["Prepared At", transfer.preparedAt ? formatManilaDateTime(transfer.preparedAt) : unavailable],
        ["Last Updated", formatManilaDateTime(transfer.updatedAt)],
        ["Version", transfer.version]
      ]}/></section>
      <section className="bank-review-section"><h3>Reserved component members</h3>{transfer.components.length ? <ul className="bank-review-members">{transfer.components.map(member => <li key={member.componentId}><button className="bank-review-link mono" title={member.componentId} onClick={() => open("component", member.componentId)} aria-label={"Open member " + member.componentId}>{member.componentId}</button><small>{componentLabel(member.componentType)} · {humanizeCode(member.inventoryStatus)}</small></li>)}</ul> : <p className="bank-review-muted">No component members returned.</p>}</section>
    </>}
  </div>;
}
