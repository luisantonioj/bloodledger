import { InstitutionRegulatoryView } from "../features/reporting/institution-regulatory-view";
import { InstitutionAccountsView } from "../features/accounts/institution-accounts-view";
import { InstitutionProfile } from "../features/profile/institution-profile";
import { V2TransferEvidenceView } from "../features/transfers/v2-transfer-evidence-view";
import { canAct, type Principal } from "../auth/permissions";
import type { ReactNode } from "react";
import { AccountsParityPreview } from "../features/accounts/accounts-parity-preview";
import { AnalyticsPreview } from "../features/analytics/analytics-preview";
import { AuditView } from "../features/audit/audit-view";
import { AlertsView } from "../features/alerts/alerts-view";
import { ConsortiumView } from "../features/consortium/consortium-view";
import { V2InventoryView } from "../features/inventory/v2-inventory-view";
import { ProfileParityPreview } from "../features/profile/profile-parity-preview";
import { ReportView } from "../features/reporting/report-view";
import { TransferExplorer } from "../features/transfers/transfers-view";
import { useLiveData } from "../hooks/use-live-data";
import type { Alerts, Audit, Consortium, FeatureResponse, Report, Transfers } from "../services/api/types";

export function FeatureRouter({path,canAcknowledge=false,canSubmitTransfer=false,canRejectTransfer=false,canCancelTransfer=false,canCancelApprovedTransfer=false,canDispatchTransfer=false,canStartTransit=false,canDelayTransfer=false,canResumeTransfer=false,canReceiveTransfer=false,canCapture=false,canPreviewInventoryExport=false,canPreviewTransferExport=false,principal}:{path:string;canAcknowledge?:boolean;canSubmitTransfer?:boolean;canRejectTransfer?:boolean;canCancelTransfer?:boolean;canCancelApprovedTransfer?:boolean;canDispatchTransfer?:boolean;canStartTransit?:boolean;canDelayTransfer?:boolean;canResumeTransfer?:boolean;canReceiveTransfer?:boolean;canCapture?:boolean;canPreviewInventoryExport?:boolean;canPreviewTransferExport?:boolean;principal?:Principal}) {
  const endpoint:Record<string,string>={"/":principal && ["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)?"/api/v2/dashboard":"/api/v1/dashboard","/alerts":principal && ["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)?"/api/v2/alerts":"/api/v1/alerts","/transfers":"/api/v1/transfers","/consortium":"/api/v1/consortium","/audit":principal && ["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)?"/api/v2/audit":"/api/v1/audit","/reporting":"/api/v1/reports/inventory"};
  if (principal?.accountId) { endpoint["/"]="/api/v2/dashboard"; endpoint["/alerts"]="/api/v2/alerts"; endpoint["/audit"]="/api/v2/audit"; endpoint["/transfers"]="/api/v2/transfers"; }
  const state=useLiveData<FeatureResponse>(principal?.accountId && ["/consortium","/reporting"].includes(path) ? null : endpoint[path]??null);
  if(principal?.accountId && ["/consortium","/reporting"].includes(path))return <InstitutionRegulatoryView report={path==="/reporting"}/>;
  if(path==="/transfers"&&principal&&(principal.accountId||["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)))return <V2TransferEvidenceView principal={principal}/>;
  if(path==="/accounts"&&principal)return principal.accountId ? <InstitutionAccountsView principal={principal}/> : <AccountsParityPreview principal={principal}/>;
  if(path==="/analytics"&&principal)return <AnalyticsPreview principal={principal}/>;
  if(path==="/profile"&&principal)return principal.accountId ? <InstitutionProfile principal={principal}/> : <ProfileParityPreview principal={principal}/>;
  if(path==="/inventory"&&principal)return <V2InventoryView key={[principal.userId,principal.institutionId,principal.roleId].join(":")} principal={principal}/>;
  if(!endpoint[path])return <div className="empty"><strong>Data unavailable</strong>The official feature API is not implemented yet. Runtime mock fallback is disabled.</div>;
  if(!state.data&&state.busy)return <div className="empty" aria-live="polite"><strong>Loading authorized data</strong>Waiting for the official API.</div>;
  if(!state.data)return <div className="empty" role="alert"><strong>Unable to load data</strong>{state.error}<br/><button className="button" onClick={state.manual}>Retry</button></div>;
  const withRefreshState=(view:ReactNode)=><>{state.error&&<div className="v2-inline-state warning" role="status"><strong>Update unavailable</strong><span>{state.error}</span><span>Showing the last successfully loaded data.</span><button className="button compact" onClick={state.manual}>Retry update</button></div>}{view}</>;
  if(path==="/consortium")return withRefreshState(<ConsortiumView data={state.data as Consortium}/>);
  if(path==="/audit")return withRefreshState(<AuditView data={state.data as Audit}/>);
  if(path==="/reporting")return withRefreshState(<ReportView data={state.data as Report}/>);
  if(path==="/alerts")return withRefreshState(<AlertsView data={normalizeAlerts(state.data as Alerts)} canAcknowledge={principal?.accountId ? canAct(principal,"alert:acknowledge") : canAcknowledge} onRefresh={state.manual}/>);
  if(path==="/transfers"&&principal)return withRefreshState(<TransferExplorer data={state.data as Transfers} canSubmit={false} canReject={false} canCancel={false} canCancelApproved={false} canDispatch={false} canStartTransit={false} canDelay={false} canResume={false} canReceive={false} canPreviewExport={canPreviewTransferExport} receiptInstitutionId={principal.institutionId} onRefresh={state.manual} principal={principal}/>);
  return <div className="empty"><strong>Data unavailable</strong>The selected official feature API is not implemented.</div>;
}

function normalizeAlerts(data: Alerts): Alerts {
  if(data.scope!=="CITY_AGGREGATE")return data;
  return {...data,aggregates:data.aggregates.map(item=>{
    const row=item as unknown as Record<string,unknown>;
    return {...item,institutionDisplayName:item.institutionDisplayName ?? String(row.institution_id ?? "Institution"),alertType:item.alertType ?? "EXPIRED",severity:item.severity ?? "CRITICAL",status:item.status ?? "OPEN",lastEvaluatedAt:item.lastEvaluatedAt ?? ""};
  })};
}
