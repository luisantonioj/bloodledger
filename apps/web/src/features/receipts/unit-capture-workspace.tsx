import {mergeFieldReview} from "./label-extraction";
import {LabelImageControls,defaultExtractionOptions} from "./label-image-controls";
import {labelExtractionPreviewEnabled} from "./label-profiles";
import {useEffect,useRef,useState} from "react";
import {canAct,type Principal} from "../../auth/permissions";
import {InformationHelp} from "../../components/ui/information-help";
import {ApiRequestError,requestJson,retryAfterContextChange} from "../../services/api/client";
import {newMutationKeys} from "../../services/api/mutation-keys";
import {mutationError} from "../../services/api/mutation-error";
import {parseV2Command,readCommandByKey} from "../../services/api/v2";
import {issuerForDonationNumber} from "../../../../capture-pwa/src/capture-policy";
import {CommandStatusCard} from "../commands/command-status-card";
import {useCommandStatus} from "../commands/use-command-status";
import {LabelReviewFields} from "./label-review-fields";
import {emptyLabel,unchangedVerifiedDraft,validLabel,type ScanReview} from "./scan-review-data";
import {ScannerTransferActions} from "./scanner-transfer-actions";

type Attempt={keys:ReturnType<typeof newMutationKeys>;payload:Record<string,unknown>};
export function UnitCaptureWorkspace({principal,direction,onBack,onLockChange}:{principal:Principal;direction:"Inbound"|"Outbound";onBack?:()=>void;onLockChange?:(locked:boolean)=>void}){
 const [extractionOptions,setExtractionOptions]=useState(defaultExtractionOptions);
 const [mode,setMode]=useState<"Scan"|"Manual">("Scan"),[image,setImage]=useState<File>(),[imageUrl,setImageUrl]=useState<string>();
 const [review,setReview]=useState<ScanReview>(),[draft,setDraft]=useState(emptyLabel),[confirmed,setConfirmed]=useState(false),[reading,setReading]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(""),[busy,setBusy]=useState(false),[duplicate,setDuplicate]=useState(false),[frozen,setFrozen]=useState(false),[transferLocked,setTransferLocked]=useState(false);
 const chooser=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),active=useRef(true),attempt=useRef<Attempt|undefined>(undefined),timeRejects=useRef(0);
 const status=useCommandStatus(),locked=busy||frozen||Boolean(status.command)||transferLocked;
 const requester=principal.accountCategory==="REQUESTOR"||principal.roleId==="ROLE-03";
 const verified=mode==="Scan"&&unchangedVerifiedDraft(draft,review);
 const label=validLabel(draft),canIntake=!requester&&direction==="Inbound"&&canAct(principal,"inventory:capture");
 useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();};},[]);
 useEffect(()=>()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);},[imageUrl]);
 useEffect(()=>{onLockChange?.(locked);return()=>onLockChange?.(false);},[locked,onLockChange]);
 useEffect(()=>{if(!frozen&&!transferLocked)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};addEventListener("beforeunload",warn);return()=>removeEventListener("beforeunload",warn);},[frozen,transferLocked]);
 function reset(){controller.current?.abort();controller.current=null;setReading(false);setProgress(0);setReview(undefined);setDraft(emptyLabel());setConfirmed(false);setError("");setDuplicate(false);}
 function changeImage(file?:File){if(locked)return;reset();setExtractionOptions(defaultExtractionOptions());setImage(undefined);setImageUrl(undefined);if(!file)return;if(!["image/jpeg","image/png"].includes(file.type)||file.size>10*1024*1024){setError("Choose a JPG or PNG image up to 10 MB.");return;}setImage(file);setImageUrl(URL.createObjectURL(file));}
 async function ocr(){if(!image||reading||locked)return;const prior=review,priorDraft={...draft},field=labelExtractionPreviewEnabled?extractionOptions.field:undefined;controller.current?.abort();setError("");setConfirmed(false);setDuplicate(false);setProgress(0);const abort=new AbortController();controller.current=abort;setReading(true);
  try{const {recognizeReceiptDraft}=await import("./receipt-ocr");const result=await recognizeReceiptDraft(image,abort.signal,value=>{if(!abort.signal.aborted)setProgress(value);},labelExtractionPreviewEnabled?extractionOptions:undefined);if(active.current&&!abort.signal.aborted){const merged=field?mergeFieldReview(prior,result,field):result;setReview(merged);setDraft(field&&prior?.extraction?{...priorDraft,[field]:result.draft[field]}:{...result.draft});}}
  catch(reason){if(active.current&&!abort.signal.aborted)setError(reason instanceof Error&&reason.message==="CAPTURE_PROHIBITED_TEXT"?"This image contains unsupported personal or clinical fields. Choose a supported label.":"OCR could not read this label. Retake the photo, or use Manual to prepare a review draft.");}
  finally{if(active.current&&controller.current===abort){setReading(false);controller.current=null;}}
 }
 async function submit(){if(busy||status.command||(!frozen&&(!canIntake||!verified||!confirmed||!label)))return;setBusy(true);setError("");
  try{
   if(!attempt.current){const keys=newMutationKeys(),eventTime=new Date().toISOString(),original=review!.verified!;
    attempt.current={keys,payload:{captureMethod:"OCR",capturePolicyVersion:"INBOUND_OCR_V1",issuerInstitutionId:issuerForDonationNumber(original.label.donationNumber),...original.label,bloodTypeEvidence:{source:"OCR_LABEL",confirmed:true},componentEvidence:{source:"OCR_LABEL",confirmed:true},capturedAt:review!.capturedAt,confirmedAt:eventTime,eventTime,correlationId:keys.correlationId,ocrEvidence:{engine:"TESSERACT_JS",engineVersion:"7.0.0",fieldConfidence:{donationNumber:original.fieldConfidence.donationNumber,bloodType:original.fieldConfidence.bloodType,collectedAt:original.fieldConfidence.collectedAt,expiresAt:original.fieldConfidence.expiresAt}}}};
   }
   const saved=attempt.current;const result=await requestJson<unknown>("/api/v2/inbound-captures",{method:"POST",headers:{"Idempotency-Key":saved.keys.idempotencyKey,"X-BloodLedger-Contract-Version":"V2.1"},body:JSON.stringify(saved.payload)});
   const row=result as Record<string,unknown>|null;
   if(row?.resolution==="ALREADY_REGISTERED"){
    if(frozen)throw Error("Original command outcome is still unverified; look up the saved intake.");
    if(row.classification!=="SIMULATION_ONLY"||typeof row.componentId!=="string"||!/^COMP_[A-Z0-9_-]+$/.test(row.componentId)||typeof row.captureId!=="string"||!/^INCAP_[A-Z0-9_-]+$/.test(row.captureId)||typeof row.status!=="string")throw Error("Duplicate response is invalid");
    if(active.current){setDuplicate(true);setConfirmed(false);setReview(undefined);setDraft(emptyLabel());}
   }else{const command=parseV2Command(result);if(command.resourceType!=="INBOUND_CAPTURE"||!/^INCAP_[A-Z0-9_-]+$/.test(command.resourceId)||command.correlationId!==saved.keys.correlationId||command.statusUrl!=="/api/v2/commands/"+command.commandId)throw Error("Command identity mismatch");if(active.current){status.accept(command);setReview(undefined);setDraft(emptyLabel());setImage(undefined);setImageUrl(undefined);setConfirmed(false);}}
   attempt.current=undefined;if(active.current)setFrozen(false);
  }catch(reason){if(!active.current)return;const failure=mutationError(reason,timeRejects.current);if(failure.timeRejected)timeRejects.current++;
   const cancelled=reason instanceof Error&&reason.message==="Operator verification cancelled. The command was not sent.";
   const definitive=reason instanceof ApiRequestError&&reason.status>=400&&reason.status<500&&reason.code!=="AUTH_CONTEXT_CHANGED";
   if(failure.discardAttempt||definitive||(cancelled&&!frozen))attempt.current=undefined;
   setFrozen(Boolean(attempt.current));setConfirmed(false);setError(cancelled?(frozen?"Operator verification cancelled. The original attempt stays frozen; no retry was sent.":"Operator verification cancelled. No intake was sent."):failure.timeRejected?failure.message:definitive?"Intake was not accepted. Review the label and current account before trying again.":"The intake outcome is unknown. Retry the same frozen attempt explicitly; no second unit is assumed.");
  }finally{if(active.current)setBusy(false);}
 }
 async function recover(){
  const saved=attempt.current;if(!saved||!frozen||busy||status.command)return;setBusy(true);setError("");
  const current=()=>active.current&&attempt.current===saved;
  try{
   const command=await retryAfterContextChange(()=>readCommandByKey(saved.keys.idempotencyKey),current);
   if(!current())return;
   if(!command){setError("No accepted command was found in the current actor scope. The attempt stays frozen; nothing was resubmitted.");return;}
   if(command.resourceType!=="INBOUND_CAPTURE"||!/^INCAP_[A-Z0-9_-]+$/.test(command.resourceId)||command.correlationId!==saved.keys.correlationId||command.statusUrl!=="/api/v2/commands/"+command.commandId)throw Error("Command identity mismatch");
   status.accept(command);attempt.current=undefined;setFrozen(false);setReview(undefined);setDraft(emptyLabel());setImage(undefined);setImageUrl(undefined);setConfirmed(false);
  }catch{if(current())setError("The original intake could not be verified in the current actor scope. The attempt stays frozen; nothing was resubmitted.");}
  finally{if(active.current)setBusy(false);}
 }
 return <>
 <section className="receipt-input-card"><header className={onBack?"bank-scanner-input-heading":undefined}>{onBack&&<button className="button compact bank-scanner-back" type="button" aria-label="Change direction" title="Back to direction selection" disabled={locked} onClick={onBack}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>}<h3>{direction} Blood Unit Input</h3><InformationHelp label={direction+" blood unit input"}>Scan a supported synthetic label or enter a manual review draft. OCR runs on this device. Corrections remain separate from original confidence evidence; manual/corrected submission awaits Jopia’s contract. Outbound follows an authorized transfer.</InformationHelp></header>
 <div className="receipt-mode-tabs" role="tablist" aria-label="Blood unit input method">{(["Scan","Manual"] as const).map(item=><button type="button" role="tab" key={item} aria-selected={mode===item} tabIndex={mode===item?0:-1} disabled={locked} aria-controls="unit-capture-panel" id={"unit-capture-"+item} onClick={()=>{reset();setImage(undefined);setImageUrl(undefined);setExtractionOptions(defaultExtractionOptions());setMode(item);}} onKeyDown={event=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?"Scan":event.key==="End"?"Manual":mode==="Scan"?"Manual":"Scan";reset();setImage(undefined);setImageUrl(undefined);setExtractionOptions(defaultExtractionOptions());setMode(next);document.getElementById("unit-capture-"+next)?.focus();}}}>{item}</button>)}</div>
 <div id="unit-capture-panel" role="tabpanel" aria-labelledby={"unit-capture-"+mode}>
 {mode==="Scan"&&<><div className="receipt-camera-stage">{imageUrl?<img src={imageUrl} alt={direction==="Outbound"?"Selected outbound label preview":"Selected blood-unit label preview"}/>:<><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></svg><strong>Capture a blood-unit label</strong><span>Use your phone camera or choose an image.</span></>}</div>
 <input ref={chooser} type="file" accept="image/jpeg,image/png" capture="environment" hidden aria-label={direction==="Outbound"?"Outbound blood-unit label image":"Blood-unit label image"} disabled={locked} onChange={event=>{changeImage(event.target.files?.[0]);event.target.value="";}}/>
 <div className="receipt-capture-actions"><button className="button primary compact" type="button" disabled={locked||reading} onClick={()=>chooser.current?.click()}>{image?"Replace image":"Take photo / Choose image"}</button><button className="button primary compact" type="button" disabled={!image||reading||locked} onClick={()=>void ocr()}>{reading?"Processing…":"Run OCR"}</button>{image&&<button className="button compact" type="button" disabled={locked} onClick={()=>changeImage()}>Clear image</button>}</div>
 {image&&labelExtractionPreviewEnabled&&<LabelImageControls image={image} value={extractionOptions} disabled={locked||reading} onChange={value=>{controller.current?.abort();setReading(false);setExtractionOptions(value);if(!value.field){setReview(undefined);setDraft(emptyLabel());}setConfirmed(false);setError("");}}/>}
 {reading&&<p className="receipt-preview-note" role="status">Reading label · {progress}%</p>}</>}
 </div></section>
 <section className="receipt-review-card"><header><h3>{mode==="Manual"||review?direction+" Preview":"Awaiting Input"}</h3><InformationHelp label="Blood unit verification">Review all five supported fields. Patient and donor information are not collected. Queued commands are not committed inventory or confirmed custody.</InformationHelp></header>
 {mode==="Manual"||review?<><p className="receipt-preview-note">{mode==="Manual"?"Manual draft · Not verified":verified?"OCR label read · Review every field":"Edited or incomplete OCR draft · Not verified"}</p><LabelReviewFields draft={draft} review={review} disabled={locked} onChange={value=>{setDraft(value);setConfirmed(false);setError("");setDuplicate(false);}}/>{!label&&<p className="receipt-preview-note">Enter a supported Donation No., blood type, component and exact UTC dates. Expiration must follow collection.</p>}
 {review?.extraction&&<div className="label-extraction-notice" role="status"><strong>Label extraction preview</strong><span>{review.extraction.profileId?"Layout: "+review.extraction.profileId+" · "+review.extraction.profileStatus:"Layout not established"}</span>{review.extraction.warnings.map(warning=><span key={warning}>{warning}</span>)}<span>Suggestions are not verified capture evidence.</span></div>}
 {!verified&&<p className="receipt-preview-note">Manual and corrected values can be reviewed here. Submitting them requires the new verification contract from Jopia (RQ-19).</p>}
 {canIntake&&verified&&<div className="receipt-confirm-footer"><label><input type="checkbox" checked={confirmed} disabled={locked} onChange={event=>setConfirmed(event.target.checked)}/>I checked all five fields against the label.</label></div>}
 </>:<div className="requester-records-empty"><strong>Scan a label or enter unit details</strong><span>Your editable review will appear here.</span></div>}
 {direction==="Inbound"&&<div className="receipt-confirm-footer"><button className="button primary compact" type="button" disabled={busy||Boolean(status.command)||(!frozen&&(!canIntake||!verified||!confirmed||!label))} onClick={()=>void submit()}>{busy?"Submitting…":frozen?"Retry same intake":requester?"Confirm inbound receipt":"Confirm inbound transaction"}</button>{requester&&<span>Receipt confirmation needs server-side incoming-transfer label matching for ROLE-03; this account cannot register new stock.</span>}{!requester&&!canIntake&&<span>An operator with inventory:capture capability is required.</span>}</div>}
 {frozen&&<div className="receipt-confirm-footer"><button className="button compact" type="button" disabled={busy||Boolean(status.command)} onClick={()=>void recover()}>Look up saved intake</button></div>}
 {duplicate&&<p className="receipt-preview-note" role="status">Already registered by another request. No duplicate unit was created.</p>}{error&&<p className="receipt-image-error" role="alert">{error}</p>}
 </section>
 {direction==="Outbound"&&<ScannerTransferActions principal={principal} review={verified?review:undefined} onLockChange={setTransferLocked}/>}
 {status.command&&<CommandStatusCard command={status.command} pollError={status.pollError} onClear={()=>{status.clear();reset();}}/>}
 </>;
}
