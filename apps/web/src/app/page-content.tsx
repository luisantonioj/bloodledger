import { can, composition, type Principal } from "../auth/permissions";
import { FeatureRouter } from "./feature-router";

const pages: Record<string, [string, string, string]> = {
  "/inventory": ["Institution scope", "Inventory", "Ledger-confirmed units and projection state for the authenticated institution."],
  "/transfers": ["Custody workflow", "Transfers", "Authorized requests, dispatch, receipt, and reconciliation evidence."],
  "/alerts": ["Operational attention", "Alerts", "Authorized shortage, expiry, stale-data, and synchronization alerts."],
  "/consortium": ["Approved aggregate", "Network view", "Read-only synthetic city-wide summaries without fabricated peer ownership."],
  "/audit": ["Safe provenance", "Audit", "Permission-scoped events with redacted evidence identifiers."],
  "/reporting": ["Simulation evidence", "Reports", "Approved read-only synthetic summaries and exports."],
  "/profile": ["Session context", "Profile", "Safe principal and institution metadata assigned by the server."],
};

function dashboardPage(principal: Principal): [string, string, string] {
  const view = composition(principal);
  const secondaryHospital = principal.roleId === "ROLE-03";
  return [
    view === "REGULATORY" ? "Regulatory overview" : view === "OPERATIONAL" ? secondaryHospital ? "Secondary-hospital coordination" : "Blood-bank operations" : "Administration",
    "Dashboard",
    view === "REGULATORY"
      ? "Approved aggregate inventory, alerts, transfers, audit summaries, and reports."
      : view === "OPERATIONAL"
        ? secondaryHospital
          ? principal.institutionDisplayName + " requests, transfers, receipts, and alerts with approved city-wide inventory aggregates."
          : principal.institutionDisplayName + " inventory, requests, transfers, and alerts."
        : "Your approved non-clinical workspace.",
  ];
}

export function PageContent({ path, principal }: { path: string; principal: Principal }) {
  const page = path === "/" ? dashboardPage(principal) : pages[path] ?? ["Unavailable", "Page not found", "This route is not part of Sprint 5."];
  return <div className="page"><p className="eyebrow">{page[0]}</p><h1>{page[1]}</h1><p className="subtitle">{page[2]}</p><section className="card"><h2>{page[1]} data</h2><FeatureRouter key={path} path={path} canAcknowledge={can(principal, "alerts:acknowledge")} canSubmitTransfer={principal.roleId === "ROLE-03"} canRejectTransfer={principal.roleId === "ROLE-02"} canCancelTransfer={["ROLE-02", "ROLE-03"].includes(principal.roleId)} canCancelApprovedTransfer={principal.roleId === "ROLE-02"} canDispatchTransfer={["ROLE-01", "ROLE-02"].includes(principal.roleId)} canStartTransit={["ROLE-01", "ROLE-02"].includes(principal.roleId)} canResumeTransfer={["ROLE-01", "ROLE-02"].includes(principal.roleId)} canDelayTransfer={["ROLE-01", "ROLE-02", "ROLE-03"].includes(principal.roleId)} canReceiveTransfer={principal.roleId === "ROLE-03"} canCapture={can(principal, "inventory:write")} principal={principal}/></section></div>;
}
