import type { Principal } from "../../auth/permissions";
import type { ReservationDetail } from "../../services/api/v2-navigation";
export const RESERVATION_ACTION_LABELS = { prepare: "Prepare reservation", dispatch: "Dispatch reservation", transit: "Start transit", receive: "Receive reservation", cancel: "Cancel reservation", "local-release-complete": "Complete local release", compromise: "Report compromise" } as const;
export type ReservationAction = keyof typeof RESERVATION_ACTION_LABELS;
export function reservationActions(row: ReservationDetail, principal: Principal): ReservationAction[] {
  const source = row.sourceInstitutionId === principal.institutionId;
  const recipient = row.purpose === "TRANSFER" && row.destinationInstitutionId === principal.institutionId;
  const capable = (action: ReservationAction) => principal.operators?.some(operator =>
    operator.actionCapabilities?.includes(action === "local-release-complete" ? "inventory:local-release" : "transfer:" + action) &&
    ((source && ["ROLE-01", "ROLE-02"].includes(operator.roleId) && action !== "receive") || (recipient && operator.roleId === "ROLE-03" && ["receive", "cancel", "compromise"].includes(action)))) ?? false;
  const candidates: ReservationAction[] = [];
  if (row.status === "ACTIVE") {
    if (!row.preparedEvidencePresent) candidates.push("prepare");
    if (row.preparedEvidencePresent) candidates.push(row.purpose === "LOCAL_RELEASE" ? "local-release-complete" : "dispatch");
    candidates.push("cancel");
  }
  if (row.purpose === "TRANSFER" && row.status === "DISPATCHED") candidates.push("transit");
  if (row.purpose === "TRANSFER" && row.status === "IN_TRANSIT") candidates.push("receive");
  if (["DISPATCHED", "IN_TRANSIT", "RECEIVED"].includes(row.status)) candidates.push("compromise");
  return candidates.filter(capable);
}
