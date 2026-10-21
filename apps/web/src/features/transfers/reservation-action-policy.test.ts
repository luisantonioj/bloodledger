import { describe, expect, it } from "vitest";
import type { Principal } from "../../auth/permissions";
import type { ReservationDetail } from "../../services/api/v2-navigation";
import { OUTBOUND_CONFIRM_LABEL, reservationActions, reservationSubmitLabel } from "./reservation-action-policy";

describe("Lat MVP handoff: outbound confirmation label (wording only)", () => {
  const idle = { busy: false, ambiguous: false };
  it("labels the dispatch submit as the outbound transaction confirmation", () => expect(reservationSubmitLabel("dispatch", idle)).toBe(OUTBOUND_CONFIRM_LABEL));
  it("keeps the generic label for every other reservation action, including prepare", () => { for (const action of ["prepare", "transit", "receive", "cancel", "delay", "resume", "compromise"] as const) expect(reservationSubmitLabel(action, idle)).toBe("Confirm reservation action"); expect(reservationSubmitLabel(undefined, idle)).toBe("Confirm reservation action"); });
  it("shows pending and same-key retry wording for dispatch", () => { expect(reservationSubmitLabel("dispatch", { busy: true, ambiguous: false })).toBe("Confirming outbound transaction…"); expect(reservationSubmitLabel("dispatch", { busy: false, ambiguous: true })).toBe("Retry same outbound transaction"); expect(reservationSubmitLabel("cancel", { busy: false, ambiguous: true })).toBe("Retry same reservation command"); });
});
const source = { institutionId: "INST_SOURCE", operators: [{roleId: "ROLE-02", actionCapabilities: ["transfer:prepare", "transfer:dispatch", "transfer:transit", "transfer:cancel", "transfer:compromise", "inventory:local-release"]}] } as Principal;
const recipient = { institutionId: "INST_DEST", operators: [{roleId: "ROLE-03", actionCapabilities: ["transfer:receive", "transfer:cancel", "transfer:compromise"]}] } as Principal;
const reservation = {sourceInstitutionId:"INST_SOURCE", destinationInstitutionId:"INST_DEST", purpose:"TRANSFER", status:"ACTIVE", preparedEvidencePresent:false} as ReservationDetail;
describe("FR-05/12 PR35 reservation lifecycle visibility", () => {
  it("preparation keeps ACTIVE; dispatch requires its recorded evidence", () => {
    expect(reservationActions(reservation, source)).toEqual(["prepare", "cancel"]);
    expect(reservationActions({...reservation, preparedEvidencePresent:true}, source)).toEqual(["dispatch", "cancel"]);
  });
  it("local-release records expose no frontend mutations even with capability", () => {
    expect(reservationActions({...reservation, purpose:"LOCAL_RELEASE", preparedEvidencePresent:true}, source)).toEqual([]);
    expect(reservationActions({...reservation, purpose:"LOCAL_RELEASE"}, source)).toEqual([]);
    expect(reservationActions({...reservation, purpose:"LOCAL_RELEASE"}, recipient)).toEqual([]);
  });
  it("transit and receipt follow source and ROLE-03 destination authorization", () => {
    expect(reservationActions({...reservation, status:"DISPATCHED"}, source)).toEqual(["transit", "compromise"]);
    expect(reservationActions({...reservation, status:"IN_TRANSIT"}, recipient)).toEqual(["receive", "compromise"]);
    expect(reservationActions({...reservation, status:"IN_TRANSIT"}, source)).toEqual(["compromise"]);
    expect(reservationActions({...reservation, status:"IN_TRANSIT"}, {...source, institutionId:"INST_DEST"})).toEqual([]);
  });
  it("RECEIVED can only be compromised, with no usable transition", () => {
    expect(reservationActions({...reservation, status:"RECEIVED"}, recipient)).toEqual(["compromise"]);
  });
  it.each(["CANCELLED", "COMPLETED", "COMPROMISED", "UNKNOWN"])("no actions from terminal/unknown %s", status => expect(reservationActions({...reservation, status}, source)).toEqual([]));
  it("fails closed without capabilities or outside scope", () => {
    expect(reservationActions(reservation, {...source, operators:[]})).toEqual([]);
    expect(reservationActions(reservation, {...source, institutionId:"INST_OTHER"})).toEqual([]);
  });
});
