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

  it("distinguishes PRC from DOH within the combined regulatory role", () => {
    expect(canViewAnalyticsPreview(principal("ROLE-04", "INST_SYNTH_PRC", "Synthetic PRC Chapter"))).toBe(true);
    expect(canViewAnalyticsPreview(principal("ROLE-04", "INST_SYNTH_DOH", "Synthetic DOH Office"))).toBe(false);
  });

  it("excludes requestor and administrative roles", () => {
    expect(canViewAnalyticsPreview(principal("ROLE-03", "INST_SECONDARY", "Synthetic Requestor"))).toBe(false);
    expect(canViewAnalyticsPreview(principal("ROLE-06", "INST_MEDIATRIX", "Synthetic Blood Bank"))).toBe(false);
  });
});
