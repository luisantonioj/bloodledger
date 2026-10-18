import { retryAfterContextChange } from "../../services/api/client";
import { useEffect, useState } from "react";
import { InformationHelp } from "../../components/ui/information-help";
import { humanizeCode } from "../../components/ui/display";
import { SortableHeader, TableViewBar, useTableView, type TableColumn } from "../../components/ui/table-view";
import { readInventoryEvidence, type InventoryEvidence } from "../../services/api/inventory-evidence";

const bloodTypes: Record<string, string> = { A_POSITIVE: "A+", A_NEGATIVE: "A−", B_POSITIVE: "B+", B_NEGATIVE: "B−", O_POSITIVE: "O+", O_NEGATIVE: "O−", AB_POSITIVE: "AB+", AB_NEGATIVE: "AB−" };
type EvidenceGroup = NonNullable<InventoryEvidence["snapshot"]>["groups"][number];
type EvidenceRow = EvidenceGroup["bloodTypes"][number] & { componentType: string };
const evidenceColumns: TableColumn<EvidenceRow>[] = [
  { id: "component", label: "Component", sortValue: row => humanizeCode(row.componentType) },
  { id: "bloodType", label: "Blood type", sortValue: row => bloodTypes[row.bloodType] ?? humanizeCode(row.bloodType) },
  { id: "available", label: "Available", sortValue: row => row.availableCount },
  { id: "reserved", label: "Reserved", sortValue: row => row.reservedCount },
  { id: "total", label: "Total recorded", sortValue: row => row.reportableCount },
];
export function InventoryEvidencePanel({ businessDate, institutionId, refreshKey }: { businessDate: string; institutionId: string; refreshKey: number }) {
  const [result, setResult] = useState<{ key: string; data?: InventoryEvidence; error?: string }>();
  const key = `${institutionId}|${businessDate}|${refreshKey}`;
  useEffect(() => {
    let active = true;
    setResult(undefined);
    void retryAfterContextChange(() => readInventoryEvidence(businessDate, institutionId), () => active).then(data => { if (active) setResult({ key, data }); }).catch(() => { if (active) setResult({ key, error: "Validated inventory evidence could not be loaded." }); });
    return () => { active = false; };
  }, [businessDate, institutionId, key]);
  const current = result?.key === key ? result : undefined;
  const data = current?.data;
  const snapshot = data?.snapshot;
  const capturedAt = snapshot ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.capturedAt)) : undefined;
  const view = useTableView("inventory-evidence", evidenceColumns, snapshot?.groups.flatMap(group => group.bloodTypes.map(row => ({ ...row, componentType: group.componentType }))) ?? []), show = view.isVisible;
  return <section className="analytics-preview-panel inventory-evidence" aria-label="Recorded inventory">
    <header><h3>Recorded inventory</h3><InformationHelp label="Recorded inventory">This is a separate inventory snapshot for comparison with demand estimates. It is not a forecast or a live inventory count. Check the capture date; older snapshots describe historical stock. Missing inventory means unavailable, not zero.</InformationHelp></header>
    <details className="analytics-stock-details"><summary>View inventory snapshot<span>{capturedAt ? `${data?.status === "CURRENT" ? "Current" : "Stale"} · ${capturedAt}` : "Unavailable"}</span></summary>
      {!current && <div className="analytics-empty" role="status"><strong>Loading inventory…</strong></div>}
      {current && !snapshot && <div className="analytics-empty" role={current.error ? "alert" : "status"}><strong>No inventory snapshot available</strong><p>{current.error ?? "Refresh or choose another date to check for a recorded snapshot."}</p></div>}
      {snapshot && <><TableViewBar view={view}/><div className="table-wrap"><table className="data-table"><thead><tr><SortableHeader view={view} id="component">Component</SortableHeader><SortableHeader view={view} id="bloodType">Blood type</SortableHeader><SortableHeader view={view} id="available">Available</SortableHeader><SortableHeader view={view} id="reserved">Reserved</SortableHeader><SortableHeader view={view} id="total">Total recorded</SortableHeader></tr></thead><tbody>{view.rows.map(row => <tr key={row.componentType + row.bloodType}>{show("component")&&<td>{humanizeCode(row.componentType)}</td>}{show("bloodType")&&<td>{bloodTypes[row.bloodType] ?? humanizeCode(row.bloodType)}</td>}{show("available")&&<td>{row.availableCount}</td>}{show("reserved")&&<td>{row.reservedCount}</td>}{show("total")&&<td>{row.reportableCount}</td>}</tr>)}</tbody></table></div></>}
    </details>
  </section>;
}
