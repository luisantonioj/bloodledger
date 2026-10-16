// PA-ACCOUNT-03 / ADR-048 SYNTHETIC_PUBLIC_APPLICATION_V1 unit checks. Synthetic catalog only.
import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { ApiFailure } from "../src/errors.js";
import { allowedOperatorAction } from "../src/operator-verification.js";
import { PublicOnboarding, publicApplicationPolicy, sampleLoginEmail, validatePublicApplication, documentFixture } from "../src/public-onboarding.js";

type Row = Record<string, unknown>;
const now = new Date("2026-10-16T02:00:00.000Z");
function fakePool(claims: Row[] = []): Pool { return { query: async () => ({ rows: claims }) } as unknown as Pool; }
const code = (fn: () => unknown) => { try { fn(); } catch (error) { assert.ok(error instanceof ApiFailure); return error; } assert.fail("expected ApiFailure"); };
async function filled(category: "BLOOD_BANK" | "REQUESTOR", claims: Row[] = [], exclude?: string) { return new PublicOnboarding(fakePool(claims)).select(category, exclude, now) as Promise<Row & { fill: Row; sample: Row }>; }
/** What the wizard sends after Fill Up plus the applicant's own password and deliberate attestations. */
function submission(selection: Row & { fill: Row; sample: Row }): Row {
  const fill = structuredClone(selection.fill) as Record<string, Row>;
  return { schemaVersion: "PUBLIC_APPLICATION_V1", category: fill.category, sample: selection.sample, facility: fill.facility,
    qualification: { ...fill.qualification, capabilityDeclarations: { proceduresDocumented: true, personnelEquipmentContinuity: true, verificationConsent: true } },
    primaryAccount: { ...fill.primaryAccount, password: "synthetic-applicant-password-1" }, documents: fill.documents,
    declaration: { syntheticDataOnly: true, accuracyAttested: true }, correlationId: "CORR_" + "A".repeat(32) };
}

test("ADR-048 catalog has five unique synthetic facilities per category with stable IDs", () => {
  assert.equal(publicApplicationPolicy.catalogVersion, "SYNTHETIC_FACILITY_CATALOG_V1");
  for (const [category, prefix] of [["BLOOD_BANK", "SAMPLE_BANK_"], ["REQUESTOR", "SAMPLE_REQUESTOR_"]] as const) {
    const ids = publicApplicationPolicy.samples.filter(s => s.category === category).map(s => s.sampleId);
    assert.deepEqual(ids, [1, 2, 3, 4, 5].map(n => `${prefix}0${n}`));
  }
  for (const key of ["displayName", "legalName", "officialEmail", "facilityLicenseReference"] as const) assert.equal(new Set(publicApplicationPolicy.samples.map(s => s.facility[key])).size, 10);
  for (const sample of publicApplicationPolicy.samples) assert.match(sample.facility.displayName, /^Synthetic /);
});

test("ADR-048 every sample fills all four steps consistently and validates once attested", async () => {
  for (const sample of publicApplicationPolicy.samples) {
    const others = publicApplicationPolicy.samples.filter(s => s.category === sample.category && s.sampleId !== sample.sampleId)
      .map(s => ({ sample_id: s.sampleId, instances: 1, active: true, registered: true }));
    const selection = await filled(sample.category, others);
    assert.equal((selection.sample as Row).sampleId, sample.sampleId);
    const fill = selection.fill as Record<string, Row>;
    assert.deepEqual(Object.keys(fill).sort(), ["category", "documents", "facility", "primaryAccount", "qualification"]);
    assert.equal(fill.primaryAccount!.requestedLoginEmail, sampleLoginEmail(sample, 1));
    assert.equal("password" in fill.primaryAccount!, false);
    assert.equal("capabilityDeclarations" in fill.qualification!, false);
    assert.equal("declaration" in fill, false);
    const valid = validatePublicApplication(submission(selection), now);
    assert.equal(valid.category, sample.category);
    assert.equal(JSON.stringify(valid.detail).includes("synthetic-applicant-password-1"), false);
  }
});

test("ADR-048 selection randomizes among eligible samples and never returns claimed ones", async () => {
  const claimed = [{ sample_id: "SAMPLE_BANK_01", instances: 1, active: true, registered: true }, { sample_id: "SAMPLE_BANK_02", instances: 1, active: true, registered: false }];
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) seen.add(String(((await filled("BLOOD_BANK", claimed, "SAMPLE_BANK_03")).sample as Row).sampleId));
  assert.deepEqual([...seen].sort(), ["SAMPLE_BANK_04", "SAMPLE_BANK_05"]);
  const catalog = await new PublicOnboarding(fakePool(claimed)).catalog("BLOOD_BANK") as { samples: Row[]; eligibleCount: number };
  assert.deepEqual(catalog.samples.map(s => s.availability), ["REGISTERED", "APPLICATION_IN_PROGRESS", "ELIGIBLE", "ELIGIBLE", "ELIGIBLE"]);
  assert.equal(catalog.eligibleCount, 3);
  assert.equal(JSON.stringify(catalog).includes("@"), false);
});

test("ADR-048 exhausted pool is explicit and released samples return with a new instance", async () => {
  const all = publicApplicationPolicy.samples.filter(s => s.category === "REQUESTOR").map(s => ({ sample_id: s.sampleId, instances: 1, active: true, registered: false }));
  const exhausted = await filled("REQUESTOR", all);
  assert.equal(exhausted.status, "EXHAUSTED"); assert.equal(exhausted.sample, null); assert.equal(exhausted.eligibleCount, 0);
  const released = all.map((row, index) => index === 2 ? { ...row, instances: 1, active: false } : row);
  const again = await filled("REQUESTOR", released, "SAMPLE_REQUESTOR_03");
  assert.equal((again.sample as Row).sampleId, "SAMPLE_REQUESTOR_03"); assert.equal(again.repeated, true);
  assert.equal((again.sample as Row).instance, 2);
  assert.equal(((again.fill as Record<string, Row>).primaryAccount!).requestedLoginEmail, "facility@sreq03-i2.bloodledger");
  await assert.rejects(new PublicOnboarding(fakePool()).select("PRC", undefined, now), (e: ApiFailure) => e.code === "ONB_CATEGORY_UNSUPPORTED");
});

test("ADR-048 strict validation rejects unknown, missing and unsupported values with safe details", async () => {
  const base = submission(await filled("BLOOD_BANK"));
  assert.equal(code(() => validatePublicApplication({ ...base, category: "DOH" }, now)).code, "ONB_CATEGORY_UNSUPPORTED");
  assert.equal(code(() => validatePublicApplication({ ...base, schemaVersion: "INVITATION_V1" }, now)).code, "ONB_SCHEMA_UNSUPPORTED");
  const extra = code(() => validatePublicApplication({ ...base, invitationSecret: "a".repeat(64), facility: { ...(base.facility as Row), notes: "x" } }, now));
  assert.equal(extra.code, "ONB_APPLICATION_INVALID");
  assert.deepEqual(extra.details?.map(d => d.field).sort(), ["facility.notes", "invitationSecret"]);
  const requestorKey = code(() => validatePublicApplication({ ...base, qualification: { ...(base.qualification as Row), referralFacilityName: "Synthetic Other" } }, now));
  assert.deepEqual(requestorKey.details, [{ field: "qualification.referralFacilityName", rule: "UNSUPPORTED_FIELD" }]);
  const personal = code(() => validatePublicApplication({ ...base, sample: null, primaryAccount: { ...(base.primaryAccount as Row), applicantReference: "Juan Dela Cruz" } }, now));
  assert.equal(personal.details?.[0]?.field, "primaryAccount.applicantReference");
  const unattested = code(() => validatePublicApplication({ ...base, declaration: { syntheticDataOnly: true, accuracyAttested: false } }, now));
  assert.deepEqual(unattested.details, [{ field: "declaration.accuracyAttested", rule: "MUST_BE_TRUE" }]);
  const capability = code(() => validatePublicApplication({ ...base, qualification: { ...(base.qualification as Row), capabilityDeclarations: { proceduresDocumented: true, personnelEquipmentContinuity: false, verificationConsent: true } } }, now));
  assert.equal(capability.details?.[0]?.rule, "MUST_BE_TRUE");
  const expired = code(() => validatePublicApplication({ ...base, facility: { ...(base.facility as Row), facilityLicenseExpiresOn: "2026-10-16" } }, now));
  assert.deepEqual(expired.details, [{ field: "facility.facilityLicenseExpiresOn", rule: "EXPIRED" }]);
  const missingDocument = code(() => validatePublicApplication({ ...base, documents: (base.documents as Row[]).slice(1) }, now));
  assert.deepEqual(missingDocument.details, [{ field: "documents.HEALTH_FACILITY_LTO", rule: "REQUIRED" }]);
  const uploaded = code(() => validatePublicApplication({ ...base, documents: [{ slot: "HEALTH_FACILITY_LTO", fixtureId: "data:application/pdf;base64,AAAA" }, ...(base.documents as Row[]).slice(1)] }, now));
  assert.equal(uploaded.details?.[0]?.rule, "FIXTURE_REQUIRED");
  const shortPassword = code(() => validatePublicApplication({ ...base, primaryAccount: { ...(base.primaryAccount as Row), password: "short" } }, now));
  assert.equal(JSON.stringify(shortPassword.details).includes("short"), false);
  const domain = code(() => validatePublicApplication({ ...base, sample: null, facility: { ...(base.facility as Row), displayName: "Synthetic Manual Bank", legalName: "Synthetic Manual Bank Inc", officialEmail: "office@manual.bloodledger", facilityLicenseReference: "SYNTH-MANUAL-1" }, qualification: { ...(base.qualification as Row), authorityReference: "SYNTH-MANUAL-2" }, primaryAccount: { ...(base.primaryAccount as Row), requestedLoginEmail: "bloodbank@other.bloodledger" } }, now));
  assert.deepEqual(domain.details, [{ field: "primaryAccount.requestedLoginEmail", rule: "DOMAIN_MISMATCH" }]);
});

test("ADR-048 sample identity cannot be altered, borrowed manually or crossed between categories", async () => {
  const base = submission(await filled("BLOOD_BANK"));
  const altered = code(() => validatePublicApplication({ ...base, facility: { ...(base.facility as Row), displayName: "Synthetic Renamed Bank" } }, now));
  assert.equal(altered.code, "ONB_SAMPLE_METADATA_MISMATCH");
  assert.deepEqual(altered.details, [{ field: "facility.displayName", rule: "SAMPLE_IDENTITY_CHANGED" }]);
  const edited = validatePublicApplication({ ...base, facility: { ...(base.facility as Row), streetAddress: "9 Synthetic Edited Street", officialPhone: "SYN-999-9999" } }, now);
  assert.equal((edited.detail.facility as Row).streetAddress, "9 Synthetic Edited Street");
  assert.equal(code(() => validatePublicApplication({ ...base, sample: null }, now)).code, "ONB_SAMPLE_IDENTITY_RESERVED");
  assert.equal(code(() => validatePublicApplication({ ...base, sample: { ...(base.sample as Row), sampleId: "SAMPLE_BANK_99" } }, now)).code, "ONB_SAMPLE_UNKNOWN");
  assert.equal(code(() => validatePublicApplication({ ...base, sample: { ...(base.sample as Row), sampleId: "SAMPLE_REQUESTOR_01" } }, now)).code, "ONB_SAMPLE_CATEGORY_MISMATCH");
  assert.equal(code(() => validatePublicApplication({ ...base, sample: { ...(base.sample as Row), catalogVersion: "SYNTHETIC_FACILITY_CATALOG_V0" } }, now)).code, "ONB_SAMPLE_STALE");
  assert.equal(code(() => validatePublicApplication({ ...base, sample: { ...(base.sample as Row), instance: 2 } }, now)).code, "ONB_SAMPLE_METADATA_MISMATCH");
});

test("ADR-048 document fixtures are generated synthetic text and PRC alone may deregister", () => {
  assert.match(documentFixture("SYNTH_DOC_BSF_LTO_V1")!, /SIMULATION_ONLY[\s\S]*has not been verified/);
  assert.equal(documentFixture("../../etc/passwd"), undefined);
  const reviewer = { operatorId: "USR_OP_655989F204F82E3BE56E4A6E95F4A625", roleId: "ROLE-04" as const, capabilityProfile: "PRC_REVIEWER" as const, version: 1 };
  const admin = { ...reviewer, capabilityProfile: "INSTITUTION_ADMIN" as const, roleId: "ROLE-06" as const };
  const path = "POST /api/v2/onboarding/institutions/INST_ONB_ABC/deregister";
  assert.equal(allowedOperatorAction({ accountCategory: "PRC" } as Parameters<typeof allowedOperatorAction>[0], reviewer, path), true);
  assert.equal(allowedOperatorAction({ accountCategory: "BLOOD_BANK" } as Parameters<typeof allowedOperatorAction>[0], admin, path), false);
});
