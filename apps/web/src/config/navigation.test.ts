import { describe, expect, it } from "vitest";
import type { Principal } from "../auth/permissions";
import { visibleNavigation } from "./navigation";

function principal(permissions: Principal["permissions"]): Principal {
  return { userId:"USR_TEST",displayName:"Synthetic User",institutionId:"INST_TEST",institutionDisplayName:"Synthetic Hospital",roleId:"ROLE-04",roleDisplayName:"Regulatory Viewer",permissions,classification:"SIMULATION_ONLY" };
}

describe("permission-filtered navigation", () => {
  it("always retains the dashboard and exposes only authorized feature links", () => {
    expect(visibleNavigation(principal(["dashboard:regulatory", "consortium:read", "reports:read"])).map((item) => item.href)).toEqual(["/", "/consortium", "/reporting"]);
  });
});
