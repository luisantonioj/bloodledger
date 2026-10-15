import type { Principal } from "../auth/permissions";

const bloodBankDashboard = "Review your blood stock, facility requests and available network supply. Open Inventory or Blood Unit Transactions to review stock and recorded unit activity, or request blood from another facility where permitted.";
const requesterDashboard = "Check network blood availability and review your facility’s requests. Use Request Blood to start a request, then follow its updates in Requests & Transfers.";
const prcDashboard = "Review consortium blood availability, reporting and replenishment requests in one place. Choose All or a specific blood component, compare the network total or individual blood banks, and review the availability matrix. Available stock does not establish approved redistributable supply.";
const dohDashboard = "An overview for DOH to review facility reporting and compliance alerts. Use the shortcuts to open reports and alerts for follow-up.";

export function pageHelp(path: string, principal: Principal): string | undefined {
  const requester = principal.accountCategory ? principal.accountCategory === "REQUESTOR" : principal.roleId === "ROLE-03";
  if (path === "/transactions") return "Open the mobile capture workspace and review recent blood-unit activity available to your facility. Export a PDF snapshot of the loaded records. Queued commands remain separate from confirmed custody changes.";
  if (path === "/inventory") return "Review the blood components recorded for your facility. Filter by blood type or component, search a record, and open its details. Label expiry and confirmed inventory status are tracked separately.";
  if (path === "/audit" && requester) return "Review your facility’s permitted request and transfer command activity. Filter or search the loaded records, then export their current view as PDF. Command states remain separate from confirmed ledger outcomes; this is not the general audit log.";
  if (path === "/audit") return "Review the activity records available to your account. Filter by activity type or search an action, outcome or reference. Export PDF includes all matching loaded records and preserves your account’s scope. History is read-only; pending commands are not confirmed ledger records.";
  if (path === "/analytics" && principal.accountCategory === "PRC") return "Network demand history. Review recorded network demand by requesting hospital and month when authorized history is available. Use reporting filters to focus the view. Redistribution assessments require approved backend values; missing history remains unavailable.";
  if (path === "/analytics" && principal.accountCategory === "DOH") return "Reporting and follow-up overview. Filter recorded reporting activity by capture date and facility, and review available follow-up summaries. Captured census records do not establish submission, punctuality, verification or compliance; missing outcomes remain unavailable.";
  if (path === "/analytics" && (principal.accountCategory === "BLOOD_BANK" || !principal.accountCategory && ["ROLE-01", "ROLE-02"].includes(principal.roleId))) return "Understand expected blood demand and estimated excess, one component at a time. Select a component and business date to compare blood types. Forecasts are simulation-only estimates; estimated excess does not approve redistribution. Review recorded stock and actual request history separately below.";
  if (path === "/analytics") return (requester ? "Your facility’s request history. " : "Your blood bank’s supply request history. ") + "Review recorded requests for your facility using date, blood-type and component filters. Compare monthly requested units or request frequency. Department rankings and redistribution assessments remain unavailable until their authorized data is provided; requests do not establish transfusion or receipt quantities.";
  if (path === "/consortium") {
    const consortium = "The consortium is the network of participating hospitals and blood banks that share approved blood-stock summaries.";
    return principal.accountCategory === "PRC" || principal.accountCategory === "DOH" || principal.roleId === "ROLE-04"
      ? consortium + " Use Network view to review the reported inventory across facilities for coordination and oversight. These counts do not establish compliance, guaranteed supply or transfer approval."
      : consortium + " Use Network view to compare reported availability by facility, blood type and component, then start a blood request where permitted. Displayed availability does not reserve units or guarantee approval.";
  }
  if (path === "/reporting" && ["BLOOD_BANK","DOH"].includes(principal.accountCategory??"")) return principal.accountCategory === "BLOOD_BANK" ? "Review your facility’s saved blood stock reports, checkpoint details and captured inventory. Capture, verification and official PDF export remain unavailable in this design preview." : "Review hospital blood stock reports and their captured inventory. This monitoring view is read-only; saved reports do not by themselves establish regulatory compliance.";
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
