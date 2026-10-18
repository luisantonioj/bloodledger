import { labelText } from "../../services/api/label-identity";
import { InventoryStatus, InventoryTimeRemaining, inventoryExpiryDate, inventoryTimeRemaining, inventoryStatusInfo } from "./inventory-presentation";
import { ActionButton } from "../../components/ui/action-button";
import { RecordPagination } from "../../components/ui/record-pagination";
import { SortableHeader, TableViewBar, timeValue, useTableView, type TableColumn } from "../../components/ui/table-view";
import { ActionIcon } from "../../components/ui/action-icon";
import { exportTablePdf } from "../../services/pdf/table-report";
import { InformationHelp } from "../../components/ui/information-help";
import { RefreshButton } from "../../components/ui/refresh-button";
import { componentLabel } from "../transfers/requester-transfer-data";
import { HistoricalStockView } from "./historical-stock-view";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError, retryAfterContextChange } from "../../services/api/client";
import { formatBloodType, formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import { type Principal } from "../../auth/permissions";
import { V2RecordExplorer } from "./v2-record-explorer";
import { selectionFromSearch, type RecordSelection } from "../../services/api/v2-navigation";
import {
  V2_BLOOD_TYPES, V2_COMPONENT_TYPES,
  readInboundIntake,
  readV2Components,
  type InboundIntakeResponse,
  type V2ComponentsResponse,
  type V2ContractVersion,
} from "../../services/api/v2";

const inventoryColumns: TableColumn<V2ComponentsResponse["components"][number]>[] = [
  { id: "unit", label: "Unit ID", sortValue: c => labelText(c.labelIdentity) },
  { id: "bloodType", label: "Blood type", sortValue: c => formatBloodType(c.bloodType) },
  { id: "component", label: "Component", sortValue: c => componentLabel(c.componentType) },
  { id: "expiration", label: "Expiration date", sortValue: c => timeValue(c.expiresAt) },
  { id: "remaining", label: "Time remaining", sortValue: c => timeValue(c.expiresAt) },
  { id: "status", label: "Status", sortValue: c => inventoryStatusInfo(c).label },
];

export function V2InventoryView({ principal }: { principal: Principal }) {
  const [selected, setSelected] = useState<RecordSelection | undefined>(() => selectionFromSearch(location.search));
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState("");
  const [bloodFilter,setBloodFilter]=useState("ALL"),[componentFilter,setComponentFilter]=useState("ALL"),[search,setSearch]=useState("");
  const [expiryFilter,setExpiryFilter]=useState(()=>new URLSearchParams(location.search).get("expiryState")==="LABEL_EXPIRED_PENDING_EVALUATION"?"LABEL_EXPIRED_PENDING_EVALUATION":"ALL");
  const [pageIndex, setPageIndex] = useState(0);
  const [historical, setHistorical] = useState(false);
  const [version, setVersion] = useState<V2ContractVersion>(principal.accountId ? "V2.1" : "V2");
  useEffect(() => setPageIndex(0), [bloodFilter, componentFilter, search, version, expiryFilter, principal.institutionId]);
  const [data, setData] = useState<V2ComponentsResponse>();
  const [intake, setIntake] = useState<InboundIntakeResponse>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<string>();
  const requestSequence = useRef(0);
  const canViewTransactions = principal.accountCategory ? principal.accountCategory === "BLOOD_BANK" : ["ROLE-01", "ROLE-02"].includes(principal.roleId);
  const canReadIntake = ["ROLE-01", "ROLE-02"].includes(principal.roleId);

  const refresh = useCallback(async () => {
    const current = ++requestSequence.current;
    if (!navigator.onLine) {
      setError("Offline. The last confirmed component projection is preserved below.");
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const active = () => current === requestSequence.current;
      const [components, intakeStatus] = await Promise.all([
        retryAfterContextChange(() => readV2Components(version), active),
        canReadIntake ? retryAfterContextChange(() => readInboundIntake(), active) : Promise.resolve(undefined),
      ]);
      if (current !== requestSequence.current) return;
      if (components.components.some(component => component.institutionId !== principal.institutionId)) {
        throw new Error("V2_COMPONENT_SCOPE_MISMATCH");
      }
      setData(components);
      setIntake(intakeStatus);
      setRefreshedAt(new Date().toISOString());
      setError("");
    } catch (reason) {
      if (current !== requestSequence.current) return;
      if ((reason instanceof ApiRequestError && [401, 403].includes(reason.status)) ||
          (reason instanceof Error && ["V2_COMPONENT_SCOPE_MISMATCH", "V2_COMPONENT_RESPONSE_INVALID"].includes(reason.message))) {
        setData(undefined);
        setIntake(undefined);
        setRefreshedAt(undefined);
      }
      setError(reason instanceof Error ? reason.message : "V2 component inventory is unavailable.");
    } finally {
      if (current === requestSequence.current) setBusy(false);
    }
  }, [canReadIntake, principal.institutionId, version]);

  useEffect(() => {
    setData(undefined);
    setIntake(undefined);
    setRefreshedAt(undefined);
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5_000);
    return () => { ++requestSequence.current; clearInterval(timer); };
  }, [refresh]);

  const friendlyError=error==="V2_COMPONENT_RESPONSE_INVALID" ? "Required inventory information is unavailable. Please refresh, or contact your administrator if this continues." : error;
  const components=data?.components??[];
  const visible=components.filter(c=>(expiryFilter==="ALL"||c.expiryState===expiryFilter)&&(bloodFilter==="ALL"||c.bloodType===bloodFilter)&&(componentFilter==="ALL"||c.componentType===componentFilter)&&[labelText(c.labelIdentity),c.componentId,c.donationId,c.inventoryStatus,c.reservationId??""].some(value=>value.toLowerCase().includes(search.trim().toLowerCase()))).sort((a,b)=>Date.parse(a.expiresAt)-Date.parse(b.expiresAt));
  const view=useTableView("bank-inventory",inventoryColumns,visible),show=view.isVisible;
  useEffect(() => setPageIndex(0), [view.sortKey]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 20));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const pageRows = view.rows.slice(currentPage * 20, currentPage * 20 + 20);
  const bloodCounts=components.filter(c=>componentFilter==="ALL"||c.componentType===componentFilter);
  const componentCounts=components.filter(c=>bloodFilter==="ALL"||c.bloodType===bloodFilter);
  async function exportPdf(){setExporting(true);setExportError("");try{await exportTablePdf({title:"Blood Inventory",scope:principal.institutionDisplayName+" · SIMULATION_ONLY",filters:`Loaded rows only; Blood type: ${bloodFilter}; Component: ${componentFilter}; Expiry: ${expiryFilter}; Search: ${search||"None"}; Sort: ${view.sortDescription}`,headers:["Unit ID","Blood type","Component","Expiration date","Time remaining","Status"],rows:view.rows.map(c=>[labelText(c.labelIdentity),formatBloodType(c.bloodType),componentLabel(c.componentType),inventoryExpiryDate(c.expiresAt),inventoryTimeRemaining(c.expiresAt).label,inventoryStatusInfo(c).label]),filename:"blood-inventory"});}catch(reason){setExportError(reason instanceof Error?reason.message:"PDF export failed.");}finally{setExporting(false);}}
  return <div className="v2-inventory blood-bank-inventory"><header className="page-head"><h1 className="page-title">Blood Inventory</h1><div className="bank-toolbar-actions"><ActionButton className="button compact" disabled={!visible.length||exporting||historical} unavailableReason={historical?"PDF export is available for operational inventory only.":exporting?"The PDF is being prepared. Please wait.":"Load inventory records that match your filters before exporting."} onClick={()=>void exportPdf()}><ActionIcon kind="download"/>{exporting?"Exporting…":"Export PDF"}</ActionButton>{canViewTransactions&&<ActionButton className="button compact" disabled  unavailableReason="CSV import is unavailable (RQ-19). Use verified label intake in Blood Unit Transactions instead."><ActionIcon kind="upload"/>Import CSV</ActionButton>}{canViewTransactions&&<a className="button compact" href="/transactions"><ActionIcon kind="scanner"/>Blood Unit Transactions</a>}<RefreshButton busy={busy} onRefresh={()=>void refresh()}/></div></header>{exportError&&<p role="status">{exportError}</p>}{historical ? <><button className="button compact" onClick={()=>setHistorical(false)}>Show operational inventory</button><HistoricalStockView/></> : <div>


    {error&&components.length>0&&<div className="requester-transfer-notice" role="status"><span className="requester-notice-icon" aria-hidden="true">!</span><div className="requester-notice-copy"><strong>Inventory could not refresh</strong><p>{friendlyError}</p>{data&&<p>Showing the last successfully loaded inventory.</p>}</div></div>}




    <>
      <div className="inventory-record-card">
    <section className="bank-filter-panel inventory-filter-controls" aria-label="Inventory filters">
      <label>Blood type<span className="requester-select"><select aria-label="Blood type filter" value={bloodFilter} onChange={event=>setBloodFilter(event.target.value)}><option value="ALL">All blood types</option>{V2_BLOOD_TYPES.map(value=><option key={value} value={value}>{formatBloodType(value)}{data?` (${bloodCounts.filter(c=>c.bloodType===value).length})`:""}</option>)}</select></span></label>
      {expiryFilter!=="ALL"&&<p className="bank-action-note">Label expired, awaiting evaluation <button className="button compact" onClick={()=>{setExpiryFilter("ALL");const query=new URLSearchParams(location.search);query.delete("expiryState");history.replaceState(null,"",location.pathname+(query.size?"?"+query:""));}}>Clear expiry filter</button></p>}<label>Component<span className="requester-select"><select aria-label="Component filter" value={componentFilter} onChange={event=>setComponentFilter(event.target.value)}><option value="ALL">All components</option>{V2_COMPONENT_TYPES.filter(value=>version==="V2.1"||value!=="CRYOPRECIPITATE").map(value=><option key={value} value={value}>{componentLabel(value)}{data?` (${componentCounts.filter(c=>c.componentType===value).length})`:""}</option>)}</select></span></label>
      <label className="bank-search">Search inventory<input type="search" placeholder="Search loaded labels, components or status…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    </section>
      <TableViewBar view={view}/>
      <div className="table-wrap"><table className="data-table inventory-table"><thead><tr><SortableHeader view={view} id="unit">Unit ID</SortableHeader><SortableHeader view={view} id="bloodType">Blood type</SortableHeader><SortableHeader view={view} id="component">Component</SortableHeader><SortableHeader view={view} id="expiration">Expiration date</SortableHeader><SortableHeader view={view} id="remaining">Time remaining</SortableHeader><SortableHeader view={view} id="status">Status</SortableHeader></tr></thead><tbody>{pageRows.map((component) => <tr key={component.componentId}>
        {show("unit")&&<td><button className={"button compact unit-reference "+(component.labelIdentity?.status==="AVAILABLE"?"mono":"label-unavailable")} aria-label={"Open component " + component.componentId} onClick={() => setSelected({kind:"component", id:component.componentId})}>{labelText(component.labelIdentity)}</button></td>}
        {show("bloodType")&&<td><span className="aggregate-plain-text">{formatBloodType(component.bloodType)}</span></td>}
        {show("component")&&<td>{componentLabel(component.componentType)}</td>}
        {show("expiration")&&<td className="data-time mono"><time dateTime={component.expiresAt} title={formatManilaDateTime(component.expiresAt)}>{inventoryExpiryDate(component.expiresAt)}</time></td>}{show("remaining")&&<td><InventoryTimeRemaining expiresAt={component.expiresAt}/></td>}
        {show("status")&&<td><InventoryStatus component={component}/></td>}
      </tr>)}{visible.length===0&&<tr><td colSpan={view.visibleCount}><div className="requester-records-empty inventory-table-empty" aria-live="polite">
        <strong>{!data ? busy ? "Loading inventory…" : error ? "Inventory could not refresh" : "Inventory unavailable" : components.length===0 ? error ? "Inventory could not refresh" : "No blood unit records" : "No components match your filters"}</strong>
        <span>{!data ? "Blood unit records will appear here when inventory is available." : components.length===0 ? "No component records are available in this inventory view." : "Try another blood type, component or search."}</span>
      </div></td></tr>}</tbody></table></div>
      <RecordPagination total={visible.length} page={currentPage} onPage={setPageIndex} label="Inventory"/>
      </div>
      <p className="v2-freshness">Last refresh: {refreshedAt ? formatManilaDateTime(refreshedAt) : "Unavailable"} · {version}</p>
    </>
    <div className="bank-page-toolbar">
      <details className="bank-view-options"><summary>Inventory view options</summary><div><label>Contract view<span className="requester-select"><select value={version} onChange={event=>{++requestSequence.current;setData(undefined);setIntake(undefined);setRefreshedAt(undefined);setVersion(event.target.value as V2ContractVersion);setComponentFilter("ALL");}}><option value="V2">V2 core components</option><option value="V2.1">V2.1 including cryoprecipitate</option></select></span></label>{canReadIntake&&principal.institutionId==="INST_MEDIATRIX"&&<button className="button compact" onClick={()=>setHistorical(true)}>Historical synthetic stock</button>}</div></details>

    </div>
    {intake && <details className="inventory-intake-options"><summary>Inbound intake status</summary><section className="v2-intake-status">
      <header><h3>Inbound intake status</h3><InformationHelp label="Inbound intake status">Track queued, failed and conflicted intake commands separately from committed inventory. A queued intake is not an available blood component.</InformationHelp></header>
      <div>{Object.entries(intake.statuses).length === 0
        ? <article><strong>0</strong><span>No intake commands recorded</span></article>
        : Object.entries(intake.statuses).map(([status, count]) => <article key={status}><strong>{count}</strong><span className={statusClassName(status)}>{humanizeCode(status)}</span></article>)}</div>
      <footer>Included inventory states: {intake.includedInventoryStatuses.map(humanizeCode).join(", ")}. Excluded intake: {intake.excludedFromInventory.map(humanizeCode).join(", ")}.</footer>
    </section></details>}
  </div>}{selected && <V2RecordExplorer key={selected.kind + selected.id} initial={selected} principal={principal} showRecovery={false} onClose={() => setSelected(undefined)} onRefresh={() => void refresh()}/>}</div>;
}
