import { can, type Principal } from "../../auth/permissions";
import { useLiveData } from "../../hooks/use-live-data";
import type { Alerts } from "../../services/api/types";

type AggregateRow = { count?: number };

/** Counts expiry alerts in the caller's authorized scope (TC-E04): own institution, or city aggregate for PRC/DOH. */
export function alertSummaryCounts(data: Alerts): { open: number; unacknowledged: number | null } {
  if (data.scope === "CITY_AGGREGATE") return { open: (data.aggregates as AggregateRow[]).reduce((sum, row) => sum + (Number(row.count) || 0), 0), unacknowledged: null };
  return { open: data.alerts.length, unacknowledged: data.alerts.filter(alert => !alert.acknowledged).length };
}

export function DashboardAlertSummary({ principal }: { principal: Principal }) {
  const state = useLiveData<Alerts>(can(principal, "alerts:read") ? "/api/v2/alerts" : null);
  if (!can(principal, "alerts:read")) return null;
  const counts = state.data ? alertSummaryCounts(state.data) : null;
  const aggregate = state.data?.scope === "CITY_AGGREGATE";
  return <section className="dashboard-alert-summary" aria-labelledby="dashboard-alert-summary-heading">
    <header><h2 id="dashboard-alert-summary-heading">Expiry alerts</h2>{principal.accountCategory !== "DOH" && <a href="/alerts">View all alerts →</a>}</header>
    {state.error && !counts ? <p role="alert">Alerts could not be loaded. Refresh to try again.</p>
      : !counts ? <p role="status">Loading alerts…</p>
      : <p><strong data-testid="dashboard-alert-count">{counts.open}</strong> {counts.open === 1 ? "expired unit" : "expired units"} {aggregate ? "across the city network" : "in your institution"}{counts.unacknowledged !== null && counts.open > 0 ? ` · ${counts.unacknowledged} not acknowledged` : ""}</p>}
  </section>;
}
