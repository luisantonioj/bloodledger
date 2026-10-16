import {useEffect,useRef,useState} from "react";
import type {Principal} from "../../auth/permissions";
import type {TransferRow} from "../transfers/requester-transfer-data";
import {UnitCaptureWorkspace} from "./unit-capture-workspace";
export function ReceiptScanner({principal,onClose}:{principal:Principal;incoming:TransferRow[];onClose:()=>void}){
 const [locked,setLocked]=useState(false);
  const panel = useRef<HTMLElement>(null), closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => { const previous=document.activeElement as HTMLElement|null; closeButton.current?.focus(); return()=>{if(previous?.isConnected)previous.focus();}; },[]);
  function keyDown(event:React.KeyboardEvent) {
    if(event.key==="Escape"){event.preventDefault();if(!locked)onClose();return;}
    if(event.key!=="Tab")return;
    const elements=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),a[href],input:not([hidden]):not([disabled])')??[]).filter(element=>element.getClientRects().length>0),first=elements[0],last=elements[elements.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  return <div className="preview-modal-backdrop receipt-scanner-backdrop"><section ref={panel} className="receipt-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-scanner-title" onKeyDown={keyDown}>
 <header><div><h2 id="receipt-scanner-title">Mobile Receipt Scanner</h2><span className="receipt-eyebrow">BloodLedger · Inbound only</span></div><button ref={closeButton} disabled={locked} className="receipt-close" type="button" aria-label="Close receipt scanner" onClick={onClose}>×</button></header>
 <div className="receipt-scanner-content"><UnitCaptureWorkspace principal={principal} direction="Inbound" onLockChange={setLocked}/></div>
 </section></div>;
}
