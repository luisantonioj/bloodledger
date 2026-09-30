import { describe, expect, it } from "vitest";
import type { Principal } from "../../auth/permissions";
import { canViewAnalyticsPreview } from "./analytics-access";

const principal = (roleId: Principal["roleId"], institutionId: string, institutionDisplayName: string): Principal => ({
  userId: "USR_SYNTH_ANALYTICS",
  displayName: "Synthetic Analytics User",
  institutionId,
  institutionDisplayName,
  roleId,
  roleDisplayName: "Synthetic Role",
  permissions: [],
  classification: "SIMULATION_ONLY",
});

describe("analytics preview access", () => {
  it("allows blood-bank operational roles", () => {
    expect(canViewAnalyticsPreview(principal("ROLE-01", "INST_MEDIATRIX", "Synthetic Blood Bank"))).toBe(true);
    expect(canViewAnalyticsPreview(principal("ROLE-02", "INST_MEDIATRIX", "Synthetic Blood Bank"))).toBe(true);
  });

  it("matches the official six-role forecast matrix regardless of institution name", () => {
    for (const roleId of ["ROLE-01", "ROLE-02", "ROLE-03", "ROLE-04", "ROLE-05", "ROLE-06"] as const) {
      expect(canViewAnalyticsPreview(principal(roleId, "INST_SYNTH_PRC", "Synthetic PRC Chapter"))).toBe(["ROLE-01", "ROLE-02", "ROLE-03"].includes(roleId));
    }
  });
});
