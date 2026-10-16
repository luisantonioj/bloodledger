import { describe, expect, it } from "vitest";
import type { Principal } from "../auth/permissions";
import { canonicalPagePath, visibleNavigation } from "./navigation";

function principal(permissions: Principal["permissions"], roleId: Principal["roleId"] = "ROLE-04", institutionId = "INST_TEST", institutionDisplayName = "Synthetic Hospital"): Principal {
  return { userId:"USR_TEST",displayName:"Synthetic User",institutionId,institutionDisplayName,roleId,roleDisplayName:"Synthetic Role",permissions,classification:"SIMULATION_ONLY" };
}

describe("permission-filtered navigation", () => {
  it("always retains the dashboard and exposes only authorized feature links", () => {
    expect(visibleNavigation(principal(["dashboard:regulatory", "consortium:read", "reports:read"])).map((item) => item.href)).toEqual(["/", "/consortium", "/reporting"]);
  });

  it("shows the visual-only accounts route only to administrative compositions", () => {
    expect(visibleNavigation(principal(["profile:read"], "ROLE-05")).map((item) => item.href)).toEqual(["/", "/profile", "/accounts"]);
    expect(visibleNavigation(principal(["profile:read"], "ROLE-01")).map((item) => item.href)).toEqual(["/", "/analytics", "/profile"]);
  });

  it("matches official forecast role access", () => {
    expect(visibleNavigation(principal([], "ROLE-02")).map((item) => item.href)).toEqual(["/", "/analytics"]);
    expect(visibleNavigation(principal([], "ROLE-04", "INST_SYNTH_PRC", "Synthetic PRC Chapter")).map((item) => item.href)).toEqual(["/"]);
    expect(visibleNavigation(principal([], "ROLE-03")).map((item) => item.href)).toEqual(["/", "/analytics"]);
    expect(visibleNavigation(principal([], "ROLE-04", "INST_SYNTH_DOH", "Synthetic DOH Office")).map((item) => item.href)).toEqual(["/"]);
  });
  it("limits blood unit receipt navigation to authorized requester facilities",()=>{
    expect(visibleNavigation(principal(["transfers:read"],"ROLE-03")).some(item=>item.href==="/receipts")).toBe(true);
    for(const role of ["ROLE-01","ROLE-02","ROLE-04","ROLE-05"] as const)expect(visibleNavigation(principal(["transfers:read"],role)).some(item=>item.href==="/receipts")).toBe(false);
    expect(visibleNavigation(principal([],"ROLE-03")).some(item=>item.href==="/receipts")).toBe(false);
  });

  it("keeps unit transactions separate and blood-bank-only",()=>{
    expect(visibleNavigation(principal(["inventory:read"],"ROLE-02")).some(item=>item.href==="/transactions")).toBe(true);
    expect(visibleNavigation({...principal(["inventory:read"],"ROLE-03"),accountCategory:"REQUESTOR"}).some(item=>item.href==="/transactions")).toBe(false);
    expect(visibleNavigation(principal([],"ROLE-02")).some(item=>item.href==="/transactions")).toBe(false);
  });
});

// FR-07: redistribution explanation follows the supplier-only API roles.
it("keeps redistribution out of requester and regulatory navigation",()=>{for(const role of ["ROLE-03","ROLE-04","ROLE-05","ROLE-06"] as const)expect(visibleNavigation(principal([],role)).some(item=>item.href==="/redistribution")).toBe(false);});

it("moves the supplier redistribution deep link to Dashboard",()=>{expect(canonicalPagePath(principal([],"ROLE-02"),"/redistribution")).toBe("/");expect(canonicalPagePath(principal([],"ROLE-03"),"/redistribution")).toBe("/redistribution");});


it("limits the DOH workspace to Dashboard and Profile and folds former tabs into Dashboard",()=>{
 const doh={...principal(["dashboard:regulatory","reports:read","consortium:read","transfers:read","alerts:read","audit:read","profile:read"]),accountId:"ACC_DOH",accountCategory:"DOH" as const};
 expect(visibleNavigation(doh).map(item=>item.href)).toEqual(["/","/profile"]);
 for(const path of ["/reporting","/transfers","/alerts","/audit","/analytics","/consortium"])expect(canonicalPagePath(doh,path)).toBe("/");
 expect(canonicalPagePath(doh,"/profile")).toBe("/profile");
});
