import { PaginatedTable, RecordPagination } from "../../components/ui/record-pagination";
import { compactRecordReference, formatBloodType, formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import type { Principal } from "../../auth/permissions";
import type { Dashboard } from "../../services/api/types";
import { componentLabel } from "../transfers/requester-transfer-data";
import { prcUnits } from "../transfers/prc-supply-workspace";
import { PrcNetworkOverview, prcNetworkOverview } from "./prc-network-overview";
import { reportingLabel, reportingRows, replenishmentOrder } from "./prc-reporting-status";
import { useCheckpointRecords } from "./use-checkpoint-records";
import type { PrcSupplyRead } from "./use-open-supply-requests";

const reportingStatusClass = { UP_TO_DATE: "status", AWAITING: "status warning", MISSED: "status critical", NO_RECORDS: "status warning" } as const;
const supplyStatusClass = (status: string) => statusClassName(status === "SUBMITTED" ? "PENDING" : status === "DECLINED" ? "REJECTED" : status);

// FR-03/12: reporting status comes from saved 09:00/16:00 stock records; available units from the
// live network projection. Replenishment rows are the PRC supply requests (off-chain coordination).
export function PrcDashboardPlaceholder({ data, loading = false, principal, supply }: { data: Dashboard; loading?: boolean; principal: Principal; supply: PrcSupplyRead }) {
  const records = useCheckpointRecords(principal);
  let banks: { institutionId: string; name: string; available: number | null }[] = [];
  try {
    const view = prcNetworkOverview(data, "ALL");
    if (view.ready) banks = view.facilities.map(([institutionId, name]) => ({ institutionId, name, available: view.selected.filter(row => row.institutionId === institutionId).reduce((sum, row) => sum + (row.available ?? 0), 0) }));
  } catch { banks = []; }
  const reporting = records.snapshots ? reportingRows(banks, records.snapshots, records.loadedAt ?? Date.now()) : [];
  const requests = supply.rows ? replenishmentOrder(supply.rows) : [];
  const reportingMessage = records.error ? ["Reporting status unavailable", records.error] : records.busy || loading ? ["Loading reporting status…", "Reading saved stock records."] : ["No reporting blood banks", "Blood banks appear here once they report inventory."];
  const requestMessage = supply.error ? ["Replenishment requests unavailable", supply.error] : supply.busy || !supply.rows ? ["Loading replenishment requests…", "Reading PRC supply requests."] : ["No replenishment requests", "Supply requests from blood banks appear here."];
  const reportingHead = <thead><tr><th>Blood Bank</th><th>Updated</th><th className="numeric">Available</th><th>Status</th></tr></thead>;
  const requestHead = <thead><tr><th>Reference</th><th>Blood</th><th className="numeric">Units</th><th>Needed By</th><th>Status</th></tr></thead>;
  return <div className="prc-dashboard-placeholders">
    <PrcNetworkOverview data={data} loading={loading}/>
    <div className="prc-dashboard-bottom-grid">
      <section className="prc-dashboard-card" aria-labelledby="prc-reporting-heading">
        <header><div><h2 id="prc-reporting-heading">Blood-Bank Reporting Status</h2></div></header>
        {reporting.length ? <PaginatedTable total={reporting.length} label="Blood bank reporting"><table className="data-table prc-reporting-placeholder-table">{reportingHead}<tbody>{reporting.map(row => <tr key={row.institutionId}>
          <td><strong>{row.name}</strong></td>
          <td title="Time of the latest saved stock record">{row.lastRecordAt ? formatManilaDateTime(row.lastRecordAt) : "—"}</td>
          <td className="numeric">{row.available ?? "—"}</td>
          <td><span className={reportingStatusClass[row.state]}>{reportingLabel(row)}</span></td>
        </tr>)}</tbody></table></PaginatedTable>
          : <><div className="table-wrap"><table className="data-table prc-reporting-placeholder-table">{reportingHead}<tbody/></table></div><div className="prc-placeholder-table-message" role="status"><strong>{reportingMessage[0]}</strong><span>{reportingMessage[1]}</span></div><RecordPagination total={0} ready={false} label="Blood bank reporting"/></>}
      </section>
      <section className="prc-dashboard-card" aria-labelledby="prc-replenishment-heading">
        <header><div><h2 id="prc-replenishment-heading">Hospital Replenishment Requests</h2></div><div className="prc-coordination-action"><a className="prc-dashboard-link" href="/prc-supply">Coordination records →</a></div></header>
        {requests.length ? <PaginatedTable total={requests.length} label="Hospital replenishment requests"><table className="data-table prc-replenishment-placeholder-table">{requestHead}<tbody>{requests.map(row => <tr key={row.requestId}>
          <td><a className="requester-request-reference mono" href={"/prc-supply?prcRequestId=" + encodeURIComponent(row.requestId)} title={row.requestId}>{compactRecordReference(row.requestId)}</a><small>{row.requestingInstitution.displayName ?? row.requestingInstitution.institutionId}</small></td>
          <td><strong>{formatBloodType(row.bloodType)}</strong><small>{componentLabel(row.componentType)}</small></td>
          <td className="numeric">{prcUnits(row)}</td>
          <td>{formatManilaDateTime(row.requiredBy)}</td>
          <td><span className={supplyStatusClass(row.status)}>{humanizeCode(row.status)}</span></td>
        </tr>)}</tbody></table></PaginatedTable>
          : <><div className="table-wrap"><table className="data-table prc-replenishment-placeholder-table">{requestHead}<tbody/></table></div><div className="prc-placeholder-table-message" role="status"><strong>{requestMessage[0]}</strong><span>{requestMessage[1]}</span></div><RecordPagination total={0} ready={false} label="Hospital replenishment requests"/></>}
      </section>
    </div>
  </div>;
}
