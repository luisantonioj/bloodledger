// PA-REQ-01..04: form text maps to the accepted contract with synthetic formats only.
import { describe, expect, it } from "vitest";
import { EMPTY_REQUESTER_FIELDS, requesterDetails } from "./requester-request-fields";
import { manilaLocalToUtc, operatorBoundPayload, utcToManilaLocal } from "../../services/api/request-details";

const now = Date.parse("2026-10-20T02:00:00.000Z");
const filled = { ...EMPTY_REQUESTER_FIELDS, requestingPerson: " Synthetic Requester A ", requiredLocal: "2026-10-21T10:00" };

describe("requesterDetails", () => {
  it("trims values, converts Manila wall time to UTC and sends blanks as null", () => {
    expect(requesterDetails(filled, now).details).toEqual({ requestingPerson: "Synthetic Requester A", staffId: null, attendingPhysician: null, requiredAt: "2026-10-21T02:00:00.000Z", pickupRepresentative: null, pickupAuthorizationReference: null, notes: null });
  });
  it("reports missing, past and real-format values instead of submitting them", () => {
    expect(requesterDetails({ ...filled, requestingPerson: "" }, now).problem).toMatch(/requesting person/);
    expect(requesterDetails({ ...filled, requiredLocal: "2026-10-20T09:00" }, now).problem).toMatch(/future/);
    expect(requesterDetails({ ...filled, staffId: "EMP-12345" }, now).problem).toMatch(/SYN-STAFF/);
    expect(requesterDetails({ ...filled, pickupAuthorizationReference: "ID 1234" }, now).problem).toMatch(/SYN-AUTH/);
  });
});

describe("request detail helpers", () => {
  it("round-trips Manila datetime-local values", () => {
    expect(manilaLocalToUtc("2026-10-21T00:30")).toBe("2026-10-20T16:30:00.000Z");
    expect(utcToManilaLocal("2026-10-20T16:30:00.000Z")).toBe("2026-10-21T00:30");
    expect(manilaLocalToUtc("not a date")).toBeUndefined();
  });
  it("binds document metadata for operator verification without the bytes", () => {
    expect(operatorBoundPayload({ details: {}, documents: [{ kind: "REQUEST_FORM", contentSha256: "a", contentBase64: "QQ==" }] })).toEqual({ details: {}, documents: [{ kind: "REQUEST_FORM", contentSha256: "a" }] });
  });
});
