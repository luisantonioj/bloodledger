import { AggregateTable } from "../../components/ui/aggregate-tables";
import { formatManilaDateTime, humanizeCode } from "../../components/ui/display";
import type { Dashboard } from "../../services/api/types";

export function DashboardView({data,canCapture,refreshError,onRetry}:{data:Dashboard;canCapture:boolean;refreshError:string;onRetry:()=>void}) {
  if(data.composition==="ADMINISTRATIVE")return <div className="empty dashboard-empty"><span className="empty-mark" aria-hidden="true">BL</span><strong>Non-clinical workspace</strong>This account has no inventory, custody, transfer, or regulatory dashboard authority.</div>;
  const total=data.inventory.reduce((sum,item)=>sum+item.confirmedCount,0);
  const pending=data.pendingScans.reduce((sum,item)=>sum+item.count,0);
  return <>
    <div className="stats dashboard-stats">
      <article><span>Ledger-confirmed</span><strong>{total}</strong><small>units in the current projection</small></article>
      <article className={pending > 0 ? "accent-warning" : ""}><span>Uncommitted scan states</span><strong>{pending}</strong><small>kept separate from inventory</small></article>
      <article><span>Last projection</span><strong className="time">{formatManilaDateTime(data.lastSuccessfulProjectionAt)}</strong><small>Asia/Manila display time</small></article>
      <article><span>Authorized view</span><strong className="scope">{humanizeCode(data.scope)}</strong><small>{data.composition.toLowerCase()} composition</small></article>
    </div>
    {canCapture&&<div className="capture-link"><div><span className="capture-mark" aria-hidden="true">+</span><span><strong>Capture a confirmed unit</strong><small>The existing Sprint 4 privacy and offline rules remain in effect.</small></span></div><a className="button primary" href="/capture/">Open capture workspace</a></div>}
    {refreshError&&<p className="notice" role="status">Showing the last confirmed view. Refresh failed: {refreshError} <button className="button" onClick={onRetry}>Retry</button></p>}
    <div className="dashboard-table-head"><div><strong>Inventory projection</strong><span>Ledger-confirmed totals available to this authenticated scope.</span></div><span className="projection-label">Projection data</span></div>
    <AggregateTable items={data.inventory}/>
  </>;
}
