import type { Principal } from "../../auth/permissions";
import type { Dashboard } from "../../services/api/types";

export function dashboardSummary(data: Dashboard, principal: Principal) {
  const category = principal.accountCategory ?? (principal.roleId === "ROLE-03" ? "REQUESTOR" : data.composition === "REGULATORY" ? "REGULATORY" : "BLOOD_BANK");
  const labels = category === "REQUESTOR" ? ["Submitted Requests", "Awaiting Review", "On the Way", "Received"]
    : category === "PRC" ? ["Participating Blood Banks", "Redistributable Supply", "Critical Blood Types", "Open Supply Requests"]
      : category === "DOH" ? ["Monitored Blood Banks", "Fully Compliant", "Reports Due", "Late Submissions"]
        : category === "REGULATORY" ? ["Total Blood Units", "Redistributable Supply", "Critical Blood Types", "Open Supply Requests"]
          : ["Total Blood Units", "Expiring Soon", "Low Stock", "Pending Requests"];
  // FR-03 / BL-TST-01: missing summary contracts are unavailable, never sample or inferred values.
  const hasTotal = category === "BLOOD_BANK" || category === "REGULATORY";
  return labels.map((label, index) => ({
    label,
    value: index === 0 && hasTotal && data.lastSuccessfulProjectionAt !== null
      ? data.inventory.reduce((sum, item) => sum + item.confirmedCount, 0) : null,
  }));
}
