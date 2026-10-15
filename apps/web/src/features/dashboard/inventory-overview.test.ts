import { describe, expect, it } from "vitest";
import type { Aggregate } from "../../services/api/types";
import { inventoryOverviewComponents, summarizeInventoryByComponent, summarizeInventoryByBloodType } from "./inventory-overview";

const projectedAt = "2026-09-17T00:00:00.000Z";
const aggregate = (
  bloodType: string,
  inventoryStatus: string,
  confirmedCount: number,
): Aggregate => ({
  institutionId: "INST_SYNTH_TEST",
  institutionDisplayName: "Synthetic Test Hospital",
  bloodType,
  component: "RED_BLOOD_CELLS",
  inventoryStatus,
  confirmedCount,
  lastProjectedAt: projectedAt,
});

describe("summarizeInventoryByBloodType", () => {
  it("groups components and statuses without treating non-available units as available", () => {
    const result = summarizeInventoryByBloodType([
      aggregate("A_POSITIVE", "AVAILABLE", 4),
      aggregate("A_POSITIVE", "RESERVED", 2),
      { ...aggregate("A_POSITIVE", "AVAILABLE", 3), component: "PLATELETS" },
      aggregate("O_NEGATIVE", "IN_TRANSIT", 1),
    ]);

    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({ bloodType: "A_POSITIVE", confirmed: 9, available: 7 });
    expect(result[7]).toEqual({ bloodType: "O_NEGATIVE", confirmed: 1, available: 0 });
  });

  it("keeps the eight standard blood types and appends unknown codes deterministically", () => {
    const result = summarizeInventoryByBloodType([
      aggregate("SYNTHETIC_UNKNOWN_Z", "AVAILABLE", 2),
      aggregate("SYNTHETIC_UNKNOWN_A", "AVAILABLE", 1),
    ]);

    expect(result.slice(0, 8).every((item) => item.confirmed === 0)).toBe(true);
    expect(result.slice(8).map((item) => item.bloodType)).toEqual([
      "SYNTHETIC_UNKNOWN_A",
      "SYNTHETIC_UNKNOWN_Z",
    ]);
  });
});

// FR-03/04 / TP-08: component isolation, boundary zeros and no inferred stock status.
describe("inventory overview component filter", () => {
  const rows = [
    { ...aggregate("A_POSITIVE", "AVAILABLE", 9), component: "PACKED_RED_BLOOD_CELLS" },
    { ...aggregate("A_POSITIVE", "RESERVED", 2), component: "PACKED_RED_BLOOD_CELLS" },
    { ...aggregate("A_POSITIVE", "AVAILABLE", 4), component: "FRESH_FROZEN_PLASMA" },
    { ...aggregate("B_POSITIVE", "AVAILABLE", 7), component: "CRYOPRECIPITATE" },
  ];

  it("All preserves adjacent component counts rather than merging products", () => {
    const result = summarizeInventoryByComponent(rows, "ALL");
    expect(result).toHaveLength(8);
    expect(result[0].components).toContainEqual({ component: "PACKED_RED_BLOOD_CELLS", confirmed: 11, available: 9 });
    expect(result[0].components).toContainEqual({ component: "FRESH_FROZEN_PLASMA", confirmed: 4, available: 4 });
    expect(result[0].components.find(item => item.component === "CRYOPRECIPITATE")?.confirmed).toBe(0);
    expect(result.flatMap(group => group.components).reduce((total, item) => total + item.confirmed, 0)).toBe(22);
  });

  it("filters a product without leaking another product or reserved units into availability", () => {
    const result = summarizeInventoryByComponent(rows, "PACKED_RED_BLOOD_CELLS");
    expect(result[0].components).toEqual([{ component: "PACKED_RED_BLOOD_CELLS", confirmed: 11, available: 9 }]);
    expect(result[2].components[0].confirmed).toBe(0);
    expect(summarizeInventoryByComponent(rows, "PLATELETS").every(group => group.components[0].confirmed === 0)).toBe(true);
  });

  it("retains older component codes separately and orders additional codes deterministically", () => {
    const items = [...rows, aggregate("A_POSITIVE", "AVAILABLE", 3), { ...rows[0], component: "SYNTHETIC_OTHER" }];
    expect(inventoryOverviewComponents(items).slice(-2)).toEqual(["RED_BLOOD_CELLS", "SYNTHETIC_OTHER"]);
    const result = summarizeInventoryByComponent(items, "ALL");
    expect(result[0].components.find(item => item.component === "RED_BLOOD_CELLS")?.confirmed).toBe(3);
    expect(result[0].components.find(item => item.component === "PACKED_RED_BLOOD_CELLS")?.confirmed).toBe(11);
  });
});
