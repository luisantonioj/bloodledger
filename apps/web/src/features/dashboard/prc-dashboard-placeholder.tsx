import { can, type Principal } from "../../auth/permissions";

const bloodTypes = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];

export function PrcDashboardPlaceholder({ principal }: { principal: Principal }) {
  return <div className="prc-dashboard-placeholders">
    <section className="prc-dashboard-card" aria-labelledby="prc-inventory-heading">
      <header><div><h2 id="prc-inventory-heading">Blood-Bank Inventory Overview</h2><p>Total PRBC stock by blood type for every participating blood bank.</p></div>{can(principal, "alerts:read") && <a className="prc-dashboard-link" href="/alerts">View alerts →</a>}</header>
      <div className="prc-inventory-placeholder-body"><div className="prc-inventory-placeholder-scroll">
        <div className="prc-inventory-placeholder" role="img" aria-label="Blood-bank inventory chart placeholder. No data displayed.">
          <span className="prc-placeholder-axis">Total units</span>
          <div className="prc-placeholder-plot"/>
          <div className="prc-placeholder-blood-types" aria-hidden="true">{bloodTypes.map(type => <span key={type}>{type}</span>)}</div>
        </div>
      </div><div className="prc-placeholder-message"><strong>Awaiting inventory data</strong><span>No blood-bank stock data displayed yet.</span></div></div>
    </section>
    <div className="prc-dashboard-bottom-grid">
      <section className="prc-dashboard-card" aria-labelledby="prc-reporting-heading">
        <header><div><h2 id="prc-reporting-heading">Blood-Bank Reporting Status</h2><p>Latest stock update received from each member blood bank.</p></div></header>
        <div className="table-wrap"><table className="data-table prc-reporting-placeholder-table"><thead><tr><th>Blood Bank</th><th>Updated</th><th className="numeric">Available</th><th>Status</th></tr></thead><tbody/></table></div><div className="prc-placeholder-table-message"><strong>Awaiting reporting data</strong><span>No blood-bank reporting data displayed yet.</span></div>
      </section>
      <section className="prc-dashboard-card" aria-labelledby="prc-replenishment-heading">
        <header><div><h2 id="prc-replenishment-heading">Hospital Replenishment Requests</h2><p>Requests sent to PRC for blood-bank stock replenishment.</p></div><div className="prc-coordination-action"><button className="prc-dashboard-link" type="button" disabled aria-describedby="prc-coordination-pending">Open coordination records →</button><span id="prc-coordination-pending">Coming soon</span></div></header>
        <div className="table-wrap"><table className="data-table prc-replenishment-placeholder-table"><thead><tr><th>Reference</th><th>Blood</th><th className="numeric">Units</th><th>Needed By</th><th>Status</th></tr></thead><tbody/></table></div><div className="prc-placeholder-table-message"><strong>Awaiting request data</strong><span>No replenishment request data displayed yet.</span></div>
      </section>
    </div>
  </div>;
}
