import type { Principal } from "../../auth/permissions";
import { analyticsScopeLabel, canViewAnalyticsPreview } from "./analytics-access";

const unavailableMetrics = [
  ["Blood requests", "—", "Historical demand API unavailable"],
  ["Units requested", "—", "Authorized aggregate unavailable"],
  ["Confirmed units used", "—", "Approved source unavailable"],
  ["Highest requesting group", "—", "No connected records"],
  ["Highest-volume month", "—", "No complete period"],
] as const;

export function AnalyticsPreview({ principal }: { principal: Principal }) {
  if (!canViewAnalyticsPreview(principal)) {
    return <div className="analytics-preview-state unauthorized" role="alert"><span aria-hidden="true">!</span><div><strong>Analytics preview unavailable</strong><p>This frontend composition is limited to blood-bank operational roles and the PRC institution. It is not an API authorization boundary.</p></div></div>;
  }

  const prcView = principal.roleId === "ROLE-04";
  const groupLabel = prcView ? "Requesting hospital" : "Requesting department";
  return <div className="analytics-preview">
    <div className="preview-disclosure analytics-disclosure"><span aria-hidden="true">i</span><div><strong>Simulation-only analytics interface</strong><p>No analytics endpoint is called, no institutional history is loaded, and the browser does not calculate demand, reserve, surplus, or redistributability.</p></div><b>FRONTEND ONLY</b></div>
    <section className="analytics-preview-filter">
      <header><div><h3>Reporting filters</h3><p>Future reports and exports must use this exact authorized scope and filtered view.</p></div><span>{analyticsScopeLabel(principal)}</span></header>
      <div>
        <label>Date from<input type="date" disabled /></label><label>Date to<input type="date" disabled /></label>
        <label>Blood type<select disabled><option>All blood types</option></select></label><label>Component<select disabled><option>All components</option></select></label>
        <label>{groupLabel}<select disabled><option>All authorized groups</option></select></label>
      </div>
    </section>
    <div className="analytics-preview-metrics">{unavailableMetrics.map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="analytics-preview-grid">
      <section className="analytics-preview-panel"><header><div><h3>{prcView ? "Hospital demand" : "Department demand"}</h3><p>Observed historical requests for the selected period.</p></div><button className="button compact" type="button" disabled>Export PDF</button></header><div className="analytics-preview-state"><span aria-hidden="true">⌕</span><div><strong>Historical demand unavailable</strong><p>An approved, permission-scoped demand dataset and completeness metadata are required.</p></div></div></section>
      <section className="analytics-preview-panel"><header><div><h3>Monthly demand</h3><p>Incomplete periods must remain visibly distinct from zero demand.</p></div><button className="button compact" type="button" disabled>Table alternative</button></header><div className="analytics-preview-chart" aria-label="Unavailable monthly demand chart"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><p className="analytics-unavailable-note">Assessment unavailable · no approved historical dataset</p></section>
    </div>
    <section className="analytics-preview-panel assessment"><header><div><h3>Redistribution assessment</h3><p>Future values must be supplied by the backend with freshness, uncertainty, reserve-policy, and explanation evidence.</p></div><button className="button compact" type="button" disabled>Export PDF</button></header><div className="table-wrap"><table className="data-table"><thead><tr>{prcView&&<th>Facility</th>}<th>Blood type</th><th>Component</th><th>Eligible stock</th><th>Expected demand</th><th>Uncertainty</th><th>Minimum reserve</th><th>Estimated surplus</th><th>Assessment</th></tr></thead><tbody><tr>{prcView&&<td>Not available</td>}<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td><span className="status warning">Assessment unavailable</span><small className="analytics-cell-note">No approved backend result or freshness evidence.</small></td></tr></tbody></table></div><footer>Simulation only—not authorization to redistribute. Operational action always requires authorized human review.</footer></section>
  </div>;
}
