import {demonstrationStockRecords} from "./demo-stock-records";
import {ActionIcon} from "../../components/ui/action-icon";
import {latestCheckpointRecord,checkpointClipboard} from "./checkpoint-copy";
import {requestJson} from "../../services/api/client";
import {parseComplianceStock,type StockGroup} from "./compliance-stock";
export {parseComplianceStock} from "./compliance-stock";
import { useCurrentComplianceStock } from "./current-compliance-stock";
import { retryAfterContextChange } from "../../services/api/client";
import { ActionButton } from "../../components/ui/action-button";
import { useEffect, useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { InformationHelp } from "../../components/ui/information-help";
import { RefreshButton } from "../../components/ui/refresh-button";
import { PaginatedTable } from "../../components/ui/record-pagination";
import { SortableHeader, TableViewBar, timeValue, useTableView, type TableColumn } from "../../components/ui/table-view";
import { formatBloodType, formatManilaDateTime } from "../../components/ui/display";
import { useLiveData } from "../../hooks/use-live-data";
import { CENSUS_ORDER, readCensusIndex, readCompleteCensusIndex, type CensusIndex, type CensusSnapshot } from "../../services/api/census-index";
import { V2_COMPONENT_TYPES } from "../../services/api/v2";
import type { Dashboard } from "../../services/api/types";
import { componentLabel } from "../transfers/requester-transfer-data";

const savedRecordColumns: TableColumn<CensusSnapshot>[] = [
  { id: "recorded", label: "Time Recorded", sortValue: record => timeValue(record.scheduledFor) },
  { id: "copy", label: "Copy", hideable: false },
];
const complianceColumns = (principal: Principal): TableColumn<CensusSnapshot>[] => [
  { id: "checkpoint", label: "Reporting checkpoint", sortValue: row => timeValue(row.scheduledFor) },
  { id: "facility", label: "Facility", sortValue: row => row.institutionId === principal.institutionId ? principal.institutionDisplayName : row.institutionId },
  { id: "captured", label: "Captured", sortValue: row => timeValue(row.capturedAt) },
  { id: "verification", label: "Verification" },
  { id: "actions", label: "Actions", hideable: false },
];

export function ComplianceReports({ principal }: { principal: Principal }) {
  const bank = principal.accountCategory === "BLOOD_BANK";
  const [index, setIndex] = useState<CensusIndex>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [retry, setRetry] = useState(0), [cursor, setCursor] = useState<string>();
  const [selectedId, setSelectedId] = useState(""), [search, setSearch] = useState(""), [date, setDate] = useState("");
  const copyGeneration=useRef(0),copyActive=useRef(true);
  useEffect(()=>{copyActive.current=true;return()=>{copyActive.current=false;copyGeneration.current++;};},[principal]);
  const [copyState,setCopyState]=useState<{key:string;busy:boolean;message:string}>();
  const [reportTick,setReportTick]=useState(0);
  useEffect(()=>{if(!bank)return;const poll=()=>{if(!document.hidden&&!copyState?.busy)setReportTick(value=>value+1);};const timer=setInterval(poll,30000);document.addEventListener("visibilitychange",poll);return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",poll);};},[bank,copyState?.busy]);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError("");copyGeneration.current++;setCopyState(undefined);
    (bank ? readCompleteCensusIndex(principal,controller.signal) : retryAfterContextChange(() => readCensusIndex(principal, controller.signal, cursor), () => !controller.signal.aborted)).then(next => {
      if (!controller.signal.aborted) setIndex(previous => cursor && previous ? {...next,snapshots:[...new Map([...previous.snapshots,...next.snapshots].map(row => [row.snapshotId,row])).values()]} : next);
    }).catch(reason => { if (!controller.signal.aborted) {setIndex(undefined); setError(reason instanceof Error ? reason.message : "Reports are unavailable.");} }).finally(() => {if (!controller.signal.aborted) setBusy(false);});
    return () => controller.abort();
  }, [principal, retry, cursor, bank, reportTick]);
  const inventory = useLiveData<Dashboard>(bank ? null : "/api/v2/dashboard");
  const currentStock=useCurrentComplianceStock(bank ? principal.institutionId : undefined,retry);
  const demos=demonstrationStockRecords(principal.institutionId);
  const selectedDemo=bank?demos.find(row=>row.record.snapshotId===selectedId):undefined;
  const selected = index?.snapshots.find(row => row.snapshotId === selectedId)??selectedDemo?.record;
  const detail = useLiveData<unknown>(selected && !selectedDemo ? "/api/v2/reports/doh-census/" + encodeURIComponent(selected.snapshotId) : null);
  let groups: StockGroup[] = [], detailError = selectedDemo ? "" : detail.error;
  const selectedStock=selectedDemo?.snapshot??detail.data;
  if (selected && selectedStock && (!detail.error||selectedDemo)) {try {groups = parseComplianceStock(selectedStock, selected);} catch(reason) {detailError = reason instanceof Error ? reason.message : "Stock detail unavailable.";}}
  const day = (value: string) => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
  const today = day(new Date().toISOString());
  const shown = index?.snapshots.filter(row => (!date || day(row.scheduledFor) === date) && (!search || [row.snapshotId,row.institutionId].some(value => value.toLowerCase().includes(search.toLowerCase())))) ?? [];
  const latestReal=(hour:"09"|"16")=>latestCheckpointRecord(index?.snapshots??[],principal.institutionId,hour);
  const demoRows=demos.filter((_,i)=>{const latest=latestReal(i===0?"09":"16");return !latest.record&&!latest.ambiguous;});
  const realSavedRows=(index?.snapshots??[]).filter(record=>(["09","16"] as const).some(hour=>Boolean(latestCheckpointRecord([record],principal.institutionId,hour).record)));
  const savedBankRows=[...realSavedRows,...demoRows.map(row=>row.record)].filter(row=>!date||day(row.scheduledFor)===date).sort((a,b)=>Date.parse(b.scheduledFor)-Date.parse(a.scheduledFor));
  const savedView=useTableView("saved-stock-records",savedRecordColumns,savedBankRows),showSaved=savedView.isVisible;
  const reportView=useTableView("compliance-records",complianceColumns(principal),shown),showReport=reportView.isVisible;
  const isDemo=(record:CensusSnapshot)=>demos.some(row=>row.record.snapshotId===record.snapshotId);
  const copyAllowed=(record:CensusSnapshot)=>isDemo(record)||Boolean(index&&index.reportAvailability==="EXPORT_AVAILABLE"&&!index.nextCursor&&!busy);
  const validInventory = inventory.data && inventory.data.classification === "SIMULATION_ONLY" && inventory.data.scope === (bank ? "INSTITUTION" : "CITY_AGGREGATE") && inventory.data.lastSuccessfulProjectionAt !== null && Array.isArray(inventory.data.inventory) && inventory.data.inventory.every(row => (!bank || row.institutionId === principal.institutionId) && Number.isSafeInteger(row.confirmedCount) && row.confirmedCount >= 0);
  const currentTotal = bank ? currentStock.data?.total ?? null : validInventory ? inventory.data!.inventory.filter(row => ["AVAILABLE","RESERVED"].includes(row.inventoryStatus)).reduce((sum,row) => sum + row.confirmedCount,0) : null;
  const cards: [string,number|null,string][] = [
    ["Current Inventory",currentTotal,bank ? "Label-current available and reserved units for your facility. Label-expired stock is excluded. Current inventory is separate from saved reports and does not establish compliance." : "Reported available and reserved units across the permitted network scope. Saved reports describe stock at their capture time and may differ from this current summary."],
    ["Reports for Today",index && !index.nextCursor ? index.snapshots.filter(row => day(row.scheduledFor) === today).length : null,"Counts saved stock reports whose reporting checkpoint falls today in Manila time. This is not the number of required reports or reports captured today. An incomplete report list stays unavailable. Saved reports do not establish verification or DOH submission."],
    ["Pending Verification",null,"The report read does not include a verification status yet. A dash means verification information is unavailable; captured reports are not automatically marked pending or verified."],
    ["Verified Records",null,"Would count records with a confirmed verification outcome. Verification metadata is not supplied yet, so saved census records are not treated as verified or regulator-approved."],
  ];
  const showCurrent=bank;
  const displayedGroups=showCurrent ? currentStock.data?.groups ?? [] : groups;
  const refresh = () => {setCursor(undefined); setRetry(value => value + 1); inventory.manual(); detail.manual();};
  async function copyStockRecord(record:CensusSnapshot){
    if(copyState?.busy||!copyAllowed(record))return;
    const demonstration=demos.find(row=>row.record.snapshotId===record.snapshotId);
    const generation=++copyGeneration.current;
    const current=()=>copyActive.current&&copyGeneration.current===generation;
    setCopyState({key:record.snapshotId,busy:true,message:"Copying…"});
    try{
      if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");
      const value=demonstration?demonstration.snapshot:await retryAfterContextChange(()=>requestJson<unknown>("/api/v2/reports/doh-census/"+encodeURIComponent(record.snapshotId)),current);
      const tsv=checkpointClipboard(value,record);
      if(!current())return;
      // Keep demo provenance in the header while preserving the 8×5 matrix layout.
      await navigator.clipboard.writeText(demonstration?tsv.replace(/^Blood type\t/,"Blood type (Demo)\t"):tsv);
      if(current())setCopyState({key:record.snapshotId,busy:false,message:demonstration?"Copied all 40 demonstration stock values.":"Copied all 40 stock values."});
    }catch{if(current())setCopyState({key:record.snapshotId,busy:false,message:"Could not copy a complete record. Check clipboard permission and refresh before retrying."});}
  }
  function copyIcon(record:CensusSnapshot,label:string){return <ActionButton className="button compact compliance-copy-icon" disabled={!copyAllowed(record)||Boolean(copyState?.busy)} unavailableReason={copyState?.busy?"Finish the current copy first.":"The saved report format must be enabled before copying."} onClick={event=>{event.stopPropagation();void copyStockRecord(record);}} aria-label={label} title={label} aria-busy={copyState?.key===record.snapshotId&&copyState.busy}><ActionIcon kind="copy"/></ActionButton>;}
  const recordedStock = (
    <section className="bank-record-card">
      <header className="bank-section-heading"><h2>Recorded Blood Stock</h2><InformationHelp label="Recorded Blood Stock">{bank ? "Latest label-current available and reserved stock recorded for your facility, grouped by blood type and component. Selecting a saved report updates Report Details without changing this inventory table. " : "Stock captured in the selected saved report, grouped by blood type and component. Select View report to choose a snapshot. "}A dash means unavailable data or missing component coverage. Historical research records are separate from operational inventory.</InformationHelp></header>
      <div className="table-wrap">
        <table className="data-table compliance-stock-table"><thead><tr><th>Blood type</th>{V2_COMPONENT_TYPES.map(component => <th key={component}>{componentLabel(component)}</th>)}<th>Total</th></tr></thead><tbody>{CENSUS_ORDER.map(type => {
          const values = V2_COMPONENT_TYPES.map(component => displayedGroups.find(group => group.componentType === component)?.bloodTypes.find(row => row.bloodType === type)?.reportableCount ?? null);
          return <tr key={type}><td>{formatBloodType(type)}</td>{values.map((value,i) => <td key={V2_COMPONENT_TYPES[i]}>{value ?? "—"}</td>)}<td>{values.every(value => value !== null) ? values.reduce<number>((sum,value) => sum + value!,0) : "—"}</td></tr>;
        })}</tbody></table>
      </div>
      {showCurrent&&!currentStock.data&&<p className="compliance-stock-note" role="status">{currentStock.error ? "Current inventory unavailable. Refresh to try again." : "Loading current inventory…"}</p>}
      {!showCurrent&&!selected&&<p className="compliance-stock-note" role="status">Select View report in Saved Stock Reports to display captured stock.</p>}
      {!showCurrent && selected && <p className="compliance-stock-note" role="status">{detailError || (detail.busy ? "Loading recorded stock…" : groups.length ? "Captured " + formatManilaDateTime(selected.capturedAt) : "Recorded stock unavailable")}</p>}
    </section>
  );
  return <div className="compliance-workspace">
    <header className="page-head consortium-page-head"><h1 className="page-title">Compliance Reports</h1><RefreshButton busy={busy || inventory.busy || currentStock.busy} onRefresh={refresh}/></header>
    {!bank && <div className="consortium-summary-grid">{cards.map(([label,value,help]) => <section className="consortium-summary" key={label}><header className="consortium-summary-title"><span>{label}</span><InformationHelp label={label}>{help}</InformationHelp></header><strong>{value ?? "—"}</strong></section>)}</div>}
    {bank && <section className="bank-record-card">
      <header className="bank-section-heading"><h2>Reporting Checkpoints</h2><InformationHelp label="Reporting Checkpoints">The latest saved 9 AM and 4 PM records remain available until newer records for the same slot arrive. Times use Asia/Manila. Copy includes all eight blood types and five components. Demo-labelled records are frontend examples, not historical captures. Automatic saving still requires the backend scheduler.</InformationHelp></header>
      <div className="compliance-checkpoints">{([ ["09","9:00 AM","Morning Stock Record"],["16","4:00 PM","Afternoon Stock Record"] ] as const).map(([hour,time,label],i)=>{
        const latest=latestReal(hour),record=latest.record??(!latest.ambiguous?demos[i].record:undefined);
        return <div className="compliance-checkpoint" key={hour}>
          <div className="compliance-checkpoint-copy"><span>{time}</span><strong>{label}</strong><small>{record?<>{isDemo(record)&&<span className="compliance-demo-label">Demo · </span>}{formatManilaDateTime(record.scheduledFor)}</>:"Multiple records need review"}</small></div>
          {record?copyIcon(record,"Copy "+label.toLowerCase()):<ActionButton className="button compact compliance-copy-icon" disabled unavailableReason="Multiple saved records need review." aria-label={"Copy "+label.toLowerCase()}><ActionIcon kind="copy"/></ActionButton>}
        </div>;
      })}</div>
      {copyState&&!copyState.busy&&<p className="compliance-copy-status compliance-copy-feedback" role="status">{copyState.message}</p>}
    </section>}
    {bank && recordedStock}
    <div className={"compliance-record-columns"+(bank?" bank-stock-record-columns":"")}>
      {bank?<section className="bank-record-card bank-saved-stock-card">
        <header className="bank-section-heading"><h2>Saved Stock Records</h2><InformationHelp label="Saved Stock Records">Each row represents one saved morning or afternoon checkpoint. Copy includes its complete stock matrix. Demo rows are explicit frontend examples and are not inserted into the reporting database.</InformationHelp></header>
        <div className="compliance-filters compliance-date-filter"><label>Recorded date<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><TableViewBar view={savedView}/></div>
        <PaginatedTable total={savedBankRows.length} ready label="Saved stock records" resetKey={date+"|"+savedView.sortKey}>
          <table className="data-table compliance-record-table bank-stock-record-table"><thead><tr><SortableHeader view={savedView} id="recorded">Time Recorded</SortableHeader><SortableHeader view={savedView} id="copy">Copy</SortableHeader></tr></thead><tbody>{savedView.rows.map(record=><tr key={record.snapshotId} className={selectedId===record.snapshotId?"compliance-selected-row":""} onClick={()=>setSelectedId(record.snapshotId)}>{showSaved("recorded")&&<td><button className="bank-review-link" onClick={()=>setSelectedId(record.snapshotId)} aria-label={"View stock record "+record.snapshotId} aria-pressed={selectedId===record.snapshotId}>{formatManilaDateTime(record.scheduledFor)}</button></td>}{showSaved("copy")&&<td>{copyIcon(record,"Copy stock record "+record.snapshotId)}</td>}</tr>)}{!savedBankRows.length&&<tr><td colSpan={savedView.visibleCount}><div className="requester-records-empty"><strong>No stock records for this date</strong></div></td></tr>}</tbody></table>
        </PaginatedTable>
      </section>:(
      <section className="bank-record-card">
        <header className="bank-section-heading"><h2>Saved Stock Reports</h2><InformationHelp label="Saved Stock Reports">Browse the saved census reports available to your account. {bank ? "Select a record to review its capture details; the inventory table continues showing current stock." : "Select a record to review its capture details and stock matrix."} Saved means a census record exists; it does not establish verification or successful submission to DOH. Filters and pagination apply to loaded records.</InformationHelp></header>
        <div className="compliance-filters"><label>Search records<input type="search" placeholder="Report or institution ID" value={search} onChange={event => setSearch(event.target.value)}/></label><label>Reporting date<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label><TableViewBar view={reportView}/></div>
        <PaginatedTable total={shown.length} ready={Boolean(index)} resetKey={search+"|"+date+"|"+reportView.sortKey} label="Compliance records">
          <table className="data-table compliance-record-table"><thead><tr><SortableHeader view={reportView} id="checkpoint">Reporting checkpoint</SortableHeader><SortableHeader view={reportView} id="facility">Facility</SortableHeader><SortableHeader view={reportView} id="captured">Captured</SortableHeader><SortableHeader view={reportView} id="verification">Verification</SortableHeader><SortableHeader view={reportView} id="actions">Actions</SortableHeader></tr></thead><tbody>{reportView.rows.map(row => <tr key={row.snapshotId} className={selectedId === row.snapshotId ? "compliance-selected-row" : ""}>{showReport("checkpoint")&&<td>{formatManilaDateTime(row.scheduledFor)}</td>}{showReport("facility")&&<td>{row.institutionId === principal.institutionId ? principal.institutionDisplayName : row.institutionId}</td>}{showReport("captured")&&<td>{formatManilaDateTime(row.capturedAt)}</td>}{showReport("verification")&&<td>Not supplied</td>}{showReport("actions")&&<td><button className="button compact" onClick={() => setSelectedId(row.snapshotId)}>View report</button></td>}</tr>)}{shown.length === 0 && <tr><td colSpan={reportView.visibleCount}><div className="requester-records-empty"><strong>{busy ? "Loading reports…" : error ? "Reports unavailable" : index?.snapshots.length ? "No matching records" : "No saved stock reports yet"}</strong><span>{error || "Saved stock records will appear here. Missing reports do not mean there is no inventory."}</span></div></td></tr>}</tbody></table>
        </PaginatedTable>
        {index?.nextCursor && <div className="compliance-load-more"><button className="button compact" disabled={busy} onClick={() => setCursor(index.nextCursor!)}>Load more records</button><small>Pagination covers loaded records.</small></div>}
      </section>
      )}
      <section className="bank-record-card compliance-detail">
        <header className="bank-section-heading"><h2>Report Details</h2><InformationHelp label="Report Details">{bank ? selectedDemo ? "This is a frontend sample stock record, not an observed historical capture. The table contains all eight blood types and five components." : "The selected saved record’s stock matrix contains all eight blood types and five components. It is separate from current inventory." : "Review the selected report’s facility, reporting checkpoint and capture time. Capturing, verification and submission are separate steps. Operator and verification information remain unavailable until those fields are supported."}</InformationHelp></header>
        {bank ? selected ? <>
          {detailError?<p className="compliance-stock-note" role="status">{detailError}</p>:!groups.length?<p className="compliance-stock-note" role="status">Loading recorded stock…</p>:<div className="table-wrap"><table className="data-table compliance-stock-table compliance-detail-stock-table"><thead><tr><th>Blood type</th>{V2_COMPONENT_TYPES.map(component=><th key={component}>{componentLabel(component)}</th>)}<th>Total</th></tr></thead><tbody>{CENSUS_ORDER.map(type=>{
            const values=V2_COMPONENT_TYPES.map(component=>groups.find(group=>group.componentType===component)?.bloodTypes.find(row=>row.bloodType===type)?.reportableCount??null);
            return <tr key={type}><td>{formatBloodType(type)}</td>{values.map((value,i)=><td key={V2_COMPONENT_TYPES[i]}>{value??"—"}</td>)}<td>{values.every(value=>value!==null)?values.reduce<number>((sum,value)=>sum+value!,0):"—"}</td></tr>;
          })}</tbody></table></div>}
        </>:<div className="requester-records-empty"><strong>Select a stock record</strong><span>Click a saved record to view its full stock matrix here.</span></div>:(
        <>{selected ? <dl><dt>Report reference</dt><dd className="mono">{selected.snapshotId}</dd><dt>Facility</dt><dd>{selected.institutionId === principal.institutionId ? principal.institutionDisplayName : selected.institutionId}</dd><dt>Checkpoint</dt><dd>{formatManilaDateTime(selected.scheduledFor)}</dd><dt>Captured</dt><dd>{formatManilaDateTime(selected.capturedAt)}</dd><dt>Captured by</dt><dd>Not supplied</dd><dt>Verification</dt><dd>Not supplied</dd></dl> : <div className="requester-records-empty"><strong>Select a report</strong><span>Choose View report to review its details.</span></div>}</>
        )}
        <footer className="compliance-detail-actions">{bank && <ActionButton className="button compact" disabled  unavailableReason="Report verification is not connected yet. A saved stock report is not automatically verified.">Verify Record</ActionButton>}<ActionButton className="button compact" disabled  unavailableReason="The official compliance-report PDF format is not available yet.">Export PDF</ActionButton></footer>
      </section>
    </div>
    {!bank && recordedStock}
  </div>;
}
