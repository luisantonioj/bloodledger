import type { Principal } from "../../auth/permissions";
import type { Dashboard } from "../../services/api/types";

export const isRequester = (principal: Principal) => principal.accountCategory
  ? principal.accountCategory === "REQUESTOR" : principal.roleId === "ROLE-03";

export interface RequesterRequest {
  transfer_id: string;
  destination_institution_id: string;
  blood_type: string;
  component_type: string;
  quantity: number;
  urgency: string;
  status: string;
  ledger_transaction_id: string | null;
}
export interface RequesterRequests { requests: RequesterRequest[]; classification: "SIMULATION_ONLY" }

// FR-03 / FR-12: use only the authorized city-wide AVAILABLE projection.
// Available units are not predicted surplus or guaranteed transfer eligibility.
export function networkAvailableUnits(data: Dashboard, bloodType: string, component: string): number | null {
  if (data.scope !== "CITY_AGGREGATE" || data.lastSuccessfulProjectionAt === null) return null;
  const rows = data.inventory.filter(row => row.bloodType === bloodType && row.component === component && row.inventoryStatus === "AVAILABLE");
  if (rows.some(row => !Number.isSafeInteger(row.confirmedCount) || row.confirmedCount < 0)) return null;
  return rows.reduce((total, row) => total + row.confirmedCount, 0);
}

export function ownRequests(data: RequesterRequests, institutionId: string) {
  return data.requests.filter(row => row.destination_institution_id === institutionId);
}
