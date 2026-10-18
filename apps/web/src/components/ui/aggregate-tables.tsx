import { PaginatedTable, RecordPagination } from "./record-pagination";
import type { Aggregate, AlertAggregate, TransferSummary } from "../../services/api/types";
import { formatBloodType, formatManilaDateTime, humanizeCode, statusClassName } from "./display";
import { SortableHeader, TableViewBar, timeValue, useTableView, type TableColumn } from "./table-view";

const aggregateColumns: TableColumn<Aggregate>[] = [
  { id: "institution", label: "Institution", sortValue: item => item.institutionDisplayName },
  { id: "bloodType", label: "Blood type", sortValue: item => formatBloodType(item.bloodType) },
  { id: "component", label: "Component", sortValue: item => humanizeCode(item.component) },
  { id: "status", label: "Status", sortValue: item => humanizeCode(item.inventoryStatus) },
  { id: "confirmed", label: "Confirmed", sortValue: item => item.confirmedCount },
  { id: "projected", label: "Projected", sortValue: item => timeValue(item.lastProjectedAt) },
];
const alertColumns: TableColumn<AlertAggregate>[] = [
  { id: "institution", label: "Institution", sortValue: item => item.institutionDisplayName },
  { id: "alert", label: "Alert", sortValue: item => humanizeCode(item.alertType) },
  { id: "severity", label: "Severity", sortValue: item => item.severity },
  { id: "status", label: "Status", sortValue: item => humanizeCode(item.status) },
  { id: "count", label: "Count", sortValue: item => item.count },
  { id: "evaluated", label: "Evaluated", sortValue: item => timeValue(item.lastEvaluatedAt) },
];
const transferColumns: TableColumn<TransferSummary>[] = [
  { id: "status", label: "Status", sortValue: item => humanizeCode(item.status) },
  { id: "transfers", label: "Transfers", sortValue: item => item.transferCount },
  { id: "units", label: "Units", sortValue: item => item.unitCount },
];

export function BloodTypeBadge({value}:{value:string}) {
  return <span className="blood-type" aria-label={humanizeCode(value)}>{formatBloodType(value)}</span>;
}

export function AggregateTable({items,plainText=false}:{items:Aggregate[];plainText?:boolean}) {
  const view=useTableView("aggregate-inventory",aggregateColumns,items),show=view.isVisible;
  if(items.length===0)return <><div className="empty"><strong>No committed inventory</strong>No ledger-confirmed projection is available for this scope.</div><RecordPagination total={0} label="Inventory aggregate"/></>;
  return <PaginatedTable total={items.length} label="Aggregate records" resetKey={view.sortKey} toolbar={<TableViewBar view={view}/>}><table className="data-table"><thead><tr><SortableHeader view={view} id="institution">Institution</SortableHeader><SortableHeader view={view} id="bloodType">Blood type</SortableHeader><SortableHeader view={view} id="component">Component</SortableHeader><SortableHeader view={view} id="status">Status</SortableHeader><SortableHeader view={view} id="confirmed">Confirmed</SortableHeader><SortableHeader view={view} id="projected">Projected</SortableHeader></tr></thead><tbody>{view.rows.map((item,index)=><tr key={`${item.institutionId}-${item.bloodType}-${item.component}-${item.inventoryStatus}-${index}`}>{show("institution")&&<td><strong>{item.institutionDisplayName}</strong></td>}{show("bloodType")&&<td>{plainText?<span className="aggregate-plain-text">{formatBloodType(item.bloodType)}</span>:<BloodTypeBadge value={item.bloodType}/>}</td>}{show("component")&&<td>{humanizeCode(item.component)}</td>}{show("status")&&<td><span className={plainText?"aggregate-plain-text":statusClassName(item.inventoryStatus)}>{humanizeCode(item.inventoryStatus)}</span></td>}{show("confirmed")&&<td className="numeric">{item.confirmedCount}</td>}{show("projected")&&<td className="data-time">{formatManilaDateTime(item.lastProjectedAt)}</td>}</tr>)}</tbody></table></PaginatedTable>;
}

export function AlertAggregateTable({items}:{items:AlertAggregate[]}) {
  const view=useTableView("aggregate-alerts",alertColumns,items),show=view.isVisible;
  if(items.length===0)return <><div className="empty"><strong>No aggregate alerts</strong>No approved alert aggregate is available.</div><RecordPagination total={0} label="Aggregate records"/></>;
  return <PaginatedTable total={items.length} label="Aggregate records" resetKey={view.sortKey} toolbar={<TableViewBar view={view}/>}><table><thead><tr><SortableHeader view={view} id="institution">Institution</SortableHeader><SortableHeader view={view} id="alert">Alert</SortableHeader><SortableHeader view={view} id="severity">Severity</SortableHeader><SortableHeader view={view} id="status">Status</SortableHeader><SortableHeader view={view} id="count">Count</SortableHeader><SortableHeader view={view} id="evaluated">Evaluated</SortableHeader></tr></thead><tbody>{view.rows.map((item,index)=><tr key={item.institutionDisplayName+"-"+item.alertType+"-"+index}>{show("institution")&&<td>{item.institutionDisplayName}</td>}{show("alert")&&<td>{humanizeCode(item.alertType)}</td>}{show("severity")&&<td><span className={statusClassName(item.severity)}>{item.severity}</span></td>}{show("status")&&<td>{humanizeCode(item.status)}</td>}{show("count")&&<td>{item.count}</td>}{show("evaluated")&&<td>{formatManilaDateTime(item.lastEvaluatedAt)}</td>}</tr>)}</tbody></table></PaginatedTable>;
}

export function TransferSummaryTable({items}:{items:TransferSummary[]}) {
  const view=useTableView("aggregate-transfers",transferColumns,items),show=view.isVisible;
  if(items.length===0)return <><div className="empty"><strong>No transfer summary</strong>No ledger-confirmed transfer aggregate is available.</div><RecordPagination total={0} label="Aggregate records"/></>;
  return <PaginatedTable total={items.length} label="Aggregate records" resetKey={view.sortKey} toolbar={<TableViewBar view={view}/>}><table><thead><tr><SortableHeader view={view} id="status">Status</SortableHeader><SortableHeader view={view} id="transfers">Transfers</SortableHeader><SortableHeader view={view} id="units">Units</SortableHeader></tr></thead><tbody>{view.rows.map(item=><tr key={item.status}>{show("status")&&<td><span className={statusClassName(item.status)}>{humanizeCode(item.status)}</span></td>}{show("transfers")&&<td>{item.transferCount}</td>}{show("units")&&<td>{item.unitCount}</td>}</tr>)}</tbody></table></PaginatedTable>;
}
