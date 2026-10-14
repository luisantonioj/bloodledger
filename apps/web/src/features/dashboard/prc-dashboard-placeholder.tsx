import { ActionButton } from "../../components/ui/action-button";
import { RecordPagination } from "../../components/ui/record-pagination";
import type { Dashboard } from "../../services/api/types";
import { PrcNetworkOverview } from "./prc-network-overview";

export function PrcDashboardPlaceholder({ data,loading=false }: { data:Dashboard;loading?:boolean }) {
  return <div className="prc-dashboard-placeholders">
    <PrcNetworkOverview data={data} loading={loading}/>
    <div className="prc-dashboard-bottom-grid">
      <section className="prc-dashboard-card" aria-labelledby="prc-reporting-heading">
        <header><div><h2 id="prc-reporting-heading">Blood-Bank Reporting Status</h2></div></header>
        <div className="table-wrap"><table className="data-table prc-reporting-placeholder-table"><thead><tr><th>Blood Bank</th><th>Updated</th><th className="numeric">Available</th><th>Status</th></tr></thead><tbody/></table></div><div className="prc-placeholder-table-message"><strong>Awaiting reporting data</strong><span>No blood-bank reporting data displayed yet.</span></div><RecordPagination total={0} ready={false} label="Blood bank reporting"/>
      </section>
      <section className="prc-dashboard-card" aria-labelledby="prc-replenishment-heading">
        <header><div><h2 id="prc-replenishment-heading">Hospital Replenishment Requests</h2></div><div className="prc-coordination-action"><ActionButton className="prc-dashboard-link" type="button" disabled unavailableReason="PRC coordination records are not connected yet.">Coordination records →</ActionButton></div></header>
        <div className="table-wrap"><table className="data-table prc-replenishment-placeholder-table"><thead><tr><th>Reference</th><th>Blood</th><th className="numeric">Units</th><th>Needed By</th><th>Status</th></tr></thead><tbody/></table></div><div className="prc-placeholder-table-message"><strong>Awaiting request data</strong><span>No replenishment request data displayed yet.</span></div><RecordPagination total={0} ready={false} label="Hospital replenishment requests"/>
      </section>
    </div>
  </div>;
}
