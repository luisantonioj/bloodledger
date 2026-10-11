import { can, type Principal } from "../../auth/permissions";

export function DohDashboardPlaceholder({ principal }: { principal: Principal }) {
  return <div className="doh-dashboard-grid">
    <section className="doh-dashboard-card" aria-labelledby="doh-compliance-heading">
      <header><div><h2 id="doh-compliance-heading">Compliance Reports</h2><p>Reporting status and latest submissions by blood bank.</p></div>{can(principal, "reports:read") && <a className="doh-dashboard-link" href="/reporting">View reports →</a>}</header>
      <div className="table-wrap"><table className="data-table doh-compliance-placeholder-table"><thead><tr><th>Licensed Facility</th><th>Morning</th><th>Afternoon</th><th>Last Submission</th><th>Status</th></tr></thead><tbody/></table></div>
      <div className="doh-placeholder-message"><strong>Awaiting reporting data</strong><span>No compliance report data displayed yet.</span></div>
    </section>
    <section className="doh-dashboard-card" aria-labelledby="doh-alerts-heading">
      <header><div><h2 id="doh-alerts-heading">Alerts</h2><p>Compliance alerts for DOH review.</p></div>{can(principal, "alerts:read") && <a className="doh-dashboard-link" href="/alerts">View all alerts →</a>}</header>
      <div className="doh-placeholder-message"><strong>Awaiting alert data</strong><span>No compliance alert data displayed yet.</span></div>
    </section>
  </div>;
}
