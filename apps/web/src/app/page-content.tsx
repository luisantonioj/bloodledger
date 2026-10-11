import { AuditPage } from "../features/audit/audit-page";
import { BloodUnitTransactionsPage } from "../features/transactions/blood-unit-transactions-page";
import { BloodUnitReceiptPage } from "../features/receipts/blood-unit-receipt-page";
import { RequesterTransfersPage } from "../features/transfers/requester-transfers-page";
import { isRequester } from "../features/dashboard/requester-dashboard-data";
import { can, type Principal } from "../auth/permissions";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { canViewAnalyticsPreview } from "../features/analytics/analytics-access";
import { FeatureRouter } from "./feature-router";

const pages: Record<string, [string, string, string]> = {
  "/inventory": ["Institution scope", "Blood Inventory", "Ledger-confirmed units and projection state for the authenticated institution."],
  "/transfers": ["Custody workflow", "Requests & Transfers", "Authorized requests, dispatch, receipt, and reconciliation evidence."],
  "/alerts": ["Operational attention", "Alerts", "Authorized shortage, expiry, stale-data, and synchronization alerts."],
  "/consortium": ["Approved aggregate", "Network view", "Read-only synthetic city-wide summaries without fabricated peer ownership."],
  "/audit": ["Safe provenance", "Activity History", "Permission-scoped events with redacted evidence identifiers."],
  "/reporting": ["Simulation evidence", "Reports", "Approved read-only synthetic summaries and exports."],
  "/analytics": ["Simulation decision support", "Analytics", "Active V4 and explicit V5 simulation demand forecasts with explicit freshness, uncertainty, provenance, and disabled operational recommendations."],
  "/accounts": ["Account management", "Staff Accounts", "Manage authorized institution operators and access."],
  "/profile": ["Session context", "Profile", "Safe principal and institution metadata assigned by the server."],
};

export function PageContent({ path, principal }: { path: string; principal: Principal }) {
  if (path === "/audit") return <AuditPage principal={principal}/>;
  if (path === "/transactions") return <BloodUnitTransactionsPage principal={principal}/>;
  if (path === "/receipts" && isRequester(principal)) return <BloodUnitReceiptPage principal={principal}/>;
  if (path === "/transfers" && isRequester(principal)) return <RequesterTransfersPage principal={principal}/>;
  if (path === "/") return <DashboardPage principal={principal}/>;
  const page = pages[path] ?? ["Unavailable", "Page not found", "This route is not part of Sprint 5."];

  return <div className="page">
    {!(path === "/accounts" && principal.accountId) && path !== "/inventory" && <header className="page-head"><h1 className="page-title">{page[1]}</h1></header>}
    <section className={"card feature-card" + (principal.accountId && ["/profile","/accounts"].includes(path) ? " institution-management-frame" + (path === "/accounts" ? " institution-staff-frame" : "") : "") + (principal.accountId && ["/inventory","/transfers","/audit"].includes(path) ? " bank-operational-frame" : "")}>
      <FeatureRouter key={path} path={path} canAcknowledge={can(principal, "alerts:acknowledge")} canSubmitTransfer={principal.roleId === "ROLE-03"} canRejectTransfer={principal.roleId === "ROLE-02"} canCancelTransfer={["ROLE-02", "ROLE-03"].includes(principal.roleId)} canCancelApprovedTransfer={principal.roleId === "ROLE-02"} canDispatchTransfer={["ROLE-01", "ROLE-02"].includes(principal.roleId)} canStartTransit={["ROLE-01", "ROLE-02"].includes(principal.roleId)} canResumeTransfer={["ROLE-01", "ROLE-02"].includes(principal.roleId)} canDelayTransfer={["ROLE-01", "ROLE-02", "ROLE-03"].includes(principal.roleId)} canReceiveTransfer={principal.roleId === "ROLE-03"} canCapture={can(principal, "inventory:write")} canPreviewInventoryExport={["ROLE-01", "ROLE-02"].includes(principal.roleId)} canPreviewTransferExport={["ROLE-01", "ROLE-02", "ROLE-03"].includes(principal.roleId) || canViewAnalyticsPreview(principal)} principal={principal}/>
    </section>
  </div>;
}
