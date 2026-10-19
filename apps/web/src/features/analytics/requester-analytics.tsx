import type { Principal } from "../../auth/permissions";
import { InformationHelp } from "../../components/ui/information-help";
import { RefreshButton } from "../../components/ui/refresh-button";
import { formatBloodType } from "../../components/ui/display";
import { useLiveData } from "../../hooks/use-live-data";
import { componentLabel, parseRequesterRecords, type RequesterRecords } from "../transfers/requester-transfer-data";

// FR-05/12: summarize the requester's own recorded requests, never supplier forecasts.
export function RequesterAnalytics({ principal }: { principal: Principal }) {
  const state = useLiveData<unknown>("/api/v2/transfers");
  let records: RequesterRecords | undefined, parseError = "";
  if (state.data) {
    try { records = parseRequesterRecords(state.data, principal); }
    catch { parseError = "Request summaries could not be loaded. Refresh to try again."; }
  }
  const requests = records?.requests ?? [];
  const received = requests.filter(row => row.status === "RECEIVED" && row.ledger_transaction_id !== null);
  const pending = requests.filter(row => ["PENDING", "REQUESTED", "SUBMITTED"].includes(row.status));
  const groups = new Map<string, { bloodType: string; component: string; requests: number; units: number; fulfilled: number }>();
  for (const row of requests) {
    const key = row.blood_type + ":" + row.component_type;
    const group = groups.get(key) ?? { bloodType: row.blood_type, component: row.component_type, requests: 0, units: 0, fulfilled: 0 };
    group.requests++; group.units += row.quantity;
    if (row.status === "RECEIVED" && row.ledger_transaction_id !== null) group.fulfilled++;
    groups.set(key, group);
  }
  const value = (number: number) => records ? number : "—";
  const error = state.error || parseError;
  return <div className="analytics-preview analytics-workspace requester-analytics">
    <section className="analytics-preview-filter">
      <header><h3>Request overview</h3><InformationHelp label="Request overview">Review blood requested by your facility and the recorded progress of those requests. Pending means waiting for a decision; approved requests are not yet fulfilled. Fulfilled counts only requests recorded as received with ledger confirmation. These summaries cover the records returned for your facility, not a forecast or a complete historical report.</InformationHelp></header>
      <div className="requester-analytics-toolbar"><span>{principal.institutionDisplayName}</span><RefreshButton busy={state.busy} onRefresh={state.manual}/></div>
    </section>
    <div className="analytics-preview-metrics requester-analytics-metrics">
      <article><span>Units requested</span><strong>{value(requests.reduce((sum, row) => sum + row.quantity, 0))}</strong><small>Across returned requests, including closed requests</small></article>
      <article><span>Requests fulfilled</span><strong>{value(received.length)}</strong><small>Recorded as received with confirmation</small></article>
      <article><span>Pending requests</span><strong>{value(pending.length)}</strong><small>Awaiting a decision</small></article>
      <article><span>Units in fulfilled requests</span><strong>{value(received.reduce((sum, row) => sum + row.quantity, 0))}</strong><small>Requested quantities of fulfilled requests</small></article>
    </div>
    <section className="analytics-preview-panel">
      <header><h3>Requests by blood product</h3><InformationHelp label="Requests by blood product">See how many requests and requested units belong to each blood type and component. Counts include all returned statuses. This reflects your facility's recorded requests, not available network stock.</InformationHelp></header>
      <div className="table-wrap"><table className="data-table requester-analytics-table"><thead><tr><th>Blood type</th><th>Component</th><th>Requests</th><th>Units requested</th><th>Fulfilled</th></tr></thead><tbody>
        {[...groups.values()].map(group => <tr key={group.bloodType + group.component}><td>{formatBloodType(group.bloodType)}</td><td>{componentLabel(group.component)}</td><td>{group.requests}</td><td>{group.units}</td><td>{group.fulfilled}</td></tr>)}
        {groups.size === 0 && <tr><td colSpan={5}><div className="analytics-empty" role={error ? "alert" : "status"}><strong>{error ? "Request summaries unavailable" : state.busy && !records ? "Loading request summaries…" : "No request records yet"}</strong><p>{error || "Your facility's blood requests will appear here when records are available."}</p></div></td></tr>}
      </tbody></table></div>
      {error && groups.size > 0 && <p className="analytics-freshness-note" role="status">Refresh unavailable. Showing the last loaded requests.</p>}
    </section>
    <section className="analytics-preview-panel">
      <header><h3>Receipt trends</h3><InformationHelp label="Receipt trends">This section will show how recorded inbound receipts change over time when receipt dates and quantities are available. Request submission dates and approval dates are not receipt dates.</InformationHelp></header>
      <div className="analytics-empty"><strong>Receipt trends unavailable</strong><p>Dated receipt records are not available in this view yet.</p></div>
    </section>
  </div>;
}
