import type { Aggregate, AlertAggregate, TransferSummary } from "../../services/api/types";
import { formatManilaDateTime, humanizeCode, statusClassName } from "./display";

export function AggregateTable({items}:{items:Aggregate[]}) {
  if(items.length===0)return <div className="empty"><strong>No committed inventory</strong>No ledger-confirmed projection is available for this scope.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Institution</th><th>Blood type</th><th>Component</th><th>Status</th><th>Confirmed</th><th>Projected</th></tr></thead><tbody>{items.map((item,index)=><tr key={`${item.institutionId}-${item.bloodType}-${item.component}-${item.inventoryStatus}-${index}`}><td>{item.institutionDisplayName}</td><td>{humanizeCode(item.bloodType)}</td><td>{humanizeCode(item.component)}</td><td><span className={statusClassName(item.inventoryStatus)}>{humanizeCode(item.inventoryStatus)}</span></td><td>{item.confirmedCount}</td><td>{formatManilaDateTime(item.lastProjectedAt)}</td></tr>)}</tbody></table></div>;
}

export function AlertAggregateTable({items}:{items:AlertAggregate[]}) {
  if(items.length===0)return <div className="empty"><strong>No aggregate alerts</strong>No approved alert aggregate is available.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Institution</th><th>Alert</th><th>Severity</th><th>Status</th><th>Count</th><th>Evaluated</th></tr></thead><tbody>{items.map((item,index)=><tr key={item.institutionDisplayName+"-"+item.alertType+"-"+index}><td>{item.institutionDisplayName}</td><td>{humanizeCode(item.alertType)}</td><td><span className={statusClassName(item.severity)}>{item.severity}</span></td><td>{humanizeCode(item.status)}</td><td>{item.count}</td><td>{formatManilaDateTime(item.lastEvaluatedAt)}</td></tr>)}</tbody></table></div>;
}

export function TransferSummaryTable({items}:{items:TransferSummary[]}) {
  if(items.length===0)return <div className="empty"><strong>No transfer summary</strong>No ledger-confirmed transfer aggregate is available.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Status</th><th>Transfers</th><th>Units</th></tr></thead><tbody>{items.map(item=><tr key={item.status}><td><span className={statusClassName(item.status)}>{humanizeCode(item.status)}</span></td><td>{item.transferCount}</td><td>{item.unitCount}</td></tr>)}</tbody></table></div>;
}
