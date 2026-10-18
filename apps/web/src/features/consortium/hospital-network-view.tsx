import { useState } from "react";
import { can, type Principal } from "../../auth/permissions";
import { InformationHelp } from "../../components/ui/information-help";
import { PaginatedTable } from "../../components/ui/record-pagination";
import { SortableHeader, TableViewBar, timeValue, useTableView, type TableColumn } from "../../components/ui/table-view";
import { RefreshButton } from "../../components/ui/refresh-button";
import { formatBloodType, formatManilaDateTime } from "../../components/ui/display";
import { useLiveData } from "../../hooks/use-live-data";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "../../services/api/v2";
import type { Consortium } from "../../services/api/types";
import { componentLabel } from "../transfers/requester-transfer-data";

type NetworkRow = { key: string; institutionId: string; facility: string; bloodType: string; component: string; available: number | null; reserved: number | null; updatedAt: string };

// FR-03/12: only approved city aggregates; no component-level network reads or stock thresholds.
export function hospitalNetworkRows(data: Consortium): NetworkRow[] {
  if (data.scope !== "CITY_AGGREGATE" || data.classification !== "SIMULATION_ONLY" || !Array.isArray(data.inventory)) throw new Error("Network inventory is unavailable for this scope.");
  const groups = new Map<string, NetworkRow>();
  for (const row of data.inventory) {
    if (!row.institutionId || !row.institutionDisplayName || !V2_BLOOD_TYPES.includes(row.bloodType as typeof V2_BLOOD_TYPES[number]) || !V2_COMPONENT_TYPES.includes(row.component as typeof V2_COMPONENT_TYPES[number]) || !Number.isSafeInteger(row.confirmedCount) || row.confirmedCount < 0 || !Number.isFinite(Date.parse(row.lastProjectedAt))) throw new Error("Network inventory is incomplete. Refresh to try again.");
    const key = [row.institutionId, row.bloodType, row.component].join(":");
    const group = groups.get(key) ?? { key, institutionId: row.institutionId, facility: row.institutionDisplayName, bloodType: row.bloodType, component: row.component, available: null, reserved: null, updatedAt: row.lastProjectedAt };
    if (row.inventoryStatus === "AVAILABLE") group.available = (group.available ?? 0) + row.confirmedCount;
    if (row.inventoryStatus === "RESERVED") group.reserved = (group.reserved ?? 0) + row.confirmedCount;
    // Show the oldest constituent update so a newer row cannot conceal older evidence.
    if (Date.parse(row.lastProjectedAt) < Date.parse(group.updatedAt)) group.updatedAt = row.lastProjectedAt;
    groups.set(key, group);
  }
  return [...groups.values()];
}

// Missing reports stay unknown; AVAILABLE is not an approved redistributable quantity.
export function networkAvailable(rows: NetworkRow[], bloodType: string, expectedFacilities = new Set(rows.map(row => row.institutionId)).size): number | null {
  const matching = rows.filter(row => row.bloodType === bloodType);
  return !matching.length || new Set(matching.map(row => row.institutionId)).size !== expectedFacilities || matching.some(row => row.available === null) ? null : matching.reduce((sum, row) => sum + row.available!, 0);
}

// All combines products only when every selected product has complete facility coverage.
export function networkComponentAvailable(rows:NetworkRow[],type:string,component:string,expectedFacilities=new Set(rows.map(row=>row.institutionId)).size):number|null{
 const products=component==="ALL"?V2_COMPONENT_TYPES:[component];
 const amounts=products.map(product=>networkAvailable(rows.filter(row=>row.component===product),type,expectedFacilities));
 return amounts.some(amount=>amount===null)?null:amounts.reduce<number>((sum,amount)=>sum+amount!,0);
}

export function HospitalNetworkView({ principal }: { principal: Principal }) {
  const state = useLiveData<Consortium>(can(principal, "consortium:read") ? "/api/v1/consortium" : null);
  const [component, setComponent] = useState<string>("ALL");
  const [view, setView] = useState("Network Total");
  const [bloodType, setBloodType] = useState("");
  let rows: NetworkRow[] = [], error = state.error, ready = false;
  if (state.data) {
    try { rows = hospitalNetworkRows(state.data); ready = state.data.lastSuccessfulProjectionAt !== null; }
    catch (reason) { error = reason instanceof Error ? reason.message : "Network inventory unavailable."; }
  }
  const facilities = [...new Map(rows.map(row => [row.institutionId, row.facility])).entries()];
  const selected = rows.filter(row => component === "ALL" || row.component === component);
  const types = bloodType ? V2_BLOOD_TYPES.filter(type => type === bloodType) : V2_BLOOD_TYPES;
  const totals = V2_BLOOD_TYPES.map(type => networkComponentAvailable(selected, type, component, facilities.length));
  const componentName = component === "ALL" ? "All components" : componentLabel(component);
  const products = component === "ALL" ? V2_COMPONENT_TYPES : [component];
  const matrix = facilities.flatMap(([id,label]) => products.map(product => {
    const bankRows = selected.filter(row => row.institutionId === id && row.component === product);
    const oldest = bankRows.reduce<string | null>((date, row) => !date || Date.parse(row.updatedAt) < Date.parse(date) ? row.updatedAt : date, null);
    return {id,label,product,bankRows,oldest};
  }));
  const matrixColumns: TableColumn<typeof matrix[number]>[] = [
    { id: "bank", label: "Participating blood bank", sortValue: row => row.label },
    { id: "component", label: "Component", sortValue: row => componentLabel(row.product) },
    ...types.map(type => ({ id: type, label: formatBloodType(type), sortValue: (row: typeof matrix[number]) => row.bankRows.find(item => item.bloodType === type)?.available ?? null })),
    { id: "redistributable", label: "Redistributable" },
    { id: "updated", label: "Last updated", sortValue: row => timeValue(row.oldest) },
  ];
  const tableView = useTableView("network-matrix", matrixColumns, matrix), show = tableView.isVisible;
  const max = Math.max(1, ...totals.map(total => total ?? 0), ...facilities.flatMap(([id]) => V2_BLOOD_TYPES.map(type => networkComponentAvailable(selected.filter(row=>row.institutionId===id),type,component,1) ?? 0)));
  const reportedInventory = ready ? state.data!.inventory.filter(row => component === "ALL" || row.component === component).reduce((sum, row) => sum + row.confirmedCount, 0) : null;
  const zeroTypes = ready && totals.every(total => total !== null) ? totals.filter(total => total === 0).length : null;
  const summary: [string, number | null, string][] = [
    ["Participating Blood Banks", ready ? facilities.length : null, "Counts blood banks with inventory reports in this network view. It does not count every registered facility or confirm that a facility is currently online. A facility with no report is not assumed to have zero stock."],
    ["Network Inventory", reportedInventory, "The total reported " + componentName + " units across the blood banks shown here, including available and reserved stock. Choose another blood component to update this total. Reserved units are already allocated and are not freely available for a new request."],
    ["Available to Redistribute", null, "Would show the units approved for sharing with another facility after reservations and the supplying facility’s stock requirements are considered. These rules and approved quantities are not provided yet, so a dash means the value is unavailable, not zero."],
    ["Unavailable Blood Types", zeroTypes, "Counts blood groups with an explicitly reported zero available units for the selected component. Reserved units are excluded. If reports are incomplete, the count stays unavailable. In this preview, zeros describe synthetic sample data and do not confirm actual hospital stock."],
  ];
  return <div className="hospital-network-view consortium-workspace">
    <header className="page-head consortium-page-head"><h1 className="page-title">Network view</h1><RefreshButton busy={state.busy} onRefresh={state.manual}/></header>
    <div className="consortium-summary-grid">{summary.map(([label, value, detail]) => <section className="consortium-summary" key={label}><header className="consortium-summary-title"><span>{label}</span><InformationHelp label={label}>{detail}</InformationHelp></header><strong>{value ?? "—"}</strong></section>)}</div>
    <section className="bank-record-card consortium-controls">
      <label className="network-select-control">Blood Component<span className="requester-select"><select aria-label="Blood Component" value={component} onChange={event=>{setComponent(event.target.value);setBloodType("");}}><option value="ALL">All</option>{V2_COMPONENT_TYPES.map(value=><option key={value} value={value}>{componentLabel(value)}</option>)}</select></span></label>
      <label className="network-select-control">Chart View<span className="requester-select"><select aria-label="Chart View" value={view} onChange={event=>setView(event.target.value)}><option>Network Total</option><option>Compare Blood Banks</option></select></span></label>
    </section>
    <section className="bank-record-card consortium-chart-card">
      <header className="bank-section-heading"><h2>Blood Availability</h2><InformationHelp label="Blood Availability">Compare reported AVAILABLE units across the consortium by blood type and component. All combines available component units while the matrix keeps products in separate rows. Select a bar to focus the matrix below. Available stock has not been approved for redistribution; safety-stock rules and releasable quantities are not supplied. A dash means missing information. Zeros belong to the synthetic fixture, not verified clinical stock.</InformationHelp></header>
      {view === "Compare Blood Banks" && <div className="consortium-legend">{facilities.map(([id, label], index) => <span key={id}><i style={{background: networkColors[index % networkColors.length]}}/>{label}</span>)}</div>}
      <div className="consortium-chart-scroll"><div className="consortium-chart" aria-label={view + " available units"}>
        {V2_BLOOD_TYPES.map((type, index) => <button key={type} className={"consortium-chart-column" + (bloodType === type ? " selected" : "")} aria-pressed={bloodType === type} aria-label={formatBloodType(type) + ": " + (ready ? totals[index] ?? "unknown" : "unknown") + " available units"} onClick={() => setBloodType(bloodType === type ? "" : type)}>
          <span className="consortium-chart-value">{ready ? totals[index] ?? "—" : "—"}</span>
          <span className="consortium-bar-area">{view === "Network Total" ? <span className="consortium-bar" style={{height: ready && totals[index] !== null ? Math.max(totals[index]! > 0 ? 2 : 0, totals[index]! / max * 100) + "%" : "0%"}}/> : facilities.map(([id, label], facilityIndex) => {
            const amount = networkComponentAvailable(selected.filter(row => row.institutionId === id), type, component, 1);
            return <span key={id} title={label + ": " + (amount ?? "Unknown")} className="consortium-bar" style={{background: networkColors[facilityIndex % networkColors.length],height: ready && amount !== null ? Math.max(amount > 0 ? 2 : 0, amount / max * 100) + "%" : "0%"}}/>;
          })}</span><strong>{formatBloodType(type)}</strong><small>{!ready || totals[index] === null ? "Not reported" : totals[index] === 0 ? "No available units" : "Available units"}</small>
        </button>)}
      </div></div>
      <p className="consortium-chart-note">{ready ? "Reported available units · " + componentName + " · Select a blood type to filter the matrix" : state.busy ? "Loading network inventory…" : "Network inventory unavailable"}</p>
    </section>
    <section className="bank-record-card consortium-matrix-card">
      <header className="bank-section-heading"><h2>Blood Bank Availability Matrix</h2><div className="bank-toolbar-actions">{bloodType && <button className="button compact" onClick={() => setBloodType("")}>Clear blood type</button>}</div><InformationHelp label="Blood Bank Availability Matrix">Each row shows a facility and component. All shows each of the five components separately; selecting one component narrows the chart and matrix together. Reserved units appear underneath when reported. Missing records stay unavailable; they are not treated as zero. These summaries do not reserve units or guarantee supply. Create blood requests from the Dashboard or Requests & Transfers page.</InformationHelp></header>
      <PaginatedTable total={ready ? matrix.length : 0} resetKey={component + "|" + bloodType + "|" + tableView.sortKey} label="Blood bank component records" ready={ready} toolbar={<TableViewBar view={tableView}/>}>
        <table className="data-table consortium-matrix"><thead><tr><SortableHeader view={tableView} id="bank">Participating blood bank</SortableHeader><SortableHeader view={tableView} id="component">Component</SortableHeader>{types.map(type => <SortableHeader key={type} view={tableView} id={type}>{formatBloodType(type)}</SortableHeader>)}<SortableHeader view={tableView} id="redistributable">Redistributable</SortableHeader><SortableHeader view={tableView} id="updated">Last updated</SortableHeader></tr></thead><tbody>
          {ready && tableView.rows.map(({id, label, product, bankRows, oldest}) => {
            return <tr key={id+product}>{show("bank")&&<td><strong>{label}</strong></td>}{show("component")&&<td>{componentLabel(product)}</td>}{types.filter(show).map(type => {
              const row = bankRows.find(item => item.bloodType === type);
              return <td key={type}><strong>{row?.available ?? "—"}</strong><small>{row?.reserved !== null && row?.reserved !== undefined ? row.reserved + " reserved" : "Reserved: —"}</small></td>;
            })}{show("redistributable")&&<td>—<small>Not supplied</small></td>}{show("updated")&&<td>{oldest ? formatManilaDateTime(oldest) : "—"}</td>}</tr>;
          })}
          {(!ready || !facilities.length) && <tr><td colSpan={tableView.visibleCount}><div className="requester-records-empty" role={error ? "alert" : "status"}><strong>{!ready ? state.busy ? "Loading network inventory…" : "Network inventory unavailable" : "No network records available"}</strong><span>{error || "Reported facility inventory will appear here. Missing reports do not mean there is no stock."}</span></div></td></tr>}
        </tbody></table>
      </PaginatedTable>
    </section>
    {ready && <p className="network-refresh-note">Last updated: {formatManilaDateTime(state.data!.lastSuccessfulProjectionAt!)} · Synthetic fixture summaries</p>}
    {state.error && ready && <p className="network-refresh-note" role="status">Refresh unavailable. Showing the last loaded network summary.</p>}
  </div>;
}
export const networkColors = ["#a51f35", "#496c94", "#777184", "#5c8177"];
