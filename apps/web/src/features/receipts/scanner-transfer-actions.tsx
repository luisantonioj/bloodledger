import {useCallback,useState} from "react";
import type {Principal} from "../../auth/permissions";
import {usePagedRead} from "../../hooks/use-paged-read";
import {useValidatedRead} from "../../hooks/use-validated-read";
import {parseReservationDetail,type ReservationDetail} from "../../services/api/v2-navigation";
import {ReservationActions} from "../transfers/reservation-actions";
import {RefreshIcon} from "../../components/ui/refresh-button";
import {compactRecordReference,humanizeCode} from "../../components/ui/display";
import {facilityLabel} from "../transfers/requester-transfer-data";
import type {ScanReview} from "./scan-review-data";
const contractHeaders={"X-BloodLedger-Contract-Version":"V2.1"};
function parseList(value:unknown,principal:Principal){
 const body=value as {scope?:string;classification?:string;reservations?:Record<string,unknown>[];nextCursor?:unknown}|null;
 if(body?.scope!=="SOURCE_INSTITUTION"||body.classification!=="SIMULATION_ONLY"||!Array.isArray(body.reservations)||(body.nextCursor!==null&&(typeof body.nextCursor!=="string"||!/^RES_[A-Z0-9_-]{1,56}$/.test(body.nextCursor))))throw Error("Reservation list is invalid");
 const rows=body.reservations.map(row=>{if(typeof row.reservationId!=="string"||!/^RES_[A-Z0-9_-]{1,56}$/.test(row.reservationId)||![row.sourceInstitutionId,row.destinationInstitutionId].includes(principal.institutionId)||typeof row.status!=="string"||!Number.isSafeInteger(row.version)||Number(row.version)<1)throw Error("Reservation scope is invalid");return {reservationId:row.reservationId,status:row.status,purpose:row.purpose,sourceInstitutionId:row.sourceInstitutionId,destinationInstitutionId:row.destinationInstitutionId};});
 return {rows,nextCursor:body.nextCursor as string|null};
}
export function ScannerTransferActions({principal,review,onLockChange}:{principal:Principal;review?:ScanReview;onLockChange:(locked:boolean)=>void}){
 const notifyLock=useCallback((value:boolean)=>{setLocked(value);onLockChange(value);},[onLockChange]);
 const [selected,setSelected]=useState(""),[locked,setLocked]=useState(false);
 const list=usePagedRead("/api/v2/reservations",value=>parseList(value,principal),"reservationId",principal.accountId??principal.userId,undefined,contractHeaders);
 const detail=useValidatedRead<ReservationDetail>(selected?"/api/v2/reservations/"+encodeURIComponent(selected):null,value=>{const reservation=parseReservationDetail(value,selected,principal);if(reservation.sourceInstitutionId!==principal.institutionId||reservation.purpose!=="TRANSFER")throw Error("Not an outgoing transfer");return reservation;},contractHeaders);
 const rows=list.rows.filter(row=>row.sourceInstitutionId===principal.institutionId&&row.purpose==="TRANSFER"&&["ACTIVE","DISPATCHED","IN_TRANSIT"].includes(row.status));
 return <section className="receipt-review-card scanner-transfer-actions"><header><h3>Outgoing transfer</h3><button className="scanner-icon-btn" type="button" aria-label="Refresh outgoing transfers" disabled={locked||list.busy||detail.busy} onClick={()=>{list.refresh();detail.manual();}}><RefreshIcon/></button></header>
 <div className="scanner-transfer-controls"><label>Approved outgoing transfer<span className="requester-select"><select aria-label="Approved outgoing transfer" value={selected} disabled={locked} onChange={event=>setSelected(event.target.value)}><option value="">Select a transfer</option>{rows.map(row=><option key={row.reservationId} value={row.reservationId}>{typeof row.destinationInstitutionId==="string"?facilityLabel(row.destinationInstitutionId,principal):"Receiving facility unavailable"} · {row.status==="ACTIVE"?"Reserved":humanizeCode(row.status)} · {compactRecordReference(row.reservationId)}</option>)}</select></span></label>
 {list.nextCursor&&<button className="button compact" type="button" disabled={list.busy||locked} onClick={list.loadMore}>Load more outgoing transfers</button>}
 {(list.error||detail.error)&&<p role="status">Outgoing transfers could not be verified. Refresh before continuing.</p>}
 {list.ready&&!rows.length&&<p className="receipt-preview-note">No outgoing transfers are ready for action.</p>}
 </div>
 {detail.data&&!detail.error&&<ReservationActions key={detail.data.reservationId+":"+detail.data.version} reservation={detail.data} principal={principal} scannedRecognition={review?.verified} onRefresh={()=>{detail.manual();list.refresh();}} onLockChange={notifyLock} scanOnPhone/>}
 </section>;
}
