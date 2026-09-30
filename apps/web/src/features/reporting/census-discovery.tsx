import { useEffect, useState } from "react";
import { formatManilaDateTime, humanizeCode } from "../../components/ui/display";
import { readCensusIndex, type CensusIndex } from "../../services/api/v2";

export function CensusDiscovery() {
  const [census, setCensus] = useState<CensusIndex>();
  const [error, setError] = useState("");
  useEffect(() => { void readCensusIndex().then(setCensus).catch((reason) => setError(reason instanceof Error ? reason.message : "Census discovery is unavailable.")); }, []);
  async function loadMore() {
    if (!census?.nextCursor) return;
    try { const page = await readCensusIndex(census.nextCursor); setCensus({ ...page, snapshots: [...census.snapshots, ...page.snapshots] }); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Census discovery is unavailable."); }
  }
  return <section className="evidence-section"><header><div><h3>DOH census snapshots</h3><p>Authorized existing snapshots only. Capture, copy, and export await full report-format approval.</p></div><span>SIMULATION ONLY</span></header>
    {error && <p role="alert">{error}</p>}
    {census && <><p>Display order: {census.displayBloodTypeOrder.map(humanizeCode).join(" · ")} · calculated Total. Policy: {census.displayPolicyVersion}.</p>
      {census.snapshots.length === 0 ? <p>No authorized snapshots are available.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Snapshot</th><th>Institution</th><th>Scheduled</th><th>Captured</th><th>Policy</th></tr></thead><tbody>{census.snapshots.map((item) => <tr key={item.snapshotId}><td className="mono">{item.snapshotId}</td><td>{item.institutionId}</td><td>{formatManilaDateTime(item.scheduledFor)}</td><td>{formatManilaDateTime(item.capturedAt)}</td><td>{item.reportPolicyVersion}</td></tr>)}</tbody></table></div>}
      {census.nextCursor && <button className="button compact" type="button" onClick={() => void loadMore()}>Load more</button>}
    </>}
    <button className="button" type="button" disabled title="Full DOH report format remains unapproved">Copy or export census</button>
  </section>;
}
