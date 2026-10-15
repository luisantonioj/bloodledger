import { ActionButton } from "../../components/ui/action-button";
import { useEffect, useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { InformationHelp } from "../../components/ui/information-help";
import { ManualReceiptEntry, type ManualReceiptDraft } from "./manual-receipt-entry";
import { componentLabel, facilityLabel, type TransferRow } from "../transfers/requester-transfer-data";
import type { ReceiptRecognition } from "./receipt-ocr";
import { formatBloodType, formatManilaDateTime } from "../../components/ui/display";

export function ReceiptScanner({ principal, incoming, onClose }: {principal:Principal; incoming:TransferRow[]; onClose:()=>void}) {
  const [mode,setMode]=useState<"Scan"|"Manual">("Scan");
  const [draft,setDraft]=useState<ManualReceiptDraft>();
  const [imageUrl, setImageUrl] = useState<string>();
  const [imageError, setImageError] = useState("");
  const [image,setImage]=useState<File>(),[recognized,setRecognized]=useState<ReceiptRecognition>(),[recognizing,setRecognizing]=useState(false),[progress,setProgress]=useState(0);
  const recognition=useRef<AbortController|null>(null);
  useEffect(()=>()=>{recognition.current?.abort();},[]);
  function clearRecognition(){recognition.current?.abort();recognition.current=null;setRecognized(undefined);setRecognizing(false);setProgress(0);}
  function changeMode(next:"Scan"|"Manual"){clearRecognition();setImageError("");setMode(next);}
  async function readLabel(){
    if(!image||recognizing)return;
    clearRecognition();setImageError("");setRecognizing(true);
    const controller=new AbortController();recognition.current=controller;
    try{const {recognizeReceiptLabel}=await import("./receipt-ocr");controller.signal.throwIfAborted();const result=await recognizeReceiptLabel(image,controller.signal,setProgress);if(!controller.signal.aborted)setRecognized(result);}
    catch(reason){if(!controller.signal.aborted){const code=reason instanceof Error?reason.message:"";setImageError(code==="INBOUND_OCR_CONFIDENCE_LOW"?"The label could not be read confidently. Take a clearer photo and try again.":code.startsWith("CAPTURE_")||code.startsWith("INBOUND_")||code.startsWith("V2_")?"The label does not match the supported five-field format. Check the label and take a clearer photo.":"OCR could not read this image. Check that the local OCR service assets are available and try again.");}}
    finally{if(recognition.current===controller){setRecognizing(false);recognition.current=null;}}
  }
  const panel = useRef<HTMLElement>(null), closeButton = useRef<HTMLButtonElement>(null), chooser = useRef<HTMLInputElement>(null);

  useEffect(() => { const previous=document.activeElement as HTMLElement|null; closeButton.current?.focus(); return()=>{if(previous?.isConnected)previous.focus();}; },[]);
  useEffect(() => () => {if(imageUrl)URL.revokeObjectURL(imageUrl);},[imageUrl]);
  function imageChanged(file?:File) {
    clearRecognition();setImage(undefined);setImageError("");setImageUrl(undefined);
    if(!file)return;
    if(!["image/jpeg","image/png"].includes(file.type)||file.size>10*1024*1024){setImageError("Choose a JPG or PNG image up to 10 MB.");return;}
    setImage(file);setImageUrl(URL.createObjectURL(file));
  }
  function keyDown(event:React.KeyboardEvent) {
    if(event.key==="Escape"){event.preventDefault();onClose();return;}
    if(event.key!=="Tab")return;
    const elements=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),a[href],input:not([hidden]):not([disabled])')??[]).filter(element=>element.getClientRects().length>0),first=elements[0],last=elements[elements.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  return <div className="preview-modal-backdrop receipt-scanner-backdrop"><section ref={panel} className="receipt-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-scanner-title" onKeyDown={keyDown}>
    <header><div><h2 id="receipt-scanner-title">Mobile Receipt Scanner</h2><span className="receipt-eyebrow">BloodLedger · Inbound only</span></div><button ref={closeButton} className="receipt-close" type="button" aria-label="Close receipt scanner" onClick={onClose}>×</button></header>
    <div className="receipt-scanner-content">
      <section className="receipt-input-card"><header><h3>Inbound Blood Unit Input</h3><InformationHelp label="Inbound blood unit input">Read a supported printed label with on-device OCR, or enter a separate manual preview. Each recognized field must pass the existing confidence and format checks. Images and recognized details stay in memory and are cleared when the scanner closes. Incoming-transfer matching is a separate step.</InformationHelp></header>
        <div className="receipt-mode-tabs" role="tablist" aria-label="Blood unit input method">{(["Scan","Manual"] as const).map(item=><button key={item} id={"receipt-tab-"+item} role="tab" type="button" aria-selected={mode===item} aria-controls="receipt-input-panel" tabIndex={mode===item?0:-1} onClick={()=>changeMode(item)} onKeyDown={event=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?"Scan":event.key==="End"?"Manual":mode==="Scan"?"Manual":"Scan";changeMode(next);document.getElementById("receipt-tab-"+next)?.focus();}}}>{item}</button>)}</div>
        <div id="receipt-input-panel" role="tabpanel" aria-labelledby={"receipt-tab-"+mode}>
        {mode==="Scan"?<>
        <div className="receipt-camera-stage">{imageUrl?<img src={imageUrl} alt="Selected blood-unit label preview"/>:<><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></svg><strong>Capture a blood-unit label</strong><span>Use your phone camera or choose an image.</span></>}<span className="receipt-camera-corners" aria-hidden="true"/></div>
        <input ref={chooser} type="file" accept="image/jpeg,image/png" capture="environment" hidden aria-label="Blood-unit label image" onChange={event=>{imageChanged(event.target.files?.[0]);event.target.value="";}}/>
        <div className="receipt-capture-actions">
          <button className="button primary compact" type="button" onClick={()=>chooser.current?.click()}>{imageUrl?"Replace image":"Take photo / Choose image"}</button>
          <button className="button primary compact" type="button" disabled={!image||recognizing} onClick={()=>void readLabel()}>{recognizing?"Processing…":"Run OCR"}</button>
          {imageUrl&&<button className="button compact" type="button" onClick={()=>imageChanged()}>Clear image</button>}
        </div>
        {recognizing&&<p className="receipt-preview-note" role="status">{progress?`Reading label · ${progress}%`:"Starting on-device OCR…"}</p>}
        {imageError&&<p className="receipt-image-error" role="alert">{imageError}</p>}
        <p className="receipt-preview-note">OCR reads the label on this device. Review the recognized fields below; transfer matching is still required before receipt confirmation.</p>
        </>:null}
        <div hidden={mode!=="Manual"}><ManualReceiptEntry incoming={incoming} principal={principal} initial={draft} onPreview={setDraft}/></div>
        </div>
      </section>
      <section className="receipt-review-card"><header><h3>{(mode==="Scan"?recognized:draft)?"Inbound Preview":"Awaiting Input"}</h3><InformationHelp label="Receipt verification">Scanned or manually entered details must be matched to an incoming transfer before an authorized operator can confirm receipt. A local preview does not create a receipt record.</InformationHelp></header>
        {mode==="Scan"&&recognized?<><p className="receipt-preview-note">OCR label read · Not yet matched to a transfer</p><dl>{Object.entries({"Unit ID":recognized.label.donationNumber,"Blood type":formatBloodType(recognized.label.bloodType),"Component":componentLabel(recognized.label.componentType),"Collection date":formatManilaDateTime(recognized.label.collectedAt),"Expiration date":formatManilaDateTime(recognized.label.expiresAt)}).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="receipt-preview-note">All five fields passed the 90% minimum OCR confidence check. Review them against the printed label.</p></>:mode==="Manual"&&draft?<><p className="receipt-preview-note">Manual entry preview · Not verified</p><dl>{Object.entries({"Unit ID":draft.unitId,"Blood type":formatBloodType(draft.bloodType),"Component":componentLabel(draft.component),"Collection date":draft.collected||"Not entered","Expiration date":draft.expires,"Source facility":draft.facility?facilityLabel(draft.facility,principal):"Not entered","Purpose":draft.purpose||"Not entered"}).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>:<div className="requester-records-empty"><strong>Scan a label or enter unit details</strong><span>Your entry preview will appear here.</span></div>}
        <div className="receipt-confirm-footer"><ActionButton className="button primary compact" type="button" disabled  unavailableReason="Receipt confirmation is unavailable until the scanned unit can be matched to its incoming transfer.">Confirm inbound receipt</ActionButton><span>Available once scan matching is connected.</span></div>
      </section>
    </div>
  </section></div>;
}
