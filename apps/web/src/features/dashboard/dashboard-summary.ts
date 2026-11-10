import type { Principal } from "../../auth/permissions";
import type { Consortium, Dashboard } from "../../services/api/types";
import { V2_BLOOD_TYPES } from "../../services/api/v2";
import { hospitalNetworkRows } from "../consortium/hospital-network-view";
import { ownRequests, type RequesterRequest, type RequesterRequests } from "./requester-dashboard-data";
import { classifyStock, stockThresholds } from "./stock-classification";

// Optional reads that feed the requestor and PRC cards. Absent sources stay unavailable.
export interface DashboardSummarySources {
  requests?: RequesterRequests;
  openSupplyRequests?: number | null;
}

const ON_THE_WAY = ["DISPATCHED", "IN_TRANSIT", "DELAYED"];
// The ledger request stays PENDING after approval, so only a request without a recorded
// reservation is still awaiting the supplier's decision.
const awaitingDecision = (row: RequesterRequest) => (row.decision_state ?? (row.status === "PENDING" && !row.reservation_id ? "AWAITING_DECISION" : row.status)) === "AWAITING_DECISION";

// Requestor cards count this facility's own requests (destination = this facility) by recorded state.
export function requesterSummaryCounts(data: RequesterRequests, institutionId: string) {
  const own = ownRequests(data, institutionId);
  return {
    submitted: own.length,
    awaitingReview: own.filter(awaitingDecision).length,
    onTheWay: own.filter(row => ON_THE_WAY.includes(row.reservation_status ?? "")).length,
    received: own.filter(row => row.reservation_status === "RECEIVED").length,
  };
}

// PRC cards use the city-wide AVAILABLE projection and the synthetic stock-band policy.
// Redistributable supply = units above each bank's adequate band ceiling (surplus stock).
// Decision support only; it never approves or reserves a transfer.
export function prcSummaryCounts(data: Dashboard) {
  if (data.lastSuccessfulProjectionAt === null) return null;
  let rows: ReturnType<typeof hospitalNetworkRows>;
  try { rows = hospitalNetworkRows({ ...data, alerts: [], transferSummary: [] } as unknown as Consortium); } catch { return null; }
  let redistributable = 0;
  const critical = new Set<string>();
  for (const row of rows) {
    const available = row.available ?? 0;
    const limits = stockThresholds(row.bloodType, row.component);
    if (limits) redistributable += Math.max(0, available - limits.adequateMax);
    if (classifyStock(row.bloodType, row.component, available) === "critical") critical.add(row.bloodType);
  }
  return {
    banks: new Set(rows.map(row => row.institutionId)).size,
    redistributable,
    criticalBloodTypes: V2_BLOOD_TYPES.filter(type => critical.has(type)).length,
  };
}

export function dashboardSummary(data: Dashboard, principal: Principal, sources: DashboardSummarySources = {}) {
  const category = principal.accountCategory ?? (principal.roleId === "ROLE-03" ? "REQUESTOR" : data.composition === "REGULATORY" ? "REGULATORY" : "BLOOD_BANK");
  const labels = category === "REQUESTOR" ? ["Submitted Requests", "Awaiting Review", "On the Way", "Received"]
    : category === "PRC" ? ["Participating Blood Banks", "Redistributable Supply", "Critical Blood Types", "Open Supply Requests"]
      : category === "DOH" ? ["Monitored Blood Banks", "Fully Compliant", "Reports Due", "Late Submissions"]
        : category === "REGULATORY" ? ["Total Blood Units", "Redistributable Supply", "Critical Blood Types", "Open Supply Requests"]
          : ["Total Blood Units", "Expiring Soon", "Low Stock", "Pending Requests"];
  // FR-03 / BL-TST-01: a missing source stays unavailable (—), never a sample value.
  let values: (number | null)[] = labels.map(() => null);
  if (category === "BLOOD_BANK" || category === "REGULATORY") {
    values[0] = data.lastSuccessfulProjectionAt !== null ? data.inventory.reduce((sum, item) => sum + item.confirmedCount, 0) : null;
  } else if (category === "REQUESTOR" && sources.requests) {
    const counts = requesterSummaryCounts(sources.requests, principal.institutionId);
    values = [counts.submitted, counts.awaitingReview, counts.onTheWay, counts.received];
  } else if (category === "PRC") {
    const counts = prcSummaryCounts(data);
    values = [counts?.banks ?? null, counts?.redistributable ?? null, counts?.criticalBloodTypes ?? null, sources.openSupplyRequests ?? null];
  }
  return labels.map((label, index) => ({ label, value: values[index] }));
}
