import { V2TransferEvidenceView } from "../features/transfers/v2-transfer-evidence-view";
import type { Principal } from "../auth/permissions";
import type { ReactNode } from "react";
import { AccountsParityPreview } from "../features/accounts/accounts-parity-preview";
import { AnalyticsPreview } from "../features/analytics/analytics-preview";
import { AuditView } from "../features/audit/audit-view";
import { AlertsView } from "../features/alerts/alerts-view";
import { ConsortiumView } from "../features/consortium/consortium-view";
import { DashboardView } from "../features/dashboard/dashboard-view";
import { V2InventoryView } from "../features/inventory/v2-inventory-view";
import { ProfileParityPreview } from "../features/profile/profile-parity-preview";
import { ReportView } from "../features/reporting/report-view";
import { TransferExplorer } from "../features/transfers/transfers-view";
import { useLiveData } from "../hooks/use-live-data";
import type { Alerts, Audit, Consortium, Dashboard, FeatureResponse, Report, Transfers } from "../services/api/types";

export function FeatureRouter({path,canAcknowledge=false,canSubmitTransfer=false,canRejectTransfer=false,canCancelTransfer=false,canCancelApprovedTransfer=false,canDispatchTransfer=false,canStartTransit=false,canDelayTransfer=false,canResumeTransfer=false,canReceiveTransfer=false,canCapture=false,canPreviewInventoryExport=false,canPreviewTransferExport=false,principal}:{path:string;canAcknowledge?:boolean;canSubmitTransfer?:boolean;canRejectTransfer?:boolean;canCancelTransfer?:boolean;canCancelApprovedTransfer?:boolean;canDispatchTransfer?:boolean;canStartTransit?:boolean;canDelayTransfer?:boolean;canResumeTransfer?:boolean;canReceiveTransfer?:boolean;canCapture?:boolean;canPreviewInventoryExport?:boolean;canPreviewTransferExport?:boolean;principal?:Principal}) {
  const endpoint:Record<string,string>={"/":principal && ["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)?"/api/v2/dashboard":"/api/v1/dashboard","/alerts":principal && ["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)?"/api/v2/alerts":"/api/v1/alerts","/transfers":"/api/v1/transfers","/consortium":"/api/v1/consortium","/audit":principal && ["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)?"/api/v2/audit":"/api/v1/audit","/reporting":"/api/v1/reports/inventory"};
  const state=useLiveData<FeatureResponse>(endpoint[path]??null);
  if(path==="/transfers"&&principal&&["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId))return <V2TransferEvidenceView principal={principal}/>;
  if(path==="/accounts"&&principal)return <AccountsParityPreview principal={principal}/>;
  if(path==="/analytics"&&principal)return <AnalyticsPreview principal={principal}/>;
  if(path==="/profile"&&principal)return <ProfileParityPreview principal={principal}/>;
  if(path==="/inventory"&&principal)return <V2InventoryView key={[principal.userId,principal.institutionId,principal.roleId].join(":")} principal={principal}/>;
  if(!endpoint[path])return <div className="empty"><strong>Data unavailable</strong>The official feature API is not implemented yet. Runtime mock fallback is disabled.</div>;
  if(!state.data&&state.busy)return <div className="empty" aria-live="polite"><strong>Loading authorized data</strong>Waiting for the official API.</div>;
  if(!state.data)return <div className="empty" role="alert"><strong>Unable to load data</strong>{state.error}<br/><button className="button" onClick={state.manual}>Retry</button></div>;
  if(path==="/")return <DashboardView data={state.data as Dashboard} refreshError={state.error} onRetry={state.manual}/>;
  const withRefreshState=(view:ReactNode)=><>{state.error&&<div className="v2-inline-state warning" role="status"><strong>Update unavailable</strong><span>{state.error}</span><span>Showing the last successfully loaded data.</span><button className="button compact" onClick={state.manual}>Retry update</button></div>}{view}</>;
  if(path==="/consortium")return withRefreshState(<ConsortiumView data={state.data as Consortium}/>);
  if(path==="/audit")return withRefreshState(<AuditView data={state.data as Audit}/>);
  if(path==="/reporting")return withRefreshState(<ReportView data={state.data as Report}/>);
  if(path==="/alerts")return withRefreshState(<AlertsView data={state.data as Alerts} canAcknowledge={canAcknowledge} onRefresh={state.manual}/>);
  if(path==="/transfers"&&principal)return withRefreshState(<TransferExplorer data={state.data as Transfers} canSubmit={false} canReject={false} canCancel={false} canCancelApproved={false} canDispatch={false} canStartTransit={false} canDelay={false} canResume={false} canReceive={false} canPreviewExport={canPreviewTransferExport} receiptInstitutionId={principal.institutionId} onRefresh={state.manual} principal={principal}/>);
  return <div className="empty"><strong>Data unavailable</strong>The selected official feature API is not implemented.</div>;
}
