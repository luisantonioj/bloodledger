import { ActionIcon } from "../../components/ui/action-icon";
import { exportTablePdf } from "../../services/pdf/table-report";
import { InformationHelp } from "../../components/ui/information-help";
import { RefreshButton } from "../../components/ui/refresh-button";
import { componentLabel } from "../transfers/requester-transfer-data";
import { HistoricalStockView } from "./historical-stock-view";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../services/api/client";
import { BloodTypeBadge } from "../../components/ui/aggregate-tables";
import { formatBloodType, formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import { type Principal } from "../../auth/permissions";
import { V2RecordExplorer } from "./v2-record-explorer";
import { ExpiryState } from "./expiry-state";
import { selectionFromSearch, type RecordSelection } from "../../services/api/v2-navigation";
import {
  V2_BLOOD_TYPES, V2_COMPONENT_TYPES,
  readInboundIntake,
  readV2Components,
  type InboundIntakeResponse,
  type V2ComponentsResponse,
  type V2ContractVersion,
} from "../../services/api/v2";

export function V2InventoryView({ principal }: { principal: Principal }) {
  const [selected, setSelected] = useState<RecordSelection | undefined>(() => selectionFromSearch(location.search));
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState("");
  const [bloodFilter,setBloodFilter]=useState("ALL"),[componentFilter,setComponentFilter]=useState("ALL"),[search,setSearch]=useState("");
  const [historical, setHistorical] = useState(false);
  const [version, setVersion] = useState<V2ContractVersion>(principal.accountId ? "V2.1" : "V2");
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
      const [components, intakeStatus] = await Promise.all([
        readV2Components(version),
        canReadIntake ? readInboundIntake() : Promise.resolve(undefined),
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
  const visible=components.filter(c=>(bloodFilter==="ALL"||c.bloodType===bloodFilter)&&(componentFilter==="ALL"||c.componentType===componentFilter)&&[c.componentId,c.donationId,c.inventoryStatus,c.reservationId??""].some(value=>value.toLowerCase().includes(search.trim().toLowerCase()))).sort((a,b)=>Date.parse(a.expiresAt)-Date.parse(b.expiresAt));
  const bloodCounts=components.filter(c=>componentFilter==="ALL"||c.componentType===componentFilter);
  const componentCounts=components.filter(c=>bloodFilter==="ALL"||c.bloodType===bloodFilter);
  async function exportPdf(){setExporting(true);setExportError("");try{await exportTablePdf({title:"Blood Inventory",scope:principal.institutionDisplayName,filters:`Blood type: ${bloodFilter}; Component: ${componentFilter}; Search: ${search||"None"}`,headers:["Component ID","Blood type","Component","Expiration","Expiry evidence","Inventory status"],rows:visible.map(c=>[c.componentId,formatBloodType(c.bloodType),componentLabel(c.componentType),formatManilaDateTime(c.expiresAt),humanizeCode(c.expiryState),humanizeCode(c.inventoryStatus)]),filename:"blood-inventory"});}catch(reason){setExportError(reason instanceof Error?reason.message:"PDF export failed.");}finally{setExporting(false);}}
  return <div className="v2-inventory blood-bank-inventory"><header className="page-head"><h1 className="page-title">Blood Inventory</h1><div className="bank-toolbar-actions"><button className="button compact" disabled={!visible.length||exporting||historical} onClick={()=>void exportPdf()}><ActionIcon kind="download"/>{exporting?"Exporting…":"Export PDF"}</button>{canViewTransactions&&<button className="button compact" disabled title="CSV import is not supported. Use verified OCR intake in Blood Unit Transactions."><ActionIcon kind="upload"/>Import CSV</button>}{canViewTransactions&&<a className="button compact" href="/transactions"><ActionIcon kind="scanner"/>Blood Unit Transactions</a>}<RefreshButton busy={busy} onRefresh={()=>void refresh()}/></div></header>{exportError&&<p role="status">{exportError}</p>}{historical ? <><button className="button compact" onClick={()=>setHistorical(false)}>Show operational inventory</button><HistoricalStockView/></> : <div>
    <div className="bank-page-toolbar">
      <details className="bank-view-options"><summary>Inventory view options</summary><div><label>Contract view<span className="requester-select"><select value={version} onChange={event=>{++requestSequence.current;setData(undefined);setIntake(undefined);setRefreshedAt(undefined);setVersion(event.target.value as V2ContractVersion);setComponentFilter("ALL");}}><option value="V2">V2 core components</option><option value="V2.1">V2.1 including cryoprecipitate</option></select></span></label>{canReadIntake&&principal.institutionId==="INST_MEDIATRIX"&&<button className="button compact" onClick={()=>setHistorical(true)}>Historical synthetic stock</button>}</div></details>

    </div>
    <section className="bank-filter-panel inventory-filter-controls" aria-label="Inventory filters">
      <label>Blood type<span className="requester-select"><select aria-label="Blood type filter" value={bloodFilter} onChange={event=>setBloodFilter(event.target.value)}><option value="ALL">All blood types</option>{V2_BLOOD_TYPES.map(value=><option key={value} value={value}>{formatBloodType(value)}{data?` (${bloodCounts.filter(c=>c.bloodType===value).length})`:""}</option>)}</select></span></label>
      <label>Component<span className="requester-select"><select aria-label="Component filter" value={componentFilter} onChange={event=>setComponentFilter(event.target.value)}><option value="ALL">All components</option>{V2_COMPONENT_TYPES.filter(value=>version==="V2.1"||value!=="CRYOPRECIPITATE").map(value=><option key={value} value={value}>{componentLabel(value)}{data?` (${componentCounts.filter(c=>c.componentType===value).length})`:""}</option>)}</select></span></label>
      <label className="bank-search">Search inventory<input type="search" placeholder="Search by component ID, reservation or status…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    </section>

    {error&&<div className="requester-transfer-notice" role="status"><span className="requester-notice-icon" aria-hidden="true">!</span><div className="requester-notice-copy"><strong>Inventory could not refresh</strong><p>{friendlyError}</p>{data&&<p>Showing the last successfully loaded inventory.</p>}</div><button className="button compact dashboard-refresh" disabled={busy} onClick={()=>void refresh()}>Retry inventory</button></div>}
    {!data&&<div className="requester-records-empty"><strong>{busy?"Loading inventory…":"Inventory unavailable"}</strong><span>{busy?"Waiting for your facility’s confirmed component records.":"Inventory will appear once its required information is available."}</span></div>}

    {intake && <details className="inventory-intake-options"><summary>Inbound intake status</summary><section className="v2-intake-status">
      <header><h3>Inbound intake status</h3><InformationHelp label="Inbound intake status">Track queued, failed and conflicted intake commands separately from committed inventory. A queued intake is not an available blood component.</InformationHelp></header>
      <div>{Object.entries(intake.statuses).length === 0
        ? <article><strong>0</strong><span>No intake commands recorded</span></article>
        : Object.entries(intake.statuses).map(([status, count]) => <article key={status}><strong>{count}</strong><span className={statusClassName(status)}>{humanizeCode(status)}</span></article>)}</div>
      <footer>Included inventory states: {intake.includedInventoryStatuses.map(humanizeCode).join(", ")}. Excluded intake: {intake.excludedFromInventory.map(humanizeCode).join(", ")}.</footer>
    </section></details>}

    {data && data.components.length === 0 && <div className="empty inventory-empty"><span className="empty-mark" aria-hidden="true">BL</span><strong>No committed V2 components</strong>No component projection is available for this institution and contract view. This is not displayed as zero city-wide stock.</div>}

    {data && data.components.length > 0 && <>
      <header className="bank-section-heading"><h2>Committed component registry</h2><span>{visible.length} of {components.length} components</span><InformationHelp label="Component registry">Select a component ID to inspect its confirmed inventory state, linked reservation and expiry evidence. Only opaque record references are shown. Rows are sorted by label expiry; an expired label does not automatically change the ledger state.</InformationHelp></header>
      <div className="table-wrap"><table className="data-table inventory-table"><thead><tr><th>Component ID</th><th>Blood type</th><th>Component</th><th>Expiration date</th><th>Time remaining</th><th>Status</th></tr></thead><tbody>{visible.map((component) => <tr key={component.componentId}>
        <td><button className="button compact unit-reference mono" aria-label={"Open component " + component.componentId} onClick={() => setSelected({kind:"component", id:component.componentId})}>{component.componentId}</button><small className="v2-secondary-id">{component.donationId}</small></td>
        <td><BloodTypeBadge value={component.bloodType}/></td>
        <td>{componentLabel(component.componentType)}</td>
        <td className="data-time">{formatManilaDateTime(component.expiresAt)}</td><td>{Math.max(0,Math.ceil((Date.parse(component.expiresAt)-Date.now())/86400000))} days<br/><ExpiryState state={component.expiryState}/></td>
        <td><span className={statusClassName(component.inventoryStatus)}>{humanizeCode(component.inventoryStatus)}</span>{component.reservationId&&<button className="requester-record-link mono" aria-label={"Open reservation "+component.reservationId} onClick={()=>setSelected({kind:"reservation",id:component.reservationId!})}>View reservation</button>}</td>
      </tr>)}{visible.length===0&&<tr><td colSpan={6}><div className="requester-records-empty"><strong>No components match your filters</strong><span>Try another blood type, component or search.</span></div></td></tr>}</tbody></table></div>
      <p className="v2-freshness">Last successful browser refresh: {refreshedAt ? formatManilaDateTime(refreshedAt) : "Unavailable"} · {version}</p>
    </>}
  </div>}{selected && <V2RecordExplorer key={selected.kind + selected.id} initial={selected} principal={principal} onClose={() => setSelected(undefined)} onRefresh={() => void refresh()}/>}</div>;
}
