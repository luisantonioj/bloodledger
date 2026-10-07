import { AggregateTable } from "../../components/ui/aggregate-tables";
import { formatManilaDateTime, humanizeCode } from "../../components/ui/display";
import type { Dashboard } from "../../services/api/types";
import { InventoryOverviewChart } from "./inventory-overview-chart";

export function DashboardView({data,refreshError,onRetry}:{data:Dashboard;refreshError:string;onRetry:()=>void}) {
  if(data.composition==="ADMINISTRATIVE")return <div className="empty dashboard-empty"><span className="empty-mark" aria-hidden="true">BL</span><strong>Non-clinical workspace</strong>This account has no inventory, custody, transfer, or regulatory dashboard authority.</div>;
  const hasProjection = data.lastSuccessfulProjectionAt !== null;
  const total=data.inventory.reduce((sum,item)=>sum+item.confirmedCount,0);
  const pending=data.pendingScans.reduce((sum,item)=>sum+item.count,0);
  return <>
    <div className="stats dashboard-stats">
      <article><span>Ledger-confirmed units</span><strong>{hasProjection ? total : "—"}</strong><small>{hasProjection ? "units in the current projection" : "No projection available"}</small></article>
      <article className={pending > 0 ? "accent-warning" : ""}><span>Uncommitted scan states</span><strong>{pending}</strong><small>kept separate from inventory</small></article>
      <article><span>Last projection</span><strong className="time">{hasProjection ? formatManilaDateTime(data.lastSuccessfulProjectionAt) : "Unavailable"}</strong><small>Asia/Manila display time</small></article>
    </div>
    <p className="dashboard-scope">Authorized scope: {humanizeCode(data.scope)}</p>
    {refreshError&&<p className="notice" role="status">Showing the last confirmed view. Refresh failed: {refreshError} <button className="button" onClick={onRetry}>Retry</button></p>}
    {data.composition === "OPERATIONAL" && hasProjection && data.inventory.length > 0 && (
      <InventoryOverviewChart items={data.inventory} />
    )}
    <div className="dashboard-table-head"><div><strong>Inventory projection</strong><span>Ledger-confirmed totals available to this authenticated scope.</span></div></div>
    <div className="dashboard-aggregate-table"><AggregateTable items={hasProjection ? data.inventory : []}/></div>
  </>;
}
