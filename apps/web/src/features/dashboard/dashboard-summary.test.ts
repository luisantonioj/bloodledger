import { describe, expect, it } from "vitest";
import type { Principal } from "../../auth/permissions";
import type { Dashboard } from "../../services/api/types";
import { dashboardSummary } from "./dashboard-summary";

const data: Dashboard = { composition: "OPERATIONAL", scope: "INSTITUTION", inventory: [{ institutionId: "INST_SYNTH", institutionDisplayName: "Synthetic institution", bloodType: "A+", component: "RBC", inventoryStatus: "AVAILABLE", confirmedCount: 8, lastProjectedAt: "2026-10-09T00:00:00Z" }], pendingScans: [{ status: "QUEUED", count: 3 }], lastSuccessfulProjectionAt: "2026-10-09T00:00:00Z", classification: "SIMULATION_ONLY" };
const principal = (accountCategory: Principal["accountCategory"]) => ({ accountCategory, roleId: "ROLE-02" } as Principal);

// FR-03 / NFR-11 / BL-TST-01: account compositions and truthful missing metrics.
describe("dashboard summary cards", () => {
  it.each([
    ["BLOOD_BANK", ["Total Blood Units", "Expiring Soon", "Low Stock", "Pending Requests"]],
    ["REQUESTOR", ["Submitted Requests", "Awaiting Review", "On the Way", "Received"]],
    ["PRC", ["Participating Blood Banks", "Redistributable Supply", "Critical Blood Types", "Open Supply Requests"]],
    ["DOH", ["Monitored Blood Banks", "Fully Compliant", "Reports Due", "Late Submissions"]],
  ] as const)("uses the %s card set", (category, labels) => {
    expect(dashboardSummary(data, principal(category)).map(card => card.label)).toEqual(labels);
  });
  it("uses confirmed inventory only for the blood-bank total", () => {
    expect(dashboardSummary(data, principal("BLOOD_BANK")).map(card => card.value)).toEqual([8, null, null, null]);
    for (const category of ["REQUESTOR", "PRC", "DOH"] as const) {
      expect(dashboardSummary(data, principal(category)).every(card => card.value === null)).toBe(true);
    }
  });
  it("distinguishes missing projection from a confirmed zero", () => {
    expect(dashboardSummary({ ...data, lastSuccessfulProjectionAt: null }, principal("BLOOD_BANK"))[0].value).toBeNull();
    expect(dashboardSummary({ ...data, inventory: [] }, principal("BLOOD_BANK"))[0].value).toBe(0);
  });
});

import { prcSummaryCounts, requesterSummaryCounts } from "./dashboard-summary";
describe("requestor and PRC dashboard card counts", () => {
  const request = { transfer_id: "TRF_1", destination_institution_id: "INST_REQ", blood_type: "O_POSITIVE", component_type: "PACKED_RED_BLOOD_CELLS", quantity: 2, urgency: "ROUTINE", status: "PENDING", ledger_transaction_id: "TX" };
  it("counts only own requests by decision and reservation state", () => {
    const counts = requesterSummaryCounts({ classification: "SIMULATION_ONLY", requests: [
      { ...request, transfer_id: "A", decision_state: "AWAITING_DECISION" },
      { ...request, transfer_id: "B", reservation_id: "RES_B", reservation_status: "IN_TRANSIT", decision_state: "RESERVATION_RECORDED" },
      { ...request, transfer_id: "C", reservation_id: "RES_C", reservation_status: "DELAYED" },
      { ...request, transfer_id: "D", reservation_id: "RES_D", reservation_status: "RECEIVED" },
      { ...request, transfer_id: "E", reservation_id: "RES_E", reservation_status: "ACTIVE" },
      { ...request, transfer_id: "F" },
      { ...request, transfer_id: "G", destination_institution_id: "INST_OTHER", decision_state: "AWAITING_DECISION" },
    ] }, "INST_REQ");
    expect(counts).toEqual({ submitted: 6, awaitingReview: 2, onTheWay: 2, received: 1 });
  });
  it("feeds requestor cards only when the request read is present", () => {
    const requests = { classification: "SIMULATION_ONLY" as const, requests: [{ ...request, decision_state: "AWAITING_DECISION" }] };
    const p = { accountCategory: "REQUESTOR", roleId: "ROLE-03", institutionId: "INST_REQ" } as Principal;
    expect(dashboardSummary(data, p, { requests }).map(card => card.value)).toEqual([1, 1, 0, 0]);
    expect(dashboardSummary(data, p).map(card => card.value)).toEqual([null, null, null, null]);
  });
  const city = (rows: [string, string, string, number][]): Dashboard => ({ composition: "REGULATORY", scope: "CITY_AGGREGATE", pendingScans: [], lastSuccessfulProjectionAt: "2026-11-10T00:00:00Z", classification: "SIMULATION_ONLY",
    inventory: rows.map(([institutionId, bloodType, component, confirmedCount]) => ({ institutionId, institutionDisplayName: institutionId, bloodType, component, inventoryStatus: "AVAILABLE", confirmedCount, lastProjectedAt: "2026-11-10T00:00:00Z" })) });
  it("counts banks, surplus above the adequate band and critical blood types", () => {
    // A+ PRBC bands: critical ≤15, adequate ≤70.
    const counts = prcSummaryCounts(city([["INST_A", "A_POSITIVE", "PACKED_RED_BLOOD_CELLS", 80], ["INST_B", "A_POSITIVE", "PACKED_RED_BLOOD_CELLS", 10], ["INST_B", "O_NEGATIVE", "PACKED_RED_BLOOD_CELLS", 0]]));
    expect(counts).toEqual({ banks: 2, redistributable: 10, criticalBloodTypes: 2 });
  });
  it("keeps PRC cards unavailable without a projection and shows open supply requests when read", () => {
    expect(prcSummaryCounts({ ...city([]), lastSuccessfulProjectionAt: null })).toBeNull();
    const p = { accountCategory: "PRC", roleId: "ROLE-04", institutionId: "INST_PRC" } as Principal;
    expect(dashboardSummary(city([]), p, { openSupplyRequests: 3 }).map(card => card.value)).toEqual([0, 0, 0, 3]);
  });
});
