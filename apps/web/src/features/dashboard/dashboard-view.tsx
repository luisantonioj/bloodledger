import { DashboardReadState } from "./dashboard-read-state";
import { DohDashboardPlaceholder } from "./doh-dashboard-placeholder";
import { PrcDashboardPlaceholder } from "./prc-dashboard-placeholder";
import type { Dashboard } from "../../services/api/types";
import { InventoryOverviewChart } from "./inventory-overview-chart";
import type { Principal } from "../../auth/permissions";
import { isRequester } from "./requester-dashboard-data";
import { RequesterDashboard, type RequesterRequestsState } from "./requester-dashboard";
import { dashboardSummary } from "./dashboard-summary";

export function DashboardView({data,principal,refreshError,onRetry,requests,loading=false}:{data:Dashboard;principal:Principal;refreshError:string;onRetry:()=>void;requests:RequesterRequestsState;loading?:boolean}) {
  if(data.composition==="ADMINISTRATIVE")return <div className="empty dashboard-empty"><span className="empty-mark" aria-hidden="true">BL</span><strong>Non-clinical workspace</strong>This account has no inventory, custody, transfer, or regulatory dashboard authority.</div>;
  const hasProjection = data.lastSuccessfulProjectionAt !== null;
  return <>
    <div className="stats dashboard-stats">
      {dashboardSummary(data, principal).map(card => <article key={card.label}>
        <span>{card.label}</span><strong aria-label={card.value === null ? "Unavailable" : undefined}>{card.value ?? "—"}</strong>
      </article>)}
    </div>
    {refreshError&&<DashboardReadState error={refreshError} retained={hasProjection} onRetry={onRetry}/>}
    {principal.accountCategory === "DOH" && <DohDashboardPlaceholder principal={principal}/>}
    {principal.accountCategory === "PRC" && <PrcDashboardPlaceholder principal={principal}/>}
    {isRequester(principal) && <RequesterDashboard data={data} principal={principal} requests={requests}/>}
    {!isRequester(principal) && data.composition === "OPERATIONAL" && hasProjection && data.inventory.length > 0 && (
      <InventoryOverviewChart items={data.inventory} />
    )}
    {principal.accountCategory === "BLOOD_BANK" && (!hasProjection || data.inventory.length === 0) && <section className="inventory-overview-card" aria-labelledby="inventory-overview-title"><header><div><h2 id="inventory-overview-title">Blood Inventory Overview</h2></div><a className="inventory-overview-link" href="/inventory">View inventory →</a></header><div className="dashboard-inventory-placeholder" aria-live="polite"><strong>{loading?"Loading inventory…":hasProjection?"No inventory records":"Inventory overview unavailable"}</strong><p>{loading?"The inventory overview will appear here once loaded.":hasProjection?"Confirmed inventory will appear here when units are recorded.":"The overview will appear here when inventory data is available."}</p></div></section>}
    {principal.accountCategory === "BLOOD_BANK" && <RequesterDashboard data={data} principal={principal} requests={requests} bankMode/>}
  </>;
}
