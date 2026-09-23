import { describe, expect, it } from "vitest";
import type { Aggregate } from "../../services/api/types";
import { summarizeInventoryByBloodType } from "./inventory-overview";

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
