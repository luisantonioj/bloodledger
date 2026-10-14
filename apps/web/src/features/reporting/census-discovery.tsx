import { ActionButton } from "../../components/ui/action-button";
import { PaginatedTable } from "../../components/ui/record-pagination";
import { RefreshIcon } from "../../components/ui/refresh-button";
import { useEffect, useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { formatManilaDateTime, humanizeCode } from "../../components/ui/display";
import { readCensusIndex, type CensusIndex } from "../../services/api/census-index";

export function CensusDiscovery({ principal }: { principal: Principal }) {
  const [census, setCensus] = useState<CensusIndex>(), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const controller = useRef<AbortController | undefined>(undefined), generation = useRef(0);
  async function load(cursor?: string) {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    const current = ++generation.current; setBusy(true); setError("");
    if (!cursor) setCensus(undefined);
    try {
      const next = await readCensusIndex(principal, request.signal, cursor);
      if (current !== generation.current) return;
      setCensus(previous => ({...next, snapshots:cursor && previous ? [...new Map([...previous.snapshots, ...next.snapshots].map(row => [row.snapshotId, row])).values()] : next.snapshots}));
    } catch (reason) {
      if (current !== generation.current) return;
      setCensus(undefined); setError(reason instanceof Error ? reason.message : "Census discovery unavailable.");
    } finally {if (current === generation.current) setBusy(false);}
  }
  useEffect(() => {void load(); return () => {generation.current++; controller.current?.abort();};}, [principal, retry]);
  return <section className="evidence-section" aria-label="DOH census discovery"><header><div><h3>DOH census snapshots</h3><p>Existing authorized snapshots. Capture, copy, and export remain disabled pending full report-format approval.</p></div><span>SIMULATION_ONLY</span></header>
    {busy && <p role="status">Loading authorized census snapshots…</p>}{error && <p role="alert">{error}</p>}
    <button className="button compact refresh-icon-button" disabled={busy} onClick={() => setRetry(value => value + 1)}><RefreshIcon/>Refresh census snapshots</button>
    {census && <><p>Scope: {humanizeCode(census.scope)} · {census.displayPolicyVersion}. Display order: {census.displayBloodTypeOrder.map(humanizeCode).join(" · ")} · calculated Total.</p>
      {census.snapshots.length ? <PaginatedTable total={census.snapshots.length} label="Census snapshots"><table className="data-table"><thead><tr><th>Snapshot</th><th>Institution</th><th>Scheduled (Manila)</th><th>Captured (Manila)</th><th>Policy</th><th>Trigger</th></tr></thead><tbody>{census.snapshots.map(row => <tr key={row.snapshotId}><td className="mono">{row.snapshotId}</td><td>{row.institutionId}</td><td>{formatManilaDateTime(row.scheduledFor)}</td><td>{formatManilaDateTime(row.capturedAt)}</td><td>{row.reportPolicyVersion}</td><td>{humanizeCode(row.triggerType)}</td></tr>)}</tbody></table></PaginatedTable> : <p>No authorized census snapshots are returned. This does not establish zero inventory.</p>}
      {census.nextCursor && <button className="button" disabled={busy} onClick={() => void load(census.nextCursor!)}>Load more census snapshots</button>}</>}
    <ActionButton className="button" disabled  unavailableReason="Full DOH report format remains unapproved">Copy or export census</ActionButton>
  </section>;
}
