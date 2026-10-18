import { PaginatedTable } from "../../components/ui/record-pagination";
import { useState } from "react";
import { useLiveData } from "../../hooks/use-live-data";
import { humanizeCode, formatManilaDateTime } from "../../components/ui/display";
import { SortableHeader, TableViewBar, timeValue, useTableView, type TableColumn } from "../../components/ui/table-view";
type Snapshot = { snapshot_id: string; source_business_date: string; source_institution_id: string; status: string; expected_units: number; verified_units: number; workbook_sha256: string; manifest_sha256: string };
type Count = { series_key: string; blood_type: string; component_type: string; available_units: number; reserved_units: number; closing_units: number };
type Unit = { component_id: string; snapshot_status: string; allocation_group_id: string | null; ledger_transaction_id: string; block_number: string; validation_status: string; committed_at: string };
const countColumns: TableColumn<Count>[] = [
  { id: "bloodType", label: "Blood type", sortValue: c => humanizeCode(c.blood_type) },
  { id: "component", label: "Component", sortValue: c => humanizeCode(c.component_type) },
  { id: "available", label: "Available", sortValue: c => c.available_units },
  { id: "reserved", label: "Reserved", sortValue: c => c.reserved_units },
  { id: "closing", label: "Closing", sortValue: c => c.closing_units },
];
const unitColumns: TableColumn<Unit>[] = [
  { id: "component", label: "Component", sortValue: u => u.component_id },
  { id: "snapshot", label: "Snapshot state", sortValue: u => u.snapshot_status },
  { id: "allocation", label: "Generated allocation", sortValue: u => u.allocation_group_id },
  { id: "ledger", label: "Ledger reference", sortValue: u => u.ledger_transaction_id },
  { id: "block", label: "Block / validation", sortValue: u => Number(u.block_number) },
  { id: "committed", label: "Actual commitment", sortValue: u => timeValue(u.committed_at) },
];
type Detail = { snapshot: Snapshot; counts: Count[]; units: Unit[]; nextCursor: string | null };
export function HistoricalStockView() {
  const list = useLiveData<{ snapshots: Snapshot[] }>("/api/v2/historical-snapshots");
  const [selected, setSelected] = useState(""); const [cursor, setCursor] = useState("");
  const snapshotId = selected || list.data?.snapshots[0]?.snapshot_id;
  const detail = useLiveData<Detail>(snapshotId ? `/api/v2/historical-snapshots/${snapshotId}?limit=50${cursor ? `&cursor=${cursor}` : ""}` : null);
  const counts = useTableView("historical-counts", countColumns, detail.data?.counts ?? []), showCount = counts.isVisible;
  const units = useTableView("historical-units", unitColumns, detail.data?.units ?? []), showUnit = units.isVisible;
  return <section><h2>Historical synthetic stock</h2><p>SIMULATION_ONLY · Constructed aggregate representation. These components have no original donation, collection, expiry or custody evidence. They are excluded from operational inventory and forecasting census.</p>
    {(list.error || detail.error) && <div role="alert">{list.error || detail.error}</div>}
    <label>Snapshot<select value={snapshotId ?? ""} onChange={event => { setSelected(event.target.value); setCursor(""); }}>{list.data?.snapshots.map(s => <option value={s.snapshot_id} key={s.snapshot_id}>{s.source_business_date.slice(0, 10)} · {s.status} · {s.expected_units} components</option>)}</select></label>
    {!list.busy && list.data?.snapshots.length === 0 && <p>No historical snapshot imported on this machine.</p>}
    {detail.data && <><p>Source: {detail.data.snapshot.source_institution_id} · {detail.data.snapshot.status} · {detail.data.snapshot.verified_units}/{detail.data.snapshot.expected_units} verified components</p><details><summary>Source hashes</summary><p className="mono">Workbook: {detail.data.snapshot.workbook_sha256}<br/>Manifest: {detail.data.snapshot.manifest_sha256}</p></details>
      <PaginatedTable total={detail.data.counts.length} label="Historical counts" resetKey={(snapshotId??"")+"|"+counts.sortKey} toolbar={<TableViewBar view={counts}/>}><table className="data-table"><thead><tr><SortableHeader view={counts} id="bloodType">Blood type</SortableHeader><SortableHeader view={counts} id="component">Component</SortableHeader><SortableHeader view={counts} id="available">Available</SortableHeader><SortableHeader view={counts} id="reserved">Reserved</SortableHeader><SortableHeader view={counts} id="closing">Closing</SortableHeader></tr></thead><tbody>{counts.rows.map(c => <tr key={c.series_key}>{showCount("bloodType")&&<td>{humanizeCode(c.blood_type)}</td>}{showCount("component")&&<td>{humanizeCode(c.component_type)}</td>}{showCount("available")&&<td>{c.available_units}</td>}{showCount("reserved")&&<td>{c.reserved_units}</td>}{showCount("closing")&&<td>{c.closing_units}</td>}</tr>)}</tbody></table></PaginatedTable>
      <p>Database projection of verified local Fabric receipts. Allocation groups are generated; original reservation purpose is unknown.</p>
      <PaginatedTable total={detail.data.units.length} label="Loaded historical components" resetKey={(snapshotId??"")+"|"+cursor+"|"+units.sortKey} toolbar={<TableViewBar view={units}/>}><table className="data-table"><thead><tr><SortableHeader view={units} id="component">Component</SortableHeader><SortableHeader view={units} id="snapshot">Snapshot state</SortableHeader><SortableHeader view={units} id="allocation">Generated allocation</SortableHeader><SortableHeader view={units} id="ledger">Ledger reference</SortableHeader><SortableHeader view={units} id="block">Block / validation</SortableHeader><SortableHeader view={units} id="committed">Actual commitment</SortableHeader></tr></thead><tbody>{units.rows.map(u => <tr key={u.component_id}>{showUnit("component")&&<td className="mono">{u.component_id}</td>}{showUnit("snapshot")&&<td>{u.snapshot_status}</td>}{showUnit("allocation")&&<td>{u.allocation_group_id ?? "—"}</td>}{showUnit("ledger")&&<td className="mono">{u.ledger_transaction_id}</td>}{showUnit("block")&&<td>{u.block_number} / {u.validation_status}</td>}{showUnit("committed")&&<td>{formatManilaDateTime(u.committed_at)}</td>}</tr>)}</tbody></table></PaginatedTable>
      <p className="historical-batch-note">Record pagination covers the loaded batch. Use the batch controls to load more historical records.</p>
      <button className="button" disabled={!cursor} onClick={() => setCursor("")}>First historical batch</button> <button className="button" disabled={!detail.data.nextCursor} onClick={() => setCursor(detail.data?.nextCursor ?? "")}>Next historical batch</button></>}
  </section>;
}
