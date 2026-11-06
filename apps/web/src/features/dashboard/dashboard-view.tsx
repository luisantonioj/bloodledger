import { BankDashboardSummary } from "./bank-dashboard-summary";
import { DashboardReadState } from "./dashboard-read-state";
import { DohDashboardPlaceholder } from "./doh-dashboard-placeholder";
import { PrcDashboardPlaceholder } from "./prc-dashboard-placeholder";
import type { Dashboard } from "../../services/api/types";
import { ExactInventoryOverviewChart } from "./exact-inventory-overview-chart";
import { InventoryOverviewChart } from "./inventory-overview-chart";
import type { Principal } from "../../auth/permissions";
import { isRequester } from "./requester-dashboard-data";
import { RequesterDashboard, type RequesterRequestsState } from "./requester-dashboard";
import { dashboardSummary } from "./dashboard-summary";

export function DashboardView({data,principal,refreshError,onRetry,requests,loading=false}:{data:Dashboard;principal:Principal;refreshError:string;onRetry:()=>void;requests:RequesterRequestsState;loading?:boolean}) {
  if(data.composition==="ADMINISTRATIVE")return <div className="empty dashboard-empty"><img className="bloodledger-logo empty-logo" src="/bloodledger-logo-updated.png" alt=""/><strong>Non-clinical workspace</strong>This account has no inventory, custody, transfer, or regulatory dashboard authority.</div>;
  const hasProjection = data.lastSuccessfulProjectionAt !== null;
  return <>
    {principal.accountCategory==="BLOOD_BANK"?<BankDashboardSummary principal={principal}/>:<div className="stats dashboard-stats">
      {dashboardSummary(data, principal).map(card => <article key={card.label}>
        <span>{card.label}</span><strong aria-label={card.value === null ? "Unavailable" : undefined}>{card.value ?? "—"}</strong>
      </article>)}
    </div>}
    {refreshError&&<DashboardReadState error={refreshError} retained={hasProjection} onRetry={onRetry}/>}
    {principal.accountCategory === "DOH" && <DohDashboardPlaceholder principal={principal}/>}
    {principal.accountCategory === "PRC" && <PrcDashboardPlaceholder data={data} loading={loading}/>}
    {isRequester(principal) && <RequesterDashboard data={data} principal={principal} requests={requests}/>}
    {!isRequester(principal) && data.composition === "OPERATIONAL" && hasProjection && data.inventory.length > 0 && (
      principal.accountCategory!=="BLOOD_BANK"&&<InventoryOverviewChart items={data.inventory} institutionId={undefined} />
    )}
    {principal.accountCategory === "BLOOD_BANK" && <ExactInventoryOverviewChart institutionId={principal.institutionId}/>}
    {principal.accountCategory === "BLOOD_BANK" && <RequesterDashboard data={data} principal={principal} requests={requests} bankMode/>}
  </>;
}
