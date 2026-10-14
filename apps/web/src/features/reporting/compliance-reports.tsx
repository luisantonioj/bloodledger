import { ActionButton } from "../../components/ui/action-button";
import { useEffect, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { InformationHelp } from "../../components/ui/information-help";
import { RefreshButton } from "../../components/ui/refresh-button";
import { PaginatedTable } from "../../components/ui/record-pagination";
import { formatBloodType, formatManilaDateTime } from "../../components/ui/display";
import { useLiveData } from "../../hooks/use-live-data";
import { CENSUS_ORDER, readCensusIndex, type CensusIndex, type CensusSnapshot } from "../../services/api/census-index";
import { V2_COMPONENT_TYPES, V2_BLOOD_TYPES } from "../../services/api/v2";
import type { Dashboard } from "../../services/api/types";
import { componentLabel } from "../transfers/requester-transfer-data";

type StockGroup = { componentType: string; bloodTypes: { bloodType: string; availableCount: number; reservedCount: number; reportableCount: number }[] };
// FR-11/12: a captured census is not evidence of verification or regulatory approval.
export function parseComplianceStock(value: unknown, selected: CensusSnapshot): StockGroup[] {
  const row = value as Record<string, unknown> | null;
  if (!row || row.classification !== "SIMULATION_ONLY" || row.snapshotId !== selected.snapshotId || row.scheduledFor !== selected.scheduledFor || row.capturedAt !== selected.capturedAt || row.reportPolicyVersion !== selected.reportPolicyVersion || row.timezone !== "Asia/Manila" || !Array.isArray(row.groups) || !row.groups.length) throw Error("The selected report’s stock detail is unavailable.");
  const seen = new Set<string>();
  for (const group of row.groups as StockGroup[]) {
    if (!group || !V2_COMPONENT_TYPES.includes(group.componentType as typeof V2_COMPONENT_TYPES[number]) || seen.has(group.componentType) || !Array.isArray(group.bloodTypes) || group.bloodTypes.length !== 8 || new Set(group.bloodTypes.map(item => item.bloodType)).size !== 8) throw Error("The report’s component coverage is incomplete.");
    seen.add(group.componentType);
    for (const item of group.bloodTypes) {
      if (!V2_BLOOD_TYPES.includes(item.bloodType as typeof V2_BLOOD_TYPES[number]) || ![item.availableCount,item.reservedCount,item.reportableCount].every(count => Number.isSafeInteger(count) && count >= 0) || item.reportableCount !== item.availableCount + item.reservedCount) throw Error("The report’s stock counts are inconsistent.");
    }
  }
  return row.groups as StockGroup[];
}

export function ComplianceReports({ principal }: { principal: Principal }) {
  const bank = principal.accountCategory === "BLOOD_BANK";
  const [index, setIndex] = useState<CensusIndex>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [retry, setRetry] = useState(0), [cursor, setCursor] = useState<string>();
  const [selectedId, setSelectedId] = useState(""), [search, setSearch] = useState(""), [date, setDate] = useState("");
  const [checkpoint, setCheckpoint] = useState("09:00");
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError("");
    readCensusIndex(principal, controller.signal, cursor).then(next => {
      if (!controller.signal.aborted) setIndex(previous => cursor && previous ? {...next,snapshots:[...new Map([...previous.snapshots,...next.snapshots].map(row => [row.snapshotId,row])).values()]} : next);
    }).catch(reason => { if (!controller.signal.aborted) {setIndex(undefined); setError(reason instanceof Error ? reason.message : "Reports are unavailable.");} }).finally(() => {if (!controller.signal.aborted) setBusy(false);});
    return () => controller.abort();
  }, [principal, retry, cursor]);
  const inventory = useLiveData<Dashboard>("/api/v2/dashboard");
  const selected = index?.snapshots.find(row => row.snapshotId === selectedId);
  const detail = useLiveData<unknown>(selected ? "/api/v2/reports/doh-census/" + encodeURIComponent(selected.snapshotId) : null);
  let groups: StockGroup[] = [], detailError = detail.error;
  if (selected && detail.data) {try {groups = parseComplianceStock(detail.data, selected);} catch(reason) {detailError = reason instanceof Error ? reason.message : "Stock detail unavailable.";}}
  const day = (value: string) => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
  const today = day(new Date().toISOString());
  const shown = index?.snapshots.filter(row => (!date || day(row.scheduledFor) === date) && (!search || [row.snapshotId,row.institutionId].some(value => value.toLowerCase().includes(search.toLowerCase())))) ?? [];
  const validInventory = inventory.data && inventory.data.classification === "SIMULATION_ONLY" && inventory.data.scope === (bank ? "INSTITUTION" : "CITY_AGGREGATE") && inventory.data.lastSuccessfulProjectionAt !== null && Array.isArray(inventory.data.inventory) && inventory.data.inventory.every(row => (!bank || row.institutionId === principal.institutionId) && Number.isSafeInteger(row.confirmedCount) && row.confirmedCount >= 0);
  const currentTotal = validInventory ? inventory.data!.inventory.filter(row => ["AVAILABLE","RESERVED"].includes(row.inventoryStatus)).reduce((sum,row) => sum + row.confirmedCount,0) : null;
  const cards: [string,number|null,string][] = [
    ["Current Inventory",currentTotal,bank ? "Reported available and reserved units for your facility. This current summary is separate from a saved checkpoint report and does not establish compliance." : "Reported available and reserved units across the permitted network scope. Saved reports describe stock at their capture time and may differ from this current summary."],
    ["Reports for Today",index && !index.nextCursor ? index.snapshots.filter(row => day(row.scheduledFor) === today).length : null,"Counts saved stock reports whose reporting checkpoint falls today in Manila time. This is not the number of required reports or reports captured today. An incomplete report list stays unavailable. Saved reports do not establish verification or DOH submission."],
    ["Pending Verification",null,"The report read does not include a verification status yet. A dash means verification information is unavailable; captured reports are not automatically marked pending or verified."],
    ["Verified Records",null,"Would count records with a confirmed verification outcome. Verification metadata is not supplied yet, so saved census records are not treated as verified or regulator-approved."],
  ];
  const refresh = () => {setCursor(undefined); setRetry(value => value + 1); inventory.manual(); detail.manual();};
  return <div className="compliance-workspace">
    <header className="page-head consortium-page-head"><h1 className="page-title">Compliance Reports</h1><RefreshButton busy={busy || inventory.busy} onRefresh={refresh}/></header>
    <div className="consortium-summary-grid">{cards.map(([label,value,help]) => <section className="consortium-summary" key={label}><header className="consortium-summary-title"><span>{label}</span><InformationHelp label={label}>{help}</InformationHelp></header><strong>{value ?? "—"}</strong></section>)}</div>
    {bank && <section className="bank-record-card">
      <header className="bank-section-heading"><h2>Today’s Reporting Checkpoints</h2><InformationHelp label="Reporting Checkpoints">Choose the morning or afternoon stock record to review the reporting layout. Checkpoints are displayed in Manila time. Capture has an existing catch-up API, but this design preview does not submit commands. Operator authorization and report policy integration are required before enabling capture. Verification and official PDF export remain unavailable.</InformationHelp></header>
      <div className="compliance-checkpoints">{[["09:00","9:00 AM","Morning Stock Record"],["16:00","4:00 PM","Afternoon Stock Record"]].map(([value,time,label]) => <button key={value} type="button" className={"compliance-checkpoint" + (checkpoint === value ? " selected" : "")} aria-pressed={checkpoint === value} onClick={() => setCheckpoint(value)}><span>{time}</span><strong>{label}</strong><small>Capture unavailable</small></button>)}</div>
      <footer className="compliance-checkpoint-actions"><span>{today} · {checkpoint === "09:00" ? "9:00 AM" : "4:00 PM"}</span><ActionButton className="button primary compact" disabled  unavailableReason="Report capture is not enabled in this preview. Reporting rules and operator authorization must be connected first.">Capture Snapshot</ActionButton></footer>
    </section>}
    <div className="compliance-record-columns">
      <section className="bank-record-card">
        <header className="bank-section-heading"><h2>Saved Stock Reports</h2><InformationHelp label="Saved Stock Reports">Browse the saved census reports available to your account. Select a record to review its capture details and stock matrix. Saved means a census record exists; it does not establish verification or successful submission to DOH. Filters and pagination apply to loaded records.</InformationHelp></header>
        <div className="compliance-filters"><label>Search records<input type="search" placeholder="Report or institution ID" value={search} onChange={event => setSearch(event.target.value)}/></label><label>Reporting date<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label></div>
        <PaginatedTable total={shown.length} ready={Boolean(index)} resetKey={search+"|"+date} label="Compliance records">
          <table className="data-table compliance-record-table"><thead><tr><th>Reporting checkpoint</th><th>Facility</th><th>Captured</th><th>Verification</th><th>Actions</th></tr></thead><tbody>{shown.map(row => <tr key={row.snapshotId} className={selectedId === row.snapshotId ? "compliance-selected-row" : ""}><td>{formatManilaDateTime(row.scheduledFor)}</td><td>{row.institutionId === principal.institutionId ? principal.institutionDisplayName : row.institutionId}</td><td>{formatManilaDateTime(row.capturedAt)}</td><td>Not supplied</td><td><button className="button compact" onClick={() => setSelectedId(row.snapshotId)}>View report</button></td></tr>)}{shown.length === 0 && <tr><td colSpan={5}><div className="requester-records-empty"><strong>{busy ? "Loading reports…" : error ? "Reports unavailable" : index?.snapshots.length ? "No matching records" : "No saved stock reports yet"}</strong><span>{error || "Saved stock records will appear here. Missing reports do not mean there is no inventory."}</span></div></td></tr>}</tbody></table>
        </PaginatedTable>
        {index?.nextCursor && <div className="compliance-load-more"><button className="button compact" disabled={busy} onClick={() => setCursor(index.nextCursor!)}>Load more records</button><small>Pagination covers loaded records.</small></div>}
      </section>
      <section className="bank-record-card compliance-detail">
        <header className="bank-section-heading"><h2>Report Details</h2><InformationHelp label="Report Details">Review the selected report’s facility, reporting checkpoint and capture time. Capturing, verification and submission are separate steps. Operator and verification information remain unavailable until those fields are supported.</InformationHelp></header>
        {selected ? <dl><dt>Report reference</dt><dd className="mono">{selected.snapshotId}</dd><dt>Facility</dt><dd>{selected.institutionId === principal.institutionId ? principal.institutionDisplayName : selected.institutionId}</dd><dt>Checkpoint</dt><dd>{formatManilaDateTime(selected.scheduledFor)}</dd><dt>Captured</dt><dd>{formatManilaDateTime(selected.capturedAt)}</dd><dt>Captured by</dt><dd>Not supplied</dd><dt>Verification</dt><dd>Not supplied</dd></dl> : <div className="requester-records-empty"><strong>Select a report</strong><span>Choose View report to review its details and recorded stock.</span></div>}
        <footer className="compliance-detail-actions">{bank && <ActionButton className="button compact" disabled  unavailableReason="Report verification is not connected yet. A saved stock report is not automatically verified.">Verify Record</ActionButton>}<ActionButton className="button compact" disabled  unavailableReason="The official compliance-report PDF format is not available yet.">Export PDF</ActionButton></footer>
      </section>
    </div>
    <section className="bank-record-card">
      <header className="bank-section-heading"><h2>Recorded Blood Stock</h2><InformationHelp label="Recorded Blood Stock">Select a saved report to view its captured stock. Use View report in Saved Stock Reports to choose one. Stock captured in the selected report, organized by blood type and component. Values include available and reserved units reported at capture time. A dash means no selected report or missing component coverage, not zero stock. Historical research records are separate from operational inventory.</InformationHelp></header>
      <PaginatedTable total={selected && groups.length ? CENSUS_ORDER.length : 0} ready={Boolean(selected && groups.length)} resetKey={selectedId} label="Recorded stock">
        <table className="data-table compliance-stock-table"><thead><tr><th>Blood type</th>{V2_COMPONENT_TYPES.map(component => <th key={component}>{componentLabel(component)}</th>)}<th>Total</th></tr></thead><tbody>{CENSUS_ORDER.map(type => {
          const values = V2_COMPONENT_TYPES.map(component => groups.find(group => group.componentType === component)?.bloodTypes.find(row => row.bloodType === type)?.reportableCount ?? null);
          return <tr key={type}><td>{formatBloodType(type)}</td>{values.map((value,i) => <td key={V2_COMPONENT_TYPES[i]}>{value ?? "—"}</td>)}<td>{values.every(value => value !== null) ? values.reduce<number>((sum,value) => sum + value!,0) : "—"}</td></tr>;
        })}</tbody></table>
      </PaginatedTable>
      {selected && <p className="compliance-stock-note" role="status">{detailError || (detail.busy ? "Loading recorded stock…" : groups.length ? "Captured " + formatManilaDateTime(selected.capturedAt) : "Recorded stock unavailable")}</p>}
    </section>
  </div>;
}
