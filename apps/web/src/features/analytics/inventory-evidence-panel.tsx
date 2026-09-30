import { useEffect, useState } from "react";
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
  return <section className="analytics-preview-panel forecast-evidence inventory-evidence" aria-label="Independent inventory evidence">
    <header><div><h3>Independent inventory evidence</h3><p>Committed projection snapshot evidence; operational recommendations remain disabled.</p></div></header>
    {!current && <p role="status">Loading inventory evidence…</p>}
    {current && !snapshot && <div className="analytics-preview-state" role={current.error ? "alert" : "status"}><div><strong>Inventory validity unavailable</strong><p>{current.error ?? "Unknown inventory remains unavailable, never zero."}</p>{data?.unavailableReason && <small>{humanizeCode(data.unavailableReason)}</small>}</div></div>}
    {snapshot && <>
      <p role="status">{data.status === "CURRENT" ? "Current synthetic inventory evidence" : "Stale inventory evidence — historical counts only"}</p>
      <dl><dt>Snapshot</dt><dd>{snapshot.snapshotId}</dd><dt>Captured (UTC)</dt><dd>{snapshot.capturedAt}</dd><dt>Captured (Asia/Manila)</dt><dd>{new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.capturedAt))}</dd><dt>Evaluated (UTC / Manila date)</dt><dd>{data.evaluatedAt} / {data.evaluationDate}</dd><dt>Coverage</dt><dd>Complete: 40 persisted series; explicit zero rows verified</dd><dt>Projection evidence</dt><dd>{snapshot.sourceProjectionDigest} · watermark {snapshot.projectionWatermark}</dd><dt>Snapshot schema / policy</dt><dd>{snapshot.schemaVersion} / {snapshot.reportPolicyVersion}</dd></dl>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Component</th><th>Blood type</th><th>Available</th><th>Reserved</th><th>Reportable</th><th>Forecast-eligible available</th></tr></thead><tbody>{snapshot.groups.flatMap(group => group.bloodTypes.map(row => <tr key={group.componentType + row.bloodType}><td>{humanizeCode(group.componentType)}</td><td>{humanizeCode(row.bloodType)}</td><td>{row.availableCount === 0 ? "0 (verified)" : row.availableCount}</td><td>{row.reservedCount}</td><td>{row.reportableCount}</td><td>{row.forecastEligibleAvailableCount}</td></tr>))}</tbody></table></div>
    </>}
    <footer>SIMULATION_ONLY · DISABLED_UNAPPROVED_POLICY. No stock-dependent recommendation is enabled.</footer>
  </section>;
}
