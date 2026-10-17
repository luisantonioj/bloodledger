import {useCallback,useEffect,useRef,useState} from "react";
import type {Principal} from "../../auth/permissions";
import {usePagedRead} from "../../hooks/use-paged-read";
import {useValidatedRead} from "../../hooks/use-validated-read";
import {parseReceiptVerification} from "../../services/api/blood-bank-completion";
import {ApiRequestError,requestJson} from "../../services/api/client";
import {mutationError} from "../../services/api/mutation-error";
import {newMutationKeys} from "../../services/api/mutation-keys";
import {parseV2Command} from "../../services/api/v2";
import {parseReservationDetail,type ReservationDetail} from "../../services/api/v2-navigation";
import {CommandStatusCard} from "../commands/command-status-card";
import {useCommandStatus} from "../commands/use-command-status";
import type {ReceiptRecognition} from "./receipt-ocr";

// ADR-049: the destination scans every in-transit unit, the server matches each Donation No. and OCR-read component,
// and `receive` references the returned RCV_ evidence. Operations enable this only with an API that has ADR-049.
export const receiptVerificationReady=import.meta.env.VITE_BLOODLEDGER_RECEIPT_VERIFICATION_READY==="true";
const contractHeaders={"X-BloodLedger-Contract-Version":"V2.1"};
type ScannedLabel={donationNumber:string;componentType:string};
type Evidence=ReturnType<typeof parseReceiptVerification>;

function parseIncoming(value:unknown,principal:Principal){
 const body=value as {scope?:string;classification?:string;reservations?:Record<string,unknown>[];nextCursor?:unknown}|null;
 if(!["SOURCE_INSTITUTION","DESTINATION_INSTITUTION"].includes(String(body?.scope))||body?.classification!=="SIMULATION_ONLY"||!Array.isArray(body.reservations)||(body.nextCursor!==null&&(typeof body.nextCursor!=="string"||!/^RES_[A-Z0-9_-]{1,56}$/.test(body.nextCursor))))throw Error("Reservation list is invalid");
 const rows=body.reservations.map(row=>{if(typeof row.reservationId!=="string"||!/^RES_[A-Z0-9_-]{1,56}$/.test(row.reservationId)||![row.sourceInstitutionId,row.destinationInstitutionId].includes(principal.institutionId)||typeof row.status!=="string")throw Error("Reservation scope is invalid");return {reservationId:row.reservationId,status:row.status,purpose:row.purpose,destinationInstitutionId:row.destinationInstitutionId};});
 return {rows,nextCursor:body.nextCursor as string|null};
}
// Counts only; a mismatch never shows another unit's label.
export function receiptFailure(reason:unknown){
 if(reason instanceof ApiRequestError){
  if(reason.code==="RECEIPT_LABELS_MISMATCH"){const counts=/^Scanned labels do not match the in-transit units: (\d+) of (\d+) matched, (\d+) unmatched, (\d+) missing\.$/.exec(reason.message);return counts?`${counts[1]} of ${counts[2]} matched; ${counts[3]} unmatched; ${counts[4]} missing. Review all scanned units.`:"Scanned units do not match the incoming transfer. Review and rescan all units.";}
  if(reason.code==="RECEIPT_EVIDENCE_INVALID")return "The receipt evidence no longer matches this transfer. Refresh and verify every unit again.";
  if(reason.code==="RECEIPT_VERIFICATION_REQUIRED")return "Verify every incoming unit before receiving this transfer.";
  if(reason.code==="RESERVATION_VERSION_CONFLICT"||reason.code==="RESERVATION_TRANSITION_INVALID")return "The transfer changed. Refresh its details before scanning again.";
  if(reason.status===401||reason.status===403)return "The current operator is not authorized to receive this transfer.";
  if(reason.status===404)return "This transfer is unavailable for receipt.";
  if(reason.status===409)return "The receipt conflicts with the current transfer or saved attempt. Refresh and review before continuing.";
  if(reason.status>=400&&reason.status<500)return "The receipt was not accepted. Check the scanned units and transfer.";
 }
 return "The outcome could not be confirmed. Retry the saved attempt explicitly; nothing new is sent.";
}
const definitive=(reason:unknown)=>reason instanceof ApiRequestError&&reason.status>=400&&reason.status<500&&reason.code!=="AUTH_CONTEXT_CHANGED";
const cancelled=(reason:unknown)=>reason instanceof Error&&reason.message==="Operator verification cancelled. The command was not sent.";

export function IncomingReceipt({principal,scannedRecognition,onLockChange}:{principal:Principal;scannedRecognition?:ReceiptRecognition;onLockChange:(locked:boolean)=>void}){
 const [selected,setSelected]=useState(""),[childLocked,setChildLocked]=useState(false);
 // The receive command outlives the verification panel: once it commits, the transfer leaves IN_TRANSIT.
 const status=useCommandStatus(),locked=childLocked||Boolean(status.command);
 const notifyLock=useCallback((value:boolean)=>setChildLocked(value),[]);
 useEffect(()=>{onLockChange(locked);},[locked,onLockChange]);
 useEffect(()=>()=>onLockChange(false),[onLockChange]);
 const list=usePagedRead(receiptVerificationReady?"/api/v2/reservations":null,value=>parseIncoming(value,principal),"reservationId",principal.accountId??principal.userId,undefined,contractHeaders);
 const detail=useValidatedRead<ReservationDetail>(selected?"/api/v2/reservations/"+encodeURIComponent(selected):null,value=>{const reservation=parseReservationDetail(value,selected,principal);if(reservation.destinationInstitutionId!==principal.institutionId||reservation.purpose!=="TRANSFER")throw Error("Not an incoming transfer");return reservation;},contractHeaders);
 const rows=list.rows.filter(row=>row.destinationInstitutionId===principal.institutionId&&row.purpose==="TRANSFER"&&row.status==="IN_TRANSIT");
 const refresh=()=>{list.refresh();detail.manual();};
 if(!receiptVerificationReady)return null;
 return <section className="receipt-review-card scanner-transfer-actions"><header><h3>Incoming transfer</h3></header>
  <div className="scanner-transfer-controls"><label>In-transit incoming transfer<span className="requester-select"><select aria-label="In-transit incoming transfer" value={selected} disabled={locked} onChange={event=>setSelected(event.target.value)}><option value="">Select a transfer</option>{rows.map(row=><option key={row.reservationId} value={row.reservationId}>{row.reservationId}</option>)}</select></span></label>
  <p className="receipt-preview-note">Scan every unit of the transfer, verify them together, then receive. Receipt records RECEIVED stock; it does not make the units usable.</p>
  {list.nextCursor&&<button className="button compact" type="button" disabled={list.busy||locked} onClick={list.loadMore}>Load more transfers</button>}
  {(list.error||detail.error)&&<p role="status">Incoming transfers could not be verified. Refresh before continuing.</p>}
  <button className="button compact" type="button" disabled={locked||list.busy||detail.busy} onClick={refresh}>Refresh incoming transfers</button>
  {list.ready&&!rows.length&&<p className="receipt-preview-note">No in-transit incoming transfers in the loaded records.</p>}
  </div>
  {status.command?<CommandStatusCard command={status.command} pollError={status.pollError} onClear={()=>{status.clear();refresh();}}/>
   :detail.data&&!detail.error&&detail.data.status==="IN_TRANSIT"&&<ReceiptVerification key={detail.data.reservationId+":"+detail.data.version} reservation={detail.data} scannedRecognition={scannedRecognition} onAccepted={status.accept} onLockChange={notifyLock}/>}
</section>;
}

function ReceiptVerification({reservation,scannedRecognition,onAccepted,onLockChange}:{reservation:ReservationDetail;scannedRecognition?:ReceiptRecognition;onAccepted:(command:ReturnType<typeof parseV2Command>)=>void;onLockChange:(locked:boolean)=>void}){
 const [image,setImage]=useState<File>(),[recognition,setRecognition]=useState<ReceiptRecognition>(),[labels,setLabels]=useState<ScannedLabel[]>([]),[confirmed,setConfirmed]=useState(false),[reading,setReading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [evidence,setEvidence]=useState<Evidence>(),[verifyFrozen,setVerifyFrozen]=useState(false),[receiveFrozen,setReceiveFrozen]=useState(false);
 const active=useRef(true),controller=useRef<AbortController|null>(null),timeRejects=useRef(0);
 const verifyAttempt=useRef<{keys:ReturnType<typeof newMutationKeys>;body:{expectedVersion:number;correlationId:string;scannedLabels:ScannedLabel[]}}|null>(null);
 const receiveAttempt=useRef<{keys:ReturnType<typeof newMutationKeys>;body:{correlationId:string;eventTime:string;expectedVersion:number;receiptEvidenceId:string;receiptEvidenceDigest:string}}|null>(null);
 const members=reservation.components.length,locked=busy||verifyFrozen||receiveFrozen;
 useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{onLockChange(locked);},[locked,onLockChange]);
 useEffect(()=>{if(!locked){controller.current?.abort();setRecognition(scannedRecognition);setConfirmed(false);setError("");}},[scannedRecognition]);
 async function ocr(){
  if(!image||locked||reading)return;const abort=new AbortController();controller.current=abort;setReading(true);setError("");setRecognition(undefined);setConfirmed(false);
  try{const {recognizeReceiptLabel}=await import("./receipt-ocr");const value=await recognizeReceiptLabel(image,abort.signal,()=>{});if(active.current)setRecognition(value);}
  catch{if(active.current&&!abort.signal.aborted)setError("The label could not be read confidently. Use a clear image of the supported five-field label.");}
  finally{if(active.current)setReading(false);}
 }
 function add(){
  if(!recognition||!confirmed||locked||labels.length>=members)return;
  const label={donationNumber:recognition.label.donationNumber,componentType:recognition.label.componentType};
  if(labels.some(entry=>entry.donationNumber===label.donationNumber&&entry.componentType===label.componentType)){setError("This label has already been added.");return;}
  setLabels([...labels,label]);setRecognition(undefined);setImage(undefined);setConfirmed(false);setError("");
 }
 async function verify(){
  if(busy||evidence||(!verifyFrozen&&labels.length!==members))return;
  if(!verifyAttempt.current){const keys=newMutationKeys();verifyAttempt.current={keys,body:{expectedVersion:reservation.version,correlationId:keys.correlationId,scannedLabels:[...labels]}};}
  const saved=verifyAttempt.current;setBusy(true);setError("");
  try{
   const result=parseReceiptVerification(await requestJson<unknown>(`/api/v2/reservations/${encodeURIComponent(reservation.reservationId)}/receipt-verifications`,{method:"POST",headers:{"Idempotency-Key":saved.keys.idempotencyKey},body:JSON.stringify(saved.body)}),reservation.reservationId,saved.body.expectedVersion);
   const expected=reservation.components.map(member=>member.componentId).sort();if(JSON.stringify([...result.componentIds].sort())!==JSON.stringify(expected))throw Error("Evidence membership mismatch");
   if(active.current){setEvidence(result);setVerifyFrozen(false);setLabels([]);verifyAttempt.current=null;}
  }catch(reason){
   if(!active.current)return;
   // A cancelled first verification sent nothing; an already ambiguous attempt stays frozen for an explicit retry.
   if(definitive(reason)||(cancelled(reason)&&!verifyFrozen))verifyAttempt.current=null;
   setVerifyFrozen(Boolean(verifyAttempt.current));setError(cancelled(reason)?(verifyFrozen?"Operator verification cancelled. The saved verification stays frozen; nothing was sent.":"Operator verification cancelled. Nothing was sent."):receiptFailure(reason));
  }
  finally{if(active.current)setBusy(false);}
 }
 async function receive(){
  if(busy||!evidence)return;
  if(!receiveAttempt.current){const keys=newMutationKeys();receiveAttempt.current={keys,body:{correlationId:keys.correlationId,eventTime:new Date().toISOString(),expectedVersion:reservation.version,receiptEvidenceId:evidence.evidenceId,receiptEvidenceDigest:evidence.evidenceDigest}};}
  const saved=receiveAttempt.current;setBusy(true);setError("");
  try{
   const command=parseV2Command(await requestJson<unknown>(`/api/v2/reservations/${encodeURIComponent(reservation.reservationId)}/receive`,{method:"POST",headers:{"Idempotency-Key":saved.keys.idempotencyKey,...contractHeaders},body:JSON.stringify(saved.body)}));
   if(command.resourceType!=="TRANSFER"||command.resourceId!==reservation.reservationId||command.correlationId!==saved.body.correlationId||command.statusUrl!=="/api/v2/commands/"+command.commandId)throw Error("Command identity mismatch");
   receiveAttempt.current=null;if(active.current){setReceiveFrozen(false);setEvidence(undefined);}onAccepted(command);
  }catch(reason){
   if(!active.current)return;const failure=mutationError(reason,timeRejects.current);if(failure.timeRejected)timeRejects.current++;
   if(failure.discardAttempt||definitive(reason)||(cancelled(reason)&&!receiveFrozen))receiveAttempt.current=null;
   // Evidence bound to a stale version cannot be reused; verify every unit again.
   if(reason instanceof ApiRequestError&&["RECEIPT_EVIDENCE_INVALID","RESERVATION_VERSION_CONFLICT","RESERVATION_TRANSITION_INVALID"].includes(String(reason.code)))setEvidence(undefined);
   setReceiveFrozen(Boolean(receiveAttempt.current));setError(cancelled(reason)?(receiveFrozen?"Operator verification cancelled. The saved receipt stays frozen; nothing was sent.":"Operator verification cancelled. Nothing was sent."):failure.timeRejected?failure.message:receiptFailure(reason));
  }finally{if(active.current)setBusy(false);}
 }
 return <section className="bank-record-card" aria-label="Receipt label verification">
  <h4>Scan incoming units</h4>
  <fieldset disabled={locked||Boolean(evidence)}>
   <label>Incoming-unit label image<input type="file" accept="image/png,image/jpeg" capture="environment" disabled={reading} onChange={event=>{const file=event.target.files?.[0];controller.current?.abort();setRecognition(undefined);setConfirmed(false);setError("");setImage(undefined);if(file&&["image/png","image/jpeg"].includes(file.type)&&file.size<=10*1024*1024)setImage(file);else if(file)setError("Choose a JPG or PNG image up to 10 MB.");event.target.value="";}}/></label>
   <button className="button compact" type="button" disabled={!image||reading} onClick={()=>void ocr()}>{reading?"Reading…":"Run OCR"}</button>
   {recognition&&<><p>Five label fields passed OCR checks. The label value is not displayed or persisted.</p><label><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I checked the recognized label against this incoming unit.</label><button className="button compact" type="button" disabled={!confirmed||labels.length>=members} onClick={add}>Add scanned unit</button></>}
   <p>{evidence?"All incoming units verified · Off-chain evidence returned":`${labels.length} of ${members} incoming units scanned`}</p>
   {!!labels.length&&<button className="button compact" type="button" onClick={()=>{setLabels([]);setError("");}}>Clear scans</button>}
  </fieldset>
  {!evidence&&<button className="button compact primary" type="button" disabled={busy||reading||(!verifyFrozen&&labels.length!==members)} onClick={()=>void verify()}>{busy?"Verifying…":verifyFrozen?"Retry same verification":"Verify scanned units"}</button>}
  {evidence&&<button className="button compact primary" type="button" disabled={busy} onClick={()=>void receive()}>{busy?"Receiving…":receiveFrozen?"Retry same receipt":"Receive transfer"}</button>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
