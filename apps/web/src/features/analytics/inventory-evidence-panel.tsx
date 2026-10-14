import { useEffect, useState } from "react";
import { InformationHelp } from "../../components/ui/information-help";
import { humanizeCode } from "../../components/ui/display";
import { readInventoryEvidence, type InventoryEvidence } from "../../services/api/inventory-evidence";

export function InventoryEvidencePanel({ businessDate, institutionId, refreshKey }: { businessDate: string; institutionId: string; refreshKey: number }) {
  const [result, setResult] = useState<{ key: string; data?: InventoryEvidence; error?: string }>();
  const key = `${institutionId}|${businessDate}|${refreshKey}`;
  useEffect(() => {
    let active = true;
    setResult(undefined);
    void readInventoryEvidence(businessDate, institutionId).then(data => { if (active) setResult({ key, data }); }).catch(() => { if (active) setResult({ key, error: "Validated inventory evidence could not be loaded." }); });
    return () => { active = false; };
  }, [businessDate, institutionId, key]);
  const current = result?.key === key ? result : undefined;
  const data = current?.data;
  const snapshot = data?.snapshot;
  const capturedAt = snapshot ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.capturedAt)) : undefined;
  const bloodTypes: Record<string, string> = { A_POSITIVE: "A+", A_NEGATIVE: "A−", B_POSITIVE: "B+", B_NEGATIVE: "B−", O_POSITIVE: "O+", O_NEGATIVE: "O−", AB_POSITIVE: "AB+", AB_NEGATIVE: "AB−" };
  return <section className="analytics-preview-panel inventory-evidence" aria-label="Recorded inventory">
    <header><h3>Recorded inventory</h3><InformationHelp label="Recorded inventory">This is a separate inventory snapshot for comparison with demand estimates. It is not a forecast or a live inventory count. Check the capture date; older snapshots describe historical stock. Missing inventory means unavailable, not zero.</InformationHelp></header>
    <details className="analytics-stock-details"><summary>View inventory snapshot<span>{capturedAt ? `${data?.status === "CURRENT" ? "Current" : "Stale"} · ${capturedAt}` : "Unavailable"}</span></summary>
      {!current && <div className="analytics-empty" role="status"><strong>Loading inventory…</strong></div>}
      {current && !snapshot && <div className="analytics-empty" role={current.error ? "alert" : "status"}><strong>No inventory snapshot available</strong><p>{current.error ?? "Refresh or choose another date to check for a recorded snapshot."}</p></div>}
      {snapshot && <div className="table-wrap"><table className="data-table"><thead><tr><th>Component</th><th>Blood type</th><th>Available</th><th>Reserved</th><th>Total recorded</th></tr></thead><tbody>{snapshot.groups.flatMap(group => group.bloodTypes.map(row => <tr key={group.componentType + row.bloodType}><td>{humanizeCode(group.componentType)}</td><td>{bloodTypes[row.bloodType] ?? humanizeCode(row.bloodType)}</td><td>{row.availableCount}</td><td>{row.reservedCount}</td><td>{row.reportableCount}</td></tr>))}</tbody></table></div>}
    </details>
  </section>;
}
