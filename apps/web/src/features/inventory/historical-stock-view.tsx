import { useState } from "react";
import { useLiveData } from "../../hooks/use-live-data";
import { humanizeCode, formatManilaDateTime } from "../../components/ui/display";
type Snapshot = { snapshot_id: string; source_business_date: string; source_institution_id: string; status: string; expected_units: number; verified_units: number; workbook_sha256: string; manifest_sha256: string };
type Count = { series_key: string; blood_type: string; component_type: string; available_units: number; reserved_units: number; closing_units: number };
type Unit = { component_id: string; snapshot_status: string; allocation_group_id: string | null; ledger_transaction_id: string; block_number: string; validation_status: string; committed_at: string };
type Detail = { snapshot: Snapshot; counts: Count[]; units: Unit[]; nextCursor: string | null };
export function HistoricalStockView() {
  const list = useLiveData<{ snapshots: Snapshot[] }>("/api/v2/historical-snapshots");
  const [selected, setSelected] = useState(""); const [cursor, setCursor] = useState("");
  const snapshotId = selected || list.data?.snapshots[0]?.snapshot_id;
  const detail = useLiveData<Detail>(snapshotId ? `/api/v2/historical-snapshots/${snapshotId}?limit=50${cursor ? `&cursor=${cursor}` : ""}` : null);
  return <section><h2>Historical synthetic stock</h2><p>SIMULATION_ONLY · Constructed aggregate representation. These components have no original donation, collection, expiry or custody evidence. They are excluded from operational inventory and forecasting census.</p>
    {(list.error || detail.error) && <div role="alert">{list.error || detail.error}</div>}
    <label>Snapshot<select value={snapshotId ?? ""} onChange={event => { setSelected(event.target.value); setCursor(""); }}>{list.data?.snapshots.map(s => <option value={s.snapshot_id} key={s.snapshot_id}>{s.source_business_date.slice(0, 10)} · {s.status} · {s.expected_units} components</option>)}</select></label>
    {!list.busy && list.data?.snapshots.length === 0 && <p>No historical snapshot imported on this machine.</p>}
    {detail.data && <><p>Source: {detail.data.snapshot.source_institution_id} · {detail.data.snapshot.status} · {detail.data.snapshot.verified_units}/{detail.data.snapshot.expected_units} verified components</p><details><summary>Source hashes</summary><p className="mono">Workbook: {detail.data.snapshot.workbook_sha256}<br/>Manifest: {detail.data.snapshot.manifest_sha256}</p></details>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Blood type</th><th>Component</th><th>Available</th><th>Reserved</th><th>Closing</th></tr></thead><tbody>{detail.data.counts.map(c => <tr key={c.series_key}><td>{humanizeCode(c.blood_type)}</td><td>{humanizeCode(c.component_type)}</td><td>{c.available_units}</td><td>{c.reserved_units}</td><td>{c.closing_units}</td></tr>)}</tbody></table></div>
      <p>Database projection of verified local Fabric receipts. Allocation groups are generated; original reservation purpose is unknown.</p>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Component</th><th>Snapshot state</th><th>Generated allocation</th><th>Ledger reference</th><th>Block / validation</th><th>Actual commitment</th></tr></thead><tbody>{detail.data.units.map(u => <tr key={u.component_id}><td className="mono">{u.component_id}</td><td>{u.snapshot_status}</td><td>{u.allocation_group_id ?? "—"}</td><td className="mono">{u.ledger_transaction_id}</td><td>{u.block_number} / {u.validation_status}</td><td>{formatManilaDateTime(u.committed_at)}</td></tr>)}</tbody></table></div>
      <button className="button" disabled={!cursor} onClick={() => setCursor("")}>First page</button> <button className="button" disabled={!detail.data.nextCursor} onClick={() => setCursor(detail.data?.nextCursor ?? "")}>Next 50 components</button></>}
  </section>;
}
