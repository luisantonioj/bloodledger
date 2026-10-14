// FR-03/12: hospital network views use approved aggregates, without fabricated zeros.
import { describe, expect, it } from "vitest";
import type { Consortium } from "../../services/api/types";
import { hospitalNetworkRows, networkAvailable } from "./hospital-network-view";
const base: Consortium = { scope: "CITY_AGGREGATE", classification: "SIMULATION_ONLY", inventory: [], alerts: [], transferSummary: [], lastSuccessfulProjectionAt: "2026-10-11T12:00:00Z" };
const row = { institutionId: "INST_SAMPLE", institutionDisplayName: "Sample facility", bloodType: "O_POSITIVE", component: "PACKED_RED_BLOOD_CELLS", inventoryStatus: "AVAILABLE", confirmedCount: 0, lastProjectedAt: "2026-10-11T12:00:00Z" };
describe("hospital network aggregates", () => {
  it("keeps explicit zero separate from an absent reserved count", () => {
    const [result] = hospitalNetworkRows({ ...base, inventory: [row] });
    expect(result.available).toBe(0); expect(result.reserved).toBeNull();
  });
  it("groups by facility and product, retaining the oldest update", () => {
    const result = hospitalNetworkRows({ ...base, inventory: [ { ...row, confirmedCount: 5 }, { ...row, inventoryStatus: "RESERVED", confirmedCount: 2, lastProjectedAt: "2026-10-10T12:00:00Z" }, { ...row, institutionId: "INST_OTHER", confirmedCount: 3 } ] });
    expect(result).toHaveLength(2); expect(result[0].available).toBe(5); expect(result[0].reserved).toBe(2); expect(result[0].updatedAt).toBe("2026-10-10T12:00:00Z");
  });
  it("rejects institution-only data presented as network data", () => {
    expect(() => hospitalNetworkRows({ ...base, scope: "INSTITUTION" } as unknown as Consortium)).toThrow(/scope/);
  });
  it("rejects invalid counts and leaves a missing facility absent", () => {
    expect(() => hospitalNetworkRows({ ...base, inventory: [{ ...row, confirmedCount: -1 }] })).toThrow(/incomplete/);
    expect(hospitalNetworkRows(base)).toEqual([]);
  });
});

// FR-03: charts must distinguish missing network coverage from verified fixture zeros.
describe("network chart totals", () => {
  it("sums reported available units and retains explicit zeros", () => {
    const rows = hospitalNetworkRows({ ...base, inventory: [{ ...row, confirmedCount: 5 }, { ...row, institutionId: "INST_OTHER", confirmedCount: 0 }] });
    expect(networkAvailable(rows, "O_POSITIVE")).toBe(5);
    expect(networkAvailable(rows, "B_NEGATIVE")).toBeNull();
    expect(networkAvailable(rows, "O_POSITIVE", 3)).toBeNull();
  });
  it("does not report a complete total when a participating facility has no type report", () => {
    const rows = hospitalNetworkRows({ ...base, inventory: [row, { ...row, institutionId: "INST_OTHER", bloodType: "B_POSITIVE", confirmedCount: 4 }] });
    expect(networkAvailable(rows, "O_POSITIVE")).toBeNull();
  });
});
