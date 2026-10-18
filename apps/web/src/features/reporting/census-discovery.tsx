import { retryAfterContextChange } from "../../services/api/client";
import { ActionButton } from "../../components/ui/action-button";
import { PaginatedTable } from "../../components/ui/record-pagination";
import { SortableHeader, TableViewBar, timeValue, useTableView, type TableColumn } from "../../components/ui/table-view";
import { RefreshIcon } from "../../components/ui/refresh-button";
import { useEffect, useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { formatManilaDateTime, humanizeCode } from "../../components/ui/display";
import { readCensusIndex, type CensusIndex, type CensusSnapshot } from "../../services/api/census-index";

const snapshotColumns: TableColumn<CensusSnapshot>[] = [
  { id: "snapshot", label: "Snapshot", sortValue: row => row.snapshotId },
  { id: "institution", label: "Institution", sortValue: row => row.institutionId },
  { id: "scheduled", label: "Scheduled (Manila)", sortValue: row => timeValue(row.scheduledFor) },
  { id: "captured", label: "Captured (Manila)", sortValue: row => timeValue(row.capturedAt) },
  { id: "policy", label: "Policy", sortValue: row => row.reportPolicyVersion },
  { id: "trigger", label: "Trigger", sortValue: row => humanizeCode(row.triggerType) },
];

export function CensusDiscovery({ principal }: { principal: Principal }) {
  const [census, setCensus] = useState<CensusIndex>(), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const controller = useRef<AbortController | undefined>(undefined), generation = useRef(0);
  const view = useTableView("census-snapshots", snapshotColumns, census?.snapshots ?? []), show = view.isVisible;
  async function load(cursor?: string) {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    const current = ++generation.current; setBusy(true); setError("");
    if (!cursor) setCensus(undefined);
    try {
      const next = await retryAfterContextChange(() => readCensusIndex(principal, request.signal, cursor), () => !request.signal.aborted && current === generation.current);
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
      {census.snapshots.length ? <PaginatedTable total={census.snapshots.length} label="Census snapshots" resetKey={view.sortKey} toolbar={<TableViewBar view={view}/>}><table className="data-table"><thead><tr><SortableHeader view={view} id="snapshot">Snapshot</SortableHeader><SortableHeader view={view} id="institution">Institution</SortableHeader><SortableHeader view={view} id="scheduled">Scheduled (Manila)</SortableHeader><SortableHeader view={view} id="captured">Captured (Manila)</SortableHeader><SortableHeader view={view} id="policy">Policy</SortableHeader><SortableHeader view={view} id="trigger">Trigger</SortableHeader></tr></thead><tbody>{view.rows.map(row => <tr key={row.snapshotId}>{show("snapshot")&&<td className="mono">{row.snapshotId}</td>}{show("institution")&&<td>{row.institutionId}</td>}{show("scheduled")&&<td>{formatManilaDateTime(row.scheduledFor)}</td>}{show("captured")&&<td>{formatManilaDateTime(row.capturedAt)}</td>}{show("policy")&&<td>{row.reportPolicyVersion}</td>}{show("trigger")&&<td>{humanizeCode(row.triggerType)}</td>}</tr>)}</tbody></table></PaginatedTable> : <p>No authorized census snapshots are returned. This does not establish zero inventory.</p>}
      {census.nextCursor && <button className="button" disabled={busy} onClick={() => void load(census.nextCursor!)}>Load more census snapshots</button>}</>}
    <ActionButton className="button" disabled  unavailableReason="Full DOH report format remains unapproved">Copy or export census</ActionButton>
  </section>;
}
