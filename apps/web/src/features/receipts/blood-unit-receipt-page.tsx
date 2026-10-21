import { PaginatedTable } from "../../components/ui/record-pagination";
import { SortableHeader, TableViewBar, useTableView, type TableColumn } from "../../components/ui/table-view";
import { RefreshButton } from "../../components/ui/refresh-button";
import { useEffect, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { InformationHelp } from "../../components/ui/information-help";
import { formatBloodType, statusClassName } from "../../components/ui/display";
import { useLiveData } from "../../hooks/use-live-data";
import { V2RecordExplorer } from "../inventory/v2-record-explorer";
import { componentLabel, facilityLabel, parseRequesterRecords, type RequesterRecords } from "../transfers/requester-transfer-data";
import { SCAN_ON_PHONE_NOTE } from "../../app/phone-scanner-mode";

type ReceiptRow = RequesterRecords["transfers"][number];
const receiptColumns = (principal: Principal): TableColumn<ReceiptRow>[] => [
  { id: "transfer", label: "Transfer / Reservation", sortValue: row => row.transfer_id },
  { id: "product", label: "Blood Product", sortValue: row => formatBloodType(row.request.blood_type) + " " + componentLabel(row.request.component_type) },
  { id: "units", label: "Requested Units", sortValue: row => row.request.quantity },
  { id: "from", label: "From", sortValue: row => facilityLabel(row.request.source_institution_id, principal) },
  { id: "state", label: "Receipt State" },
];

export function BloodUnitReceiptPage({principal}:{principal:Principal}) {
  const state=useLiveData<unknown>("/api/v2/transfers");
  const [detailId,setDetailId]=useState<string>();
  let records:RequesterRecords|undefined,validationError="";
  if(state.data)try{records=parseRequesterRecords(state.data,principal);}catch{validationError="Receipt records could not be verified. Refresh to try again.";}
  const error=state.error||validationError,incoming=records?.transfers.filter(row=>row.status==="IN_TRANSIT")??[],received=records?.transfers.filter(row=>row.status==="RECEIVED")??[];
  const hasRecords=Boolean(records);
  const view=useTableView("bank-receipts",receiptColumns(principal),received),show=view.isVisible;
  useEffect(()=>{if(!hasRecords){setDetailId(undefined);}},[hasRecords]);
  return <div className="page blood-unit-receipt-page">
    <header className="page-head"><h1 className="page-title">Blood Unit Receipt</h1><RefreshButton busy={state.busy} onRefresh={state.manual}/></header>
    <section className="receipt-launch-card"><div className="receipt-launch-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></svg></div><div className="receipt-launch-copy"><span className="receipt-eyebrow">Mobile workflow</span><h2>Receive blood through the mobile scanner</h2></div><p className="receipt-preview-note scan-on-phone-note" role="note">{SCAN_ON_PHONE_NOTE}</p><InformationHelp label="Mobile workflow">Capture a label and review the incoming transfer.</InformationHelp></section>
    {error&&<div className="requester-transfer-notice" role="status"><span className="requester-notice-icon" aria-hidden="true">!</span><div className="requester-notice-copy"><strong>Receipt records unavailable</strong><p>{records?"Showing the last confirmed records. ":""}{error}</p></div><button className="button compact dashboard-refresh" type="button" onClick={state.manual} disabled={state.busy}>Retry</button></div>}
    <section className="requester-records-card receipt-history-card"><header className="requester-records-heading"><h2>Recorded inbound receipts</h2><InformationHelp label="Recorded inbound receipts">Review transfers recorded as received by your facility. Select a reference to read its current reservation details. Photos taken in the scanner preview do not add receipt records.</InformationHelp></header>
      {!records?<div className="requester-records-empty"><strong>{error?"Receipt records unavailable":"Loading receipt records…"}</strong><span>{error?"Use Refresh to try again.":"Waiting for the data service."}</span></div>:received.length===0?<div className="requester-records-empty"><strong>No inbound receipts recorded yet</strong><span>Received transfers will appear here when recorded.</span></div>:<PaginatedTable total={received.length} label="Inbound receipts" resetKey={view.sortKey} toolbar={<TableViewBar view={view}/>}><table className="data-table receipt-history-table"><thead><tr><SortableHeader view={view} id="transfer">Transfer / Reservation</SortableHeader><SortableHeader view={view} id="product">Blood Product</SortableHeader><SortableHeader view={view} id="units" className="numeric">Requested Units</SortableHeader><SortableHeader view={view} id="from">From</SortableHeader><SortableHeader view={view} id="state">Receipt State</SortableHeader></tr></thead><tbody>{view.rows.map(row=><tr key={row.reservation_id}>{show("transfer")&&<td><button className="requester-record-link mono" type="button" aria-label={"Open receipt "+row.reservation_id} onClick={()=>setDetailId(row.reservation_id)}>{row.transfer_id}</button><small className="mono">{row.reservation_id}</small></td>}{show("product")&&<td>{formatBloodType(row.request.blood_type)}<small>{componentLabel(row.request.component_type)}</small></td>}{show("units")&&<td className="numeric">{row.request.quantity}</td>}{show("from")&&<td>{facilityLabel(row.request.source_institution_id,principal)}</td>}{show("state")&&<td><span className={statusClassName(row.status)}>Received</span></td>}</tr>)}</tbody></table></PaginatedTable>}
    </section>
    {detailId&&records&&<V2RecordExplorer initial={{kind:"reservation",id:detailId}} principal={principal} onClose={()=>setDetailId(undefined)}/>}
  </div>;
}
