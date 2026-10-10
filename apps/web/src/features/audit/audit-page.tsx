import type {Principal} from "../../auth/permissions";
import {RefreshButton} from "../../components/ui/refresh-button";
import {useLiveData} from "../../hooks/use-live-data";
import type {Audit} from "../../services/api/types";
import {AuditView} from "./audit-view";
export function AuditPage({principal}:{principal:Principal}){
 const endpoint=principal.accountId||["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)?"/api/v2/audit":"/api/v1/audit";
 const state=useLiveData<Audit>(endpoint);
 return <div className="page activity-history-page"><header className="page-head"><h1 className="page-title">Activity History</h1><RefreshButton busy={state.busy} onRefresh={state.manual}/></header>
 {state.error&&<div className="requester-transfer-notice" role="status"><div className="requester-notice-copy"><strong>{state.data?"Activity could not refresh":"Activity history unavailable"}</strong><p>{state.error}</p>{state.data&&<p>Showing the last confirmed records.</p>}</div><button className="button compact" disabled={state.busy} onClick={state.manual}>Retry</button></div>}
 {state.data?<AuditView data={state.data}/>:<div className="requester-records-empty" aria-live="polite"><strong>{state.busy?"Loading activity…":"Activity records unavailable"}</strong><span>{state.busy?"Waiting for your authorized activity records.":"Use Refresh to try again."}</span></div>}</div>;
}
