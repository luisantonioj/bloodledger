import { describe, expect, it } from "vitest";
import type { Principal } from "../../auth/permissions";
import type { ReservationDetail } from "../../services/api/v2-navigation";
import { reservationActions } from "./reservation-action-policy";
const source = { institutionId: "INST_SOURCE", operators: [{roleId: "ROLE-02", actionCapabilities: ["transfer:prepare", "transfer:dispatch", "transfer:transit", "transfer:cancel", "transfer:compromise", "inventory:local-release"]}] } as Principal;
const recipient = { institutionId: "INST_DEST", operators: [{roleId: "ROLE-03", actionCapabilities: ["transfer:receive", "transfer:cancel", "transfer:compromise"]}] } as Principal;
const reservation = {sourceInstitutionId:"INST_SOURCE", destinationInstitutionId:"INST_DEST", purpose:"TRANSFER", status:"ACTIVE", preparedEvidencePresent:false} as ReservationDetail;
describe("FR-05/12 PR35 reservation lifecycle visibility", () => {
  it("preparation keeps ACTIVE; dispatch requires its recorded evidence", () => {
    expect(reservationActions(reservation, source)).toEqual(["prepare", "cancel"]);
    expect(reservationActions({...reservation, preparedEvidencePresent:true}, source)).toEqual(["dispatch", "cancel"]);
  });
  it("local release completes only from prepared ACTIVE and never dispatches", () => {
    expect(reservationActions({...reservation, purpose:"LOCAL_RELEASE", preparedEvidencePresent:true}, source)).toEqual(["local-release-complete", "cancel"]);
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
