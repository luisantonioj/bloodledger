import { useEffect, useMemo, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { useLiveData } from "../../hooks/use-live-data";
import type { Dashboard } from "../../services/api/types";
import { CENSUS_ORDER } from "../../services/api/census-index";
import { formatBloodType, formatManilaDateTime } from "../../components/ui/display";
import { InformationHelp } from "../../components/ui/information-help";
import { RefreshButton } from "../../components/ui/refresh-button";
import { componentLabel } from "../transfers/requester-transfer-data";
import { useCheckpointRecords } from "../dashboard/use-checkpoint-records";
import { checkpointComponents } from "./checkpoint-copy";

interface CensusDetail { snapshotId: string; capturedAt: string; scheduledFor: string; reportPolicyVersion: string; groups: { componentType: string; bloodTypes: { bloodType: string; availableCount: number; reservedCount: number; reportableCount: number }[] }[] }

const recordLabel = (scheduledFor: string) => formatManilaDateTime(scheduledFor);

// Network-wide view of the saved 09:00/16:00 stock records: choose a blood bank and one of its
// records, then read it as the same blood type × product matrix blood banks copy for DOH.
export function SavedStockRecordsView({ principal }: { principal: Principal }) {
  const records = useCheckpointRecords(principal, true);
  const network = useLiveData<Dashboard>("/api/v2/dashboard");
  const names = useMemo(() => new Map((network.data?.inventory ?? []).map(row => [row.institutionId, row.institutionDisplayName])), [network.data]);
  const snapshots = useMemo(() => [...(records.snapshots ?? [])].sort((a, b) => Date.parse(b.scheduledFor) - Date.parse(a.scheduledFor)), [records.snapshots]);
  const banks = useMemo(() => [...new Set(snapshots.map(row => row.institutionId))].sort((a, b) => (names.get(a) ?? a).localeCompare(names.get(b) ?? b)), [snapshots, names]);
  const [bank, setBank] = useState(""), [recordId, setRecordId] = useState("");
  const activeBank = banks.includes(bank) ? bank : banks[0] ?? "";
  const bankRecords = snapshots.filter(row => row.institutionId === activeBank);
  const activeRecord = bankRecords.find(row => row.snapshotId === recordId) ?? bankRecords[0];
  useEffect(() => { setRecordId(""); }, [activeBank]);
  const detail = useLiveData<CensusDetail>(activeRecord ? "/api/v2/reports/doh-census/" + activeRecord.snapshotId : null);
  const shown = detail.data && detail.data.snapshotId === activeRecord?.snapshotId ? detail.data : undefined;
  const components = shown ? checkpointComponents(shown.reportPolicyVersion) : [];
  const cell = (component: string, bloodType: string) => shown?.groups.find(group => group.componentType === component)?.bloodTypes.find(row => row.bloodType === bloodType);
  const message = records.error ? ["Saved stock records are unavailable", records.error] : records.busy ? ["Loading saved stock records…", "Reading every blood bank's saved records."] : !snapshots.length ? ["No saved stock records yet", "Blood banks' 9:00 AM and 4:00 PM records appear here once saved."] : detail.error ? ["This record could not be loaded", detail.error] : ["Loading record…", "Reading the selected stock record."];
  const busy = records.busy || network.busy || detail.busy;
  function refresh() { window.dispatchEvent(new Event("bloodledger:dashboard-refresh")); network.manual(); detail.manual(); }
  return <>
  <header className="page-head"><h1 className="page-title">Reports</h1><div className="dashboard-actions">{shown && <span className="dashboard-updated" title="When the selected stock record was saved · Asia/Manila">Captured <time dateTime={shown.capturedAt}>{formatManilaDateTime(shown.capturedAt)}</time> · {components.length} products</span>}<RefreshButton busy={busy} onRefresh={refresh}/></div></header>
  <section className="bank-record-card saved-stock-records" aria-labelledby="saved-stock-records-heading">
    <header className="bank-section-heading"><h2 id="saved-stock-records-heading">Saved Stock Records</h2><InformationHelp label="Saved Stock Records">Each blood bank's stock is saved automatically at 9:00 AM and 4:00 PM (Manila time). Choose a blood bank and one of its saved records to see the stock it reported, grouped by blood type and product. Each count includes available and reserved units. These records are separate from live inventory and are not a DOH submission.</InformationHelp></header>
    {snapshots.length > 0 && <div className="bank-list-filters saved-stock-filters">
      <label>Blood bank<span className="requester-select"><select aria-label="Blood bank" value={activeBank} onChange={event => setBank(event.target.value)}>{banks.map(id => <option key={id} value={id}>{names.get(id) ?? id}</option>)}</select></span></label>
      <label>Saved record<span className="requester-select"><select aria-label="Saved record" value={activeRecord?.snapshotId ?? ""} onChange={event => setRecordId(event.target.value)}>{bankRecords.map(row => <option key={row.snapshotId} value={row.snapshotId}>{recordLabel(row.scheduledFor)}</option>)}</select></span></label>
    </div>}
    {shown ? <div className="table-wrap"><table className="data-table compliance-stock-table compliance-detail-stock-table saved-stock-table"><thead><tr><th>Blood type</th>{components.map(component => <th key={component}>{componentLabel(component)}</th>)}<th>Total</th></tr></thead><tbody>
      {CENSUS_ORDER.map(type => {
        const values = components.map(component => cell(component, type));
        const total = values.reduce((sum, row) => sum + (row?.reportableCount ?? 0), 0);
        return <tr key={type}><td><strong>{formatBloodType(type)}</strong></td>{values.map((row, index) => <td key={components[index]} title={row ? `${row.availableCount} available · ${row.reservedCount} reserved` : undefined}>{row?.reportableCount ?? "—"}</td>)}<td><strong>{total}</strong></td></tr>;
      })}
    </tbody></table></div>
      : <div className="requester-records-empty census-report-empty" role="status"><strong>{message[0]}</strong><span>{message[1]}</span></div>}
  </section>
  </>;
}
