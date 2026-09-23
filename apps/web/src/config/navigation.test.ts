import { describe, expect, it } from "vitest";
import type { Principal } from "../auth/permissions";
import { visibleNavigation } from "./navigation";

function principal(permissions: Principal["permissions"], roleId: Principal["roleId"] = "ROLE-04", institutionId = "INST_TEST", institutionDisplayName = "Synthetic Hospital"): Principal {
  return { userId:"USR_TEST",displayName:"Synthetic User",institutionId,institutionDisplayName,roleId,roleDisplayName:"Synthetic Role",permissions,classification:"SIMULATION_ONLY" };
}

describe("permission-filtered navigation", () => {
  it("always retains the dashboard and exposes only authorized feature links", () => {
    expect(visibleNavigation(principal(["dashboard:regulatory", "consortium:read", "reports:read"])).map((item) => item.href)).toEqual(["/", "/consortium", "/reporting"]);
  });

  it("shows the visual-only accounts route only to administrative compositions", () => {
    expect(visibleNavigation(principal(["profile:read"], "ROLE-05")).map((item) => item.href)).toEqual(["/", "/accounts", "/profile"]);
    expect(visibleNavigation(principal(["profile:read"], "ROLE-01")).map((item) => item.href)).toEqual(["/", "/analytics", "/profile"]);
  });

  it("shows analytics only to authorized blood-bank roles", () => {
    expect(visibleNavigation(principal([], "ROLE-02")).map((item) => item.href)).toEqual(["/", "/analytics"]);
    expect(visibleNavigation(principal([], "ROLE-04", "INST_SYNTH_PRC", "Synthetic PRC Chapter")).map((item) => item.href)).toEqual(["/"]);
    expect(visibleNavigation(principal([], "ROLE-04", "INST_SYNTH_DOH", "Synthetic DOH Office")).map((item) => item.href)).toEqual(["/"]);
    expect(visibleNavigation(principal([], "ROLE-03")).map((item) => item.href)).toEqual(["/"]);
  });
});
