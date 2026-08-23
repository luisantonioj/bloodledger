import { AggregateTable } from "../../components/ui/aggregate-tables";
import { formatManilaDateTime } from "../../components/ui/display";
import type { Dashboard } from "../../services/api/types";

export function DashboardView({data,canCapture,refreshError,onRetry}:{data:Dashboard;canCapture:boolean;refreshError:string;onRetry:()=>void}) {
  const total=data.inventory.reduce((sum,item)=>sum+item.confirmedCount,0);
  const pending=data.pendingScans.reduce((sum,item)=>sum+item.count,0);
  return <><div className="stats"><article><span>Ledger-confirmed</span><strong>{total}</strong></article><article><span>Uncommitted scan states</span><strong>{pending}</strong></article><article><span>Last projection</span><strong className="time">{formatManilaDateTime(data.lastSuccessfulProjectionAt)}</strong></article></div>{canCapture&&<div className="capture-link"><div><strong>Capture a confirmed unit</strong><span>The existing Sprint 4 privacy and offline rules remain in effect.</span></div><a className="button primary" href="/capture/">Open capture workspace</a></div>}{refreshError&&<p className="notice" role="status">Showing the last confirmed view. Refresh failed: {refreshError} <button className="button" onClick={onRetry}>Retry</button></p>}<AggregateTable items={data.inventory}/></>;
}
