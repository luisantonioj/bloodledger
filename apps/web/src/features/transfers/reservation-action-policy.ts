import type { Principal } from "../../auth/permissions";
import type { ReservationDetail } from "../../services/api/v2-navigation";
export const RESERVATION_ACTION_LABELS = { prepare: "Prepare reservation", dispatch: "Dispatch reservation", transit: "Start transit", receive: "Receive reservation", cancel: "Cancel reservation", "local-release-complete": "Complete local release", compromise: "Report compromise", delay: "Record delay", resume: "Resume transfer" } as const;
// Lat MVP handoff: dispatch is the final outbound step, so its submit action
// carries the explicit outbound label. Prepare and dispatch remain separate
// versioned commands; this changes wording only.
export const OUTBOUND_CONFIRM_LABEL = "Confirm outbound transaction";
export function reservationSubmitLabel(action: ReservationAction | undefined, state: { busy: boolean; ambiguous: boolean }): string {
  if (state.busy) return action === "dispatch" ? "Confirming outbound transaction…" : "Submitting command…";
  if (state.ambiguous) return action === "dispatch" ? "Retry same outbound transaction" : "Retry same reservation command";
  return action === "dispatch" ? OUTBOUND_CONFIRM_LABEL : "Confirm reservation action";
}
// TC-T07: staff-recorded delay reasons (coded; no free text).
export const DELAY_REASONS = [["VEHICLE_DELAY", "Vehicle delay"], ["TRAFFIC", "Traffic"], ["WEATHER", "Weather"], ["HANDOVER_PENDING", "Handover pending"], ["OTHER_OPERATIONAL", "Other operational delay"]] as const;
export type ReservationAction = keyof typeof RESERVATION_ACTION_LABELS;
export function reservationActions(row: ReservationDetail, principal: Principal): ReservationAction[] {
  // Local release is retired from the frontend; existing records remain readable.
  if (row.purpose === "LOCAL_RELEASE") return [];
  const source = row.sourceInstitutionId === principal.institutionId;
  const recipient = row.purpose === "TRANSFER" && row.destinationInstitutionId === principal.institutionId;
  const capable = (action: ReservationAction) => principal.operators?.some(operator =>
    operator.actionCapabilities?.includes(action === "local-release-complete" ? "inventory:local-release" : "transfer:" + action) &&
    ((source && ["ROLE-01", "ROLE-02"].includes(operator.roleId) && action !== "receive") || (recipient && operator.roleId === "ROLE-03" && ["receive", "cancel", "compromise", "delay"].includes(action)))) ?? false;
  const candidates: ReservationAction[] = [];
  if (row.status === "ACTIVE") {
    if (!row.preparedEvidencePresent) candidates.push("prepare");
    if (row.preparedEvidencePresent) candidates.push("dispatch");
    candidates.push("cancel");
  }
  if (row.purpose === "TRANSFER" && row.status === "DISPATCHED") candidates.push("transit");
  if (row.purpose === "TRANSFER" && (row.status === "IN_TRANSIT" || row.status === "DELAYED")) candidates.push("receive");
  if (row.purpose === "TRANSFER" && ["DISPATCHED", "IN_TRANSIT"].includes(row.status)) candidates.push("delay");
  if (row.purpose === "TRANSFER" && row.status === "DELAYED") candidates.push("resume");
  if (["DISPATCHED", "IN_TRANSIT", "DELAYED", "RECEIVED"].includes(row.status)) candidates.push("compromise");
  return candidates.filter(capable);
}
