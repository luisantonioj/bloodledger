import {useEffect,useRef,useState} from "react";
import type {Principal} from "../../auth/permissions";
import {UnitCaptureWorkspace} from "../receipts/unit-capture-workspace";
export type ScannerRequest={source_institution_id?:string;destination_institution_id?:string};
export function BankUnitScanner({principal,onClose}:{principal:Principal;requests:ScannerRequest[];onClose:()=>void}){
 const [direction,setDirection]=useState<"Inbound"|"Outbound"|null>(null);
 const [locked,setLocked]=useState(false);
 const panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
 useEffect(()=>{panel.current?.querySelector<HTMLButtonElement>(direction===null?'.bank-scanner-direction-option':'.bank-scanner-back')?.focus();},[direction]);
 function keyDown(event:React.KeyboardEvent){if(event.key==="Escape"){event.preventDefault();if(!locked)onClose();return;}if(event.key!=="Tab")return;const elements=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),a[href],input:not([hidden]):not([disabled]),iframe')??[]).filter(el=>el.getClientRects().length>0);const first=elements[0],last=elements[elements.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
 return <div className="preview-modal-backdrop receipt-scanner-backdrop bank-scanner-backdrop"><section ref={panel} className="receipt-scanner-dialog bank-scanner-phone" role="dialog" aria-modal="true" aria-label="Mobile blood unit scanner" onKeyDown={keyDown}>
 <header><div><h2>Mobile Blood Unit Scanner</h2><span className="receipt-eyebrow">BloodLedger · {direction ?? "Choose direction"}</span></div><button ref={close} className="receipt-close" aria-label="Close mobile scanner" disabled={locked} onClick={onClose}>×</button></header>
 <div className="receipt-scanner-content"><BankUnitScannerBody principal={principal} direction={direction} onDirection={setDirection} onLockChange={setLocked}/></div></section></div>;
}

/** Direction choice and capture workspace; shared by the dialog and the phone scanner-only screen. */
export function BankUnitScannerBody({principal,direction,onDirection,onLockChange}:{principal:Principal;direction:"Inbound"|"Outbound"|null;onDirection:(direction:"Inbound"|"Outbound"|null)=>void;onLockChange:(locked:boolean)=>void}){
 return <>{direction === null ? <section className="bank-scanner-direction-choice" aria-labelledby="bank-scanner-direction-title"><h3 id="bank-scanner-direction-title">Choose transaction direction</h3><p>Are you scanning incoming or outgoing units?</p><div className="bank-scanner-direction-options">{(["Inbound","Outbound"] as const).map(item=><button type="button" className="bank-scanner-direction-option" aria-label={item} key={item} onClick={()=>onDirection(item)}><span aria-hidden="true">{item === "Inbound" ? "↓" : "↑"}</span><strong>{item}</strong><small>{item === "Inbound" ? "Incoming blood units" : "Outgoing blood units"}</small></button>)}</div></section> : <UnitCaptureWorkspace key={direction} direction={direction} principal={principal} onBack={()=>onDirection(null)} onLockChange={onLockChange}/>}</>;
}
