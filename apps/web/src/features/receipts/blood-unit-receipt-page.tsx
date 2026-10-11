import { useEffect, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { InformationHelp } from "../../components/ui/information-help";
import { formatBloodType, statusClassName } from "../../components/ui/display";
import { useLiveData } from "../../hooks/use-live-data";
import { V2RecordExplorer } from "../inventory/v2-record-explorer";
import { componentLabel, facilityLabel, parseRequesterRecords, type RequesterRecords } from "../transfers/requester-transfer-data";
import { ReceiptScanner } from "./receipt-scanner";

export function BloodUnitReceiptPage({principal}:{principal:Principal}) {
  const state=useLiveData<unknown>("/api/v2/transfers");
  const [scannerOpen,setScannerOpen]=useState(false),[detailId,setDetailId]=useState<string>();
  let records:RequesterRecords|undefined,validationError="";
  if(state.data)try{records=parseRequesterRecords(state.data,principal);}catch{validationError="Receipt records could not be verified. Refresh to try again.";}
  const error=state.error||validationError,incoming=records?.transfers.filter(row=>row.status==="IN_TRANSIT")??[],received=records?.transfers.filter(row=>row.status==="RECEIVED")??[];
  const hasRecords=Boolean(records);
  useEffect(()=>{if(!hasRecords){setScannerOpen(false);setDetailId(undefined);}},[hasRecords]);
  return <div className="page blood-unit-receipt-page">
    <header className="page-head"><h1 className="page-title">Blood Unit Receipt</h1><button className="button compact dashboard-refresh" type="button" disabled={state.busy} aria-busy={state.busy} onClick={state.manual}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 4v6h6M20 20v-6h-6M5 14a8 8 0 0 0 14 4M19 10a8 8 0 0 0-14-4"/></svg>{state.busy?"Refreshing…":"Refresh"}</button></header>
    <section className="receipt-launch-card"><div className="receipt-launch-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></svg></div><div className="receipt-launch-copy"><span className="receipt-eyebrow">Mobile workflow</span><h2>Receive blood through the mobile scanner</h2><p>Capture a label and review the incoming transfer.</p><span className="receipt-inbound-chip">Inbound only</span></div><button className="button primary compact" type="button" disabled={!records} onClick={()=>{setDetailId(undefined);setScannerOpen(true);}}>Open Mobile Receipt Scanner</button></section>
    {error&&<div className="requester-transfer-notice" role="status"><span className="requester-notice-icon" aria-hidden="true">!</span><div className="requester-notice-copy"><strong>Receipt records unavailable</strong><p>{records?"Showing the last confirmed records. ":""}{error}</p></div><button className="button compact dashboard-refresh" type="button" onClick={state.manual} disabled={state.busy}>Retry</button></div>}
    <section className="requester-records-card receipt-history-card"><header className="requester-records-heading"><h2>Recorded inbound receipts</h2><InformationHelp label="Recorded inbound receipts">Review transfers recorded as received by your facility. Select a reference to read its current reservation details. Photos taken in the scanner preview do not add receipt records.</InformationHelp></header>
      {!records?<div className="requester-records-empty"><strong>{error?"Receipt records unavailable":"Loading receipt records…"}</strong><span>{error?"Use Refresh to try again.":"Waiting for the data service."}</span></div>:received.length===0?<div className="requester-records-empty"><strong>No inbound receipts recorded yet</strong><span>Received transfers will appear here when recorded.</span></div>:<div className="table-wrap"><table className="data-table receipt-history-table"><thead><tr><th>Transfer / Reservation</th><th>Blood Product</th><th className="numeric">Requested Units</th><th>From</th><th>Receipt State</th></tr></thead><tbody>{received.map(row=><tr key={row.reservation_id}><td><button className="requester-record-link mono" type="button" aria-label={"Open receipt "+row.reservation_id} onClick={()=>setDetailId(row.reservation_id)}>{row.transfer_id}</button><small className="mono">{row.reservation_id}</small></td><td>{formatBloodType(row.request.blood_type)}<small>{componentLabel(row.request.component_type)}</small></td><td className="numeric">{row.request.quantity}</td><td>{facilityLabel(row.request.source_institution_id,principal)}</td><td><span className={statusClassName(row.status)}>Received</span></td></tr>)}</tbody></table></div>}
    </section>
    {detailId&&records&&<V2RecordExplorer initial={{kind:"reservation",id:detailId}} principal={principal} onClose={()=>setDetailId(undefined)}/>}
    {scannerOpen&&records&&<ReceiptScanner principal={principal} incoming={incoming} onClose={()=>setScannerOpen(false)}/>}
  </div>;
}
