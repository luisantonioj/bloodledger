import {useEffect,useRef,useState} from "react";
import {ApiRequestError,requestJson} from "../../services/api/client";
import {newMutationKeys} from "../../services/api/mutation-keys";
import {parseOutboundVerification} from "../../services/api/blood-bank-completion";
import type {ReservationDetail} from "../../services/api/v2-navigation";
import type {ReceiptRecognition} from "../receipts/receipt-ocr";

type ScannedLabel={donationNumber:string;componentType:string};

// J2: requests use OUTBOUND_LABEL_VERIFICATION_V2, so the server also matches each label's OCR-read component (F1).
// This client check stays as a usability guard: it rejects a sibling component before anything is sent.
export function outboundComponentMatches(recognition:ReceiptRecognition|undefined,reservation:Pick<ReservationDetail,"components">){
 return Boolean(recognition&&reservation.components.length&&reservation.components.every(member=>member.componentType===recognition.label.componentType));
}
export function outboundFailure(reason:unknown){
  if(reason instanceof ApiRequestError){
    if(reason.code==="OUTBOUND_LABELS_MISMATCH"){
      const counts=/^Scanned labels do not match the reserved units: (\d+) of (\d+) matched, (\d+) unmatched, (\d+) missing\.$/.exec(reason.message);
      return counts?`${counts[1]} of ${counts[2]} matched; ${counts[3]} unmatched; ${counts[4]} missing. Review all scanned units.`:"Scanned units do not match the reservation. Review and rescan all units.";
    }
    if(reason.code==="RESERVATION_VERSION_CONFLICT"||reason.code==="VERSION_CONFLICT")return "The reservation changed. Refresh its details before scanning again.";
    if(reason.status===401||reason.status===403)return "The current operator is not authorized to verify this reservation.";
    if(reason.status===404)return "This reservation is unavailable for outbound verification.";
    if(reason.status===409)return "Verification conflicts with the current reservation or saved attempt. Refresh and review before continuing.";
    if(reason.status>=400&&reason.status<500)return "Verification was not accepted. Check the scanned units and reservation.";
  }
  return "Verification could not be confirmed. Retry the saved attempt explicitly; do not prepare until evidence is returned.";
}
export function OutboundVerification({reservation,onVerified,onLockChange,scannedRecognition}:{scannedRecognition?:ReceiptRecognition;reservation:ReservationDetail;onVerified:(result:ReturnType<typeof parseOutboundVerification>)=>void;onLockChange:(locked:boolean)=>void}){
  // Operations must explicitly enable this after the separately approved host migration.
  const enabled=import.meta.env.VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY==="true";
  const [progress,setProgress]=useState(0);
  const chooser=useRef<HTMLInputElement>(null),cameraChooser=useRef<HTMLInputElement>(null);
  const [image,setImage]=useState<File>(),[recognition,setRecognition]=useState<ReceiptRecognition>(),[labels,setLabels]=useState<ScannedLabel[]>([]),[confirmed,setConfirmed]=useState(false),[reading,setReading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState(false),[ambiguous,setAmbiguous]=useState(false);
  const active=useRef(true),controller=useRef<AbortController|null>(null),attempt=useRef<{keys:ReturnType<typeof newMutationKeys>;body:{policyVersion:"OUTBOUND_LABEL_VERIFICATION_V2";expectedVersion:number;correlationId:string;scannedLabels:ScannedLabel[]}}|null>(null),verifyRef=useRef<()=>void>(()=>{});
  useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();};},[]);
  const locked=busy||ambiguous;
  useEffect(()=>{if(!image)return;void ocr(image);return()=>controller.current?.abort();},[image]);
  function changeImage(file?:File){
    if(locked||done)return;controller.current?.abort();setReading(false);setRecognition(undefined);setConfirmed(false);setError("");setImage(undefined);setProgress(0);
    if(!file)return;
    if(!["image/png","image/jpeg"].includes(file.type)||file.size>10*1024*1024){setError("Choose a JPG or PNG image up to 10 MB.");return;}
    setImage(file);
  }
  const componentMatches=outboundComponentMatches(recognition,reservation);
  useEffect(()=>{if(!locked&&!done){controller.current?.abort();setReading(false);setRecognition(scannedRecognition);setConfirmed(false);setError("");}},[scannedRecognition]);
  useEffect(()=>{onLockChange(locked);},[locked,onLockChange]);
  async function ocr(file:File){
    if(locked||done)return;const abort=new AbortController();controller.current=abort;setReading(true);setError("");setRecognition(undefined);setConfirmed(false);
    try{const {recognizeReceiptLabel}=await import("../receipts/receipt-ocr");const value=await recognizeReceiptLabel(file,abort.signal,value=>{if(active.current&&!abort.signal.aborted)setProgress(value);});if(active.current&&!abort.signal.aborted)setRecognition(value);}
    catch{if(active.current&&!abort.signal.aborted)setError("The label could not be read confidently. Use a clear image of the supported five-field label.");}
    finally{if(active.current&&controller.current===abort)setReading(false);}
  }
  function add(){if(!recognition||!confirmed||locked||!outboundComponentMatches(recognition,reservation))return;const label={donationNumber:recognition.label.donationNumber,componentType:recognition.label.componentType};if(labels.some(entry=>entry.donationNumber===label.donationNumber&&entry.componentType===label.componentType)){setError("This label has already been added.");return;}setLabels([...labels,label]);setRecognition(undefined);setImage(undefined);setConfirmed(false);setError("");}
  async function verify(){
    if(!enabled||busy||done||(!ambiguous&&labels.length!==reservation.components.length))return;
    if(!attempt.current){const keys=newMutationKeys();attempt.current={keys,body:{policyVersion:"OUTBOUND_LABEL_VERIFICATION_V2",expectedVersion:reservation.version,correlationId:keys.correlationId,scannedLabels:[...labels]}};}
    const saved=attempt.current;setBusy(true);setError("");
    try{
      const result=parseOutboundVerification(await requestJson<unknown>(`/api/v2/reservations/${encodeURIComponent(reservation.reservationId)}/outbound-verifications`,{method:"POST",headers:{"Idempotency-Key":saved.keys.idempotencyKey},body:JSON.stringify(saved.body)}),reservation.reservationId,saved.body.expectedVersion,"OUTBOUND_LABEL_VERIFICATION_V2");
      const expected=reservation.components.map(member=>member.componentId).sort();if(JSON.stringify([...result.componentIds].sort())!==JSON.stringify(expected))throw Error("Evidence membership mismatch");
      if(active.current){onVerified(result);setDone(true);setAmbiguous(false);setLabels([]);attempt.current=null;}
    }catch(reason){if(active.current){setError(outboundFailure(reason));const uncertain=!(reason instanceof ApiRequestError)||reason.status>=500;setAmbiguous(uncertain);if(!uncertain)attempt.current=null;}}
    finally{if(active.current)setBusy(false);}
  }
  verifyRef.current=()=>void verify();
  useEffect(()=>{if(enabled&&!done&&!busy&&!ambiguous&&labels.length>0&&labels.length===reservation.components.length&&labels.length<=50)verifyRef.current();},[labels,done,busy,ambiguous,enabled,reservation.components.length]);
  return <section className="bank-record-card outbound-label-verification" aria-label="Outbound label verification">
    <h4>Scan reserved units</h4>
    {reservation.components.length>50&&<p role="status">This transfer has more than 50 units and can’t be verified here. Contact your administrator.</p>}
    {!enabled&&<p role="status">Label verification is unavailable here. You can use existing preparation evidence if you already have it.</p>}
    <fieldset disabled={!enabled||locked||done}>
      <input ref={cameraChooser} type="file" accept="image/*" capture="environment" hidden aria-label="Reserved-unit label camera" disabled={reading} onChange={event=>{changeImage(event.target.files?.[0]);event.target.value="";}}/>
      <input ref={chooser} type="file" accept="image/png,image/jpeg" hidden aria-label="Reserved-unit label image" disabled={reading} onChange={event=>{changeImage(event.target.files?.[0]);event.target.value="";}}/>
      <div className="bank-scanner-direction-options receipt-scan-options"><button className="bank-scanner-direction-option" type="button" disabled={reading} onClick={()=>{setConfirmed(false);cameraChooser.current?.click();}}><span aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span><strong>Take photo</strong><small>Open camera</small></button><button className="bank-scanner-direction-option" type="button" disabled={reading} onClick={()=>{chooser.current?.click();}}><span aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></span><strong>Choose image</strong><small>Browse gallery</small></button></div>
      {image&&<div className="receipt-capture-actions"><button className="button compact" type="button" onClick={()=>changeImage()}>Clear image</button></div>}
      {reading&&<p className="receipt-preview-note" role="status">Reading label · {progress}%</p>}
      {recognition&&!componentMatches&&<p role="alert">The label’s component doesn’t match this transfer. Scan the correct unit.</p>}
      {recognition&&componentMatches&&<div className="transfer-scan-review"><p>Label read. Check it against the reserved unit.</p><label><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I checked the recognized label against this reserved unit.</label><button className="button compact" type="button" disabled={!confirmed||labels.length>=Math.min(50,reservation.components.length)} onClick={add}>Add scanned unit</button></div>}
      {!!labels.length&&<button className="button compact" type="button" onClick={()=>{setLabels([]);setError("");}}>Clear scans</button>}
    </fieldset>
    <div className="transfer-scan-row"><p className="transfer-scan-count" role="status">{done?"All reserved units verified":busy?"Verifying…":`${labels.length} of ${reservation.components.length} reserved units scanned`}</p>{ambiguous&&<button className="button compact primary" type="button" disabled={busy} onClick={()=>void verify()}>Retry verification</button>}</div>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
