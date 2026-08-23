import type { Principal } from "../auth/permissions";
import { AuditView } from "../features/audit/audit-view";
import { AlertsView } from "../features/alerts/alerts-view";
import { ConsortiumView } from "../features/consortium/consortium-view";
import { DashboardView } from "../features/dashboard/dashboard-view";
import { InventoryView } from "../features/inventory/inventory-view";
import { ProfileView } from "../features/profile/profile-view";
import { ReportView } from "../features/reporting/report-view";
import { TransferExplorer } from "../features/transfers/transfers-view";
import { useLiveData } from "../hooks/use-live-data";
import type { Alerts, Audit, Consortium, Dashboard, FeatureResponse, Inventory, Report, Transfers } from "../services/api/types";

export function FeatureRouter({path,canAcknowledge=false,canSubmitTransfer=false,canRejectTransfer=false,canCancelTransfer=false,canCancelApprovedTransfer=false,canDispatchTransfer=false,canStartTransit=false,canDelayTransfer=false,canResumeTransfer=false,canReceiveTransfer=false,canCapture=false,principal}:{path:string;canAcknowledge?:boolean;canSubmitTransfer?:boolean;canRejectTransfer?:boolean;canCancelTransfer?:boolean;canCancelApprovedTransfer?:boolean;canDispatchTransfer?:boolean;canStartTransit?:boolean;canDelayTransfer?:boolean;canResumeTransfer?:boolean;canReceiveTransfer?:boolean;canCapture?:boolean;principal?:Principal}) {
  const endpoint:Record<string,string>={"/":"/api/v1/dashboard","/inventory":"/api/v1/inventory","/alerts":"/api/v1/alerts","/transfers":"/api/v1/transfers","/consortium":"/api/v1/consortium","/audit":"/api/v1/audit","/reporting":"/api/v1/reports/inventory"};
  const state=useLiveData<FeatureResponse>(endpoint[path]??null);
  if(path==="/profile"&&principal)return <ProfileView principal={principal}/>;
  if(!endpoint[path])return <div className="empty"><strong>Data unavailable</strong>The official feature API is not implemented yet. Runtime mock fallback is disabled.</div>;
  if(!state.data&&state.busy)return <div className="empty" aria-live="polite"><strong>Loading authorized data</strong>Waiting for the official API.</div>;
  if(!state.data)return <div className="empty" role="alert"><strong>Unable to load data</strong>{state.error}<br/><button className="button" onClick={state.manual}>Retry</button></div>;
  if(path==="/")return <DashboardView data={state.data as Dashboard} canCapture={canCapture} refreshError={state.error} onRetry={state.manual}/>;
  if(path==="/consortium")return <ConsortiumView data={state.data as Consortium}/>;
  if(path==="/audit")return <AuditView data={state.data as Audit}/>;
  if(path==="/reporting")return <ReportView data={state.data as Report}/>;
  if(path==="/alerts")return <AlertsView data={state.data as Alerts} canAcknowledge={canAcknowledge} onRefresh={state.manual}/>;
  if(path==="/transfers")return <TransferExplorer data={state.data as Transfers} canSubmit={canSubmitTransfer} canReject={canRejectTransfer} canCancel={canCancelTransfer} canCancelApproved={canCancelApprovedTransfer} canDispatch={canDispatchTransfer} canStartTransit={canStartTransit} canDelay={canDelayTransfer} canResume={canResumeTransfer} canReceive={canReceiveTransfer} receiptInstitutionId={principal?.institutionId??""} onRefresh={state.manual}/>;
  return <InventoryView data={state.data as Inventory}/>;
}
