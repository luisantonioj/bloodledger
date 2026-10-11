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
