import { describe, expect, it } from "vitest";
import { readDocumentFile } from "../../services/api/request-details";
import { EMPTY_REQUESTER_FIELDS, requesterDetails } from "./requester-request-fields";
import { syntheticRequestFields } from "./synthetic-request-fill";

const now = Date.parse("2026-10-20T02:00:00.000Z");
describe("synthetic request Fill Up", () => {
  it("generates valid synthetic details and real PDF attachments without supply fields", async () => {
    const fields = syntheticRequestFields(EMPTY_REQUESTER_FIELDS, now);
    const mapped = requesterDetails(fields, now);
    expect(mapped.problem).toBeUndefined();
    expect(Date.parse(mapped.details!.requiredAt)).toBeGreaterThan(now + 47 * 3_600_000);
    expect(fields.staffId).toMatch(/^SYN-STAFF-\d{4}$/);
    expect(fields.pickupAuthorizationReference).toMatch(/^SYN-AUTH-[A-F0-9]{6}$/);
    for (const key of ["sourceInstitutionId", "bloodType", "componentType", "quantity", "urgency", "patientCaseReference"]) expect(fields).not.toHaveProperty(key);
    for (const kind of ["REQUEST_FORM", "PICKUP_AUTHORIZATION"] as const) {
      const file = fields.files[kind]!;
      expect(file.type).toBe("application/pdf");
      const text = await file.text();
      expect(text).toMatch(/^%PDF-1\.4/);expect(text).toContain("SIMULATION_ONLY");expect(text).toContain("%%EOF");
      expect(await readDocumentFile(kind, file)).toMatchObject({ kind, contentType: "application/pdf", fileName: file.name });
      const offset = Number(text.match(/startxref\n(\d+)/)![1]);expect(text.slice(offset)).toMatch(/^xref\n/);
    }
  });
  it("refreshes every lower-section value and replaces attachments on repeated clicks without mutating the previous draft", () => {
    const first = syntheticRequestFields(EMPTY_REQUESTER_FIELDS, now);
    const before = { ...first, files: { ...first.files } };
    const second = syntheticRequestFields(first, now);
    for (const key of ["requestingPerson", "staffId", "attendingPhysician", "requiredLocal", "pickupRepresentative", "pickupAuthorizationReference", "notes"] as const) expect(second[key]).not.toBe(first[key]);
    expect(second.files.REQUEST_FORM!.name).not.toBe(first.files.REQUEST_FORM!.name);
    expect(second.files.PICKUP_AUTHORIZATION!.name).not.toBe(first.files.PICKUP_AUTHORIZATION!.name);
    expect(first).toEqual(before);
  });
});
