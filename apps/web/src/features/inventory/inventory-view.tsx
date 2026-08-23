import { useState } from "react";
import { AggregateTable } from "../../components/ui/aggregate-tables";
import { formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import type { Aggregate, Inventory, Unit } from "../../services/api/types";
import { filterInventory, inventoryOptions } from "./inventory-filter";

export function InventoryView({data}:{data:Inventory}) {
  const [bloodType,setBloodType]=useState("ALL"),[component,setComponent]=useState("ALL"),[status,setStatus]=useState("ALL");
  const items=data.scope==="CITY_AGGREGATE"?data.aggregates:data.units;
  const filtered=filterInventory<Aggregate|Unit>(items,{bloodType,component,status});
  const filters=<div className="filter-bar" aria-label="Inventory filters"><label>Blood type<select value={bloodType} onChange={event=>setBloodType(event.target.value)}><option value="ALL">All blood types</option>{inventoryOptions<Aggregate|Unit>(items,"bloodType").map(value=><option value={value} key={value}>{humanizeCode(value)}</option>)}</select></label><label>Component<select value={component} onChange={event=>setComponent(event.target.value)}><option value="ALL">All components</option>{inventoryOptions<Aggregate|Unit>(items,"component").map(value=><option value={value} key={value}>{humanizeCode(value)}</option>)}</select></label><label>Status<select value={status} onChange={event=>setStatus(event.target.value)}><option value="ALL">All statuses</option>{inventoryOptions<Aggregate|Unit>(items,"inventoryStatus").map(value=><option value={value} key={value}>{humanizeCode(value)}</option>)}</select></label><span role="status">{filtered.length} of {items.length} records</span></div>;
  if(items.length===0)return <><div className="filter-bar"><span role="status">0 records</span></div><div className="empty"><strong>No committed inventory</strong>No ledger-confirmed projection is available for this scope.</div></>;
  if(filtered.length===0)return <>{filters}<div className="empty"><strong>No inventory matches these filters</strong>Change one or more filters to view the authorized committed records.</div></>;
  if(data.scope==="CITY_AGGREGATE")return <>{filters}<AggregateTable items={filtered as Aggregate[]}/></>;
  return <>{filters}<div className="table-wrap"><table><thead><tr><th>Unit</th><th>Blood type</th><th>Component</th><th>Status</th><th>Expires</th><th>Projected</th></tr></thead><tbody>{(filtered as Unit[]).map(item=><tr key={item.unitId}><td className="mono">{item.unitId}</td><td>{humanizeCode(item.bloodType)}</td><td>{humanizeCode(item.component)}</td><td><span className={statusClassName(item.inventoryStatus)}>{humanizeCode(item.inventoryStatus)}</span></td><td>{formatManilaDateTime(item.expiresAt)}</td><td>{formatManilaDateTime(item.projectedAt)}</td></tr>)}</tbody></table></div></>;
}
