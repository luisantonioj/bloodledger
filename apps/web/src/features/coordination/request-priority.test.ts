import { describe, expect, it } from "vitest";
import type { RpsPriorityView } from "../../services/api/coordination";
import { priorityByTransfer, prioritySeries } from "./request-priority";

const view = (status: RpsPriorityView["status"], ids: string[]): RpsPriorityView => ({
  schemaVersion: "RPS_PRIORITY_VIEW_V1", institutionId: "INST_MMMC", bloodType: "O_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", status, unavailableReason: null,
  policyVersion: "SYNTHETIC_OPTIMIZATION_V1", weights: { urgency: 0.7, wait: 0.3, waitCapHours: 24 }, evaluationTime: "2026-10-19T00:00:00Z", runId: "RUN_1", inputSha256: null,
  ranked: ids.map((transferId, index) => ({ rank: index + 1, transferId, destinationInstitutionId: "INST_NLV", quantity: 1, urgency: "URGENT", requestTime: "2026-10-18T00:00:00Z", waitHours: 2, urgencyContribution: 0.5, waitContribution: 0.1, score: 0.6 - index / 10 })),
  classification: "SIMULATION_ONLY", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY"
});

describe("request priority (FR-06, TC-T01/TC-T02)", () => {
  it("ranks only the supplier's own request series, deduplicated and sorted", () => {
    const rows = [
      { transfer_id: "T1", source_institution_id: "INST_MMMC", blood_type: "O_POSITIVE", component_type: "PLATELETS" },
      { transfer_id: "T2", source_institution_id: "INST_MMMC", blood_type: "A_POSITIVE", component_type: "PLATELETS" },
      { transfer_id: "T3", source_institution_id: "INST_MMMC", blood_type: "O_POSITIVE", component_type: "PLATELETS" },
      { transfer_id: "T4", source_institution_id: "INST_NLV", blood_type: "B_POSITIVE", component_type: "PLATELETS" }
    ];
    expect(prioritySeries(rows, "INST_MMMC")).toEqual(["A_POSITIVE|PLATELETS", "O_POSITIVE|PLATELETS"]);
  });
  it("maps ranks with group size and ignores unavailable views", () => {
    const map = priorityByTransfer([view("AVAILABLE", ["T1", "T2"]), view("UNAVAILABLE", ["T9"])]);
    expect(map.get("T2")).toMatchObject({ rank: 2, groupSize: 2, runId: "RUN_1" });
    expect(map.has("T9")).toBe(false);
  });
});
