import type { Principal } from "../auth/permissions";

const bloodBankDashboard = "Review your blood stock, facility requests and available network supply. Open Inventory or Blood Unit Transactions to review stock and recorded unit activity, or request blood from another facility where permitted.";
const requesterDashboard = "Check network blood availability and review your facility’s requests. Use Request Blood to start a request, then follow its updates in Requests & Transfers.";
const prcDashboard = "A central view for PRC to review blood-bank stock, reporting and replenishment requests. Use the shortcuts to open account management and alerts.";
const dohDashboard = "An overview for DOH to review facility reporting and compliance alerts. Use the shortcuts to open reports and alerts for follow-up.";

export function pageHelp(path: string, principal: Principal): string | undefined {
  const requester = principal.accountCategory ? principal.accountCategory === "REQUESTOR" : principal.roleId === "ROLE-03";
  if (path === "/transactions") return "Open the mobile capture workspace and review recent blood-unit activity available to your facility. Export a PDF snapshot of the loaded records. Queued commands remain separate from confirmed custody changes.";
  if (path === "/inventory") return "Review the blood components recorded for your facility. Filter by blood type or component, search a record, and open its details. Label expiry and confirmed inventory status are tracked separately.";
  if (path === "/audit") return "Review the activity records available to your account. Filter by activity type or search an action, outcome or reference. History is read-only; pending commands are not confirmed ledger records.";
  if (path === "/analytics") return "Review the available stock and demand analysis, including its scope and freshness. Forecasts support review and do not approve blood requests or transfers.";
  if (path === "/consortium") return "Review the network inventory summaries available to your account. These aggregates show recorded stock, not guaranteed supply or an approved transfer.";
  if (path === "/reporting") return "Review the reports available to your account and their recorded scope. Inventory reports do not by themselves establish regulatory compliance.";
  if (path === "/profile") return "Review your institution’s details, participation status and account information. Authorized administrators can edit supported profile details.";
  if (path === "/accounts") return "Manage authorized operators and institution access. Review roles and status, add administrators, or reset PINs and revoke access where permitted.";
  if (path === "/alerts") return "Review alerts available to your facility. Choose All, Critical, Warnings or Information to filter by severity, then check each alert’s details and status.";
  if (path === "/receipts") return "Review blood received by your facility and open the inbound-only scanner to capture a label. Photo capture is a preview; matching labels and confirming receipt are not connected yet.";
  if (path === "/transfers") return requester
    ? "Create blood requests for your facility and follow their recorded status. Switch between Blood Requests and Transfers, then select a record to view its details."
    : "Review the blood requests and transfer records available to your facility. Select a record to view its details and follow recorded updates.";
  if (path !== "/") return undefined;
  if (principal.accountCategory === "PRC") return prcDashboard;
  if (principal.accountCategory === "DOH") return dohDashboard;
  if (requester) return requesterDashboard;
  if (principal.accountCategory === "BLOOD_BANK" || ["ROLE-01", "ROLE-02"].includes(principal.roleId)) return bloodBankDashboard;
  if (principal.roleId === "ROLE-04") return "Review the network summaries available to your account. Open reports and alerts to explore the recorded information.";
  return "View the workspace available to your account and use the navigation to open your permitted sections.";
}
