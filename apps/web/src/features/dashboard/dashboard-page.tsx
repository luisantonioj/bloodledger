import { RefreshIcon } from "../../components/ui/refresh-button";
import { can } from "../../auth/permissions";
import { isRequester, type RequesterRequests } from "./requester-dashboard-data";
import type { Principal } from "../../auth/permissions";
import { useLiveData } from "../../hooks/use-live-data";
import type { Dashboard } from "../../services/api/types";
import { DashboardView } from "./dashboard-view";
import { formatManilaDateTime } from "../../components/ui/display";

export function DashboardPage({ principal }: { principal: Principal }) {
  const endpoint = principal.accountId || ["ROLE-01", "ROLE-02", "ROLE-03"].includes(principal.roleId)
    ? "/api/v2/dashboard" : "/api/v1/dashboard";
  const state = useLiveData<Dashboard>(endpoint);

  const requester = isRequester(principal);
  const hasRequests = requester;
  const requests = useLiveData<RequesterRequests>(hasRequests && can(principal, "transfers:read") ? "/api/v2/transfers" : null);
  const busy = state.busy || (hasRequests && requests.busy);
  const refresh = () => { state.manual(); if (hasRequests) requests.manual(); };

  return <div className="page">
    <header className="page-head">
      <h1 className="page-title">Dashboard</h1>
      <div className="dashboard-actions">
      <span className="dashboard-updated" title="Latest inventory projection · Asia/Manila">
        Last updated: {state.data?.lastSuccessfulProjectionAt
          ? <time dateTime={state.data.lastSuccessfulProjectionAt}>{formatManilaDateTime(state.data.lastSuccessfulProjectionAt)}</time>
          : "Unavailable"}
      </span>
      <button className="button compact dashboard-refresh" type="button" onClick={refresh} disabled={busy} aria-busy={busy}>
        <RefreshIcon/>
        {busy ? "Refreshing…" : "Refresh"}
      </button>
      </div>
    </header>
    <section className="dashboard-content">
      {state.data ? <DashboardView data={state.data} principal={principal} refreshError={state.error} onRetry={refresh} requests={requests}/>
        : principal.accountCategory === "BLOOD_BANK" ? <DashboardView principal={principal} requests={requests} loading={state.busy} refreshError={state.error} onRetry={refresh} data={{composition:"OPERATIONAL",scope:"INSTITUTION",inventory:[],pendingScans:[],lastSuccessfulProjectionAt:null,classification:"SIMULATION_ONLY"}}/>
          : <DashboardView principal={principal} requests={requests} loading={state.busy} refreshError={state.error} onRetry={refresh} data={{composition:"REGULATORY",scope:"CITY_AGGREGATE",inventory:[],pendingScans:[],lastSuccessfulProjectionAt:null,classification:"SIMULATION_ONLY"}}/>}
    </section>
  </div>;
}
