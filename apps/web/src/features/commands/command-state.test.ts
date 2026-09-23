import { describe, expect, it } from "vitest";
import { V2_COMMAND_STATUSES } from "../../services/api/v2";
import { COMMAND_PRESENTATION } from "./command-state";

describe("Sprint 6 command presentation", () => {
  it("defines readable, non-color-only text for all seven backend states", () => {
    expect(Object.keys(COMMAND_PRESENTATION).sort()).toEqual([...V2_COMMAND_STATUSES].sort());
    for (const status of V2_COMMAND_STATUSES) {
      expect(COMMAND_PRESENTATION[status].label.length).toBeGreaterThan(3);
      expect(COMMAND_PRESENTATION[status].detail.length).toBeGreaterThan(12);
    }
  });

  it("stops only on committed, failed, and conflict", () => {
    expect(V2_COMMAND_STATUSES.filter((status) => COMMAND_PRESENTATION[status].terminal))
      .toEqual(["COMMITTED", "FAILED", "CONFLICT"]);
  });
});
