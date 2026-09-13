import { describe, expect, it } from "vitest";
import type { Principal } from "../auth/permissions";
import { visibleNavigation } from "./navigation";

function principal(permissions: Principal["permissions"], roleId: Principal["roleId"] = "ROLE-04"): Principal {
  return { userId:"USR_TEST",displayName:"Synthetic User",institutionId:"INST_TEST",institutionDisplayName:"Synthetic Hospital",roleId,roleDisplayName:"Synthetic Role",permissions,classification:"SIMULATION_ONLY" };
}

describe("permission-filtered navigation", () => {
  it("always retains the dashboard and exposes only authorized feature links", () => {
    expect(visibleNavigation(principal(["dashboard:regulatory", "consortium:read", "reports:read"])).map((item) => item.href)).toEqual(["/", "/consortium", "/reporting"]);
  });

  it("shows the visual-only accounts route only to administrative compositions", () => {
    expect(visibleNavigation(principal(["profile:read"], "ROLE-05")).map((item) => item.href)).toEqual(["/", "/accounts", "/profile"]);
    expect(visibleNavigation(principal(["profile:read"], "ROLE-01")).map((item) => item.href)).toEqual(["/", "/profile"]);
  });
});
