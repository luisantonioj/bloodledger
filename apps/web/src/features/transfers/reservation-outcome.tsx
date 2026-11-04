import type {Principal} from "../../auth/permissions";
import type {ReservationDetail} from "../../services/api/v2-navigation";
import {parseReservationDetail} from "../../services/api/v2-navigation";
import {useValidatedRead} from "../../hooks/use-validated-read";
import {humanizeCode,formatManilaDateTime} from "../../components/ui/display";
export function ReservationOutcome({reservation}:{reservation:ReservationDetail}){
 return <section className="bank-review-section" aria-label="Approval and receipt outcome"><h3>Approved supply</h3><dl className="bank-review-kv"><div><dt>Requested units</dt><dd>{reservation.requestedQuantity??"Not recorded"}</dd></div><div><dt>Approved units</dt><dd>{reservation.approvedQuantity??"Not recorded for this historical approval"}</dd></div><div><dt>Shortfall (closed)</dt><dd>{reservation.shortfallQuantity??"Not recorded"}</dd></div>{reservation.partialApproval&&<div><dt>Partial approval reason</dt><dd>{humanizeCode(reservation.partialApproval.reasonCode)}</dd></div>}</dl>{reservation.receiptDiscrepancy&&<section className="receipt-discrepancy" aria-label="Receipt discrepancy"><h4>Receipt discrepancy · {humanizeCode(reservation.receiptDiscrepancy.status)}</h4><p>{reservation.receiptDiscrepancy.matchedUnits} of {reservation.receiptDiscrepancy.expectedUnits} matched · {reservation.receiptDiscrepancy.unmatchedLabels} unmatched · {reservation.receiptDiscrepancy.missingUnits} missing</p><p>{reservation.receiptDiscrepancy.status==="OPEN"?"Receipt blocked until a matching recount or compromise resolution.":"Resolved: "+humanizeCode(reservation.receiptDiscrepancy.resolutionCode??"")}</p><small>Recorded {formatManilaDateTime(reservation.receiptDiscrepancy.recordedAt)}</small></section>}</section>;
}
export function LinkedReservationOutcome({reservationId,principal}:{reservationId:string;principal:Principal}){
 const state=useValidatedRead("/api/v2/reservations/"+encodeURIComponent(reservationId),value=>parseReservationDetail(value,reservationId,principal),{"X-BloodLedger-Contract-Version":"V2.1"});
 return state.data?<ReservationOutcome reservation={state.data}/>:<p role="status">{state.error?"Approval outcome unavailable. Refresh the request details.":"Loading approval outcome…"}</p>;
}
