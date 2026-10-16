// PA-ACCOUNT-03 / ADR-048 SYNTHETIC_PUBLIC_APPLICATION_V1: public synthetic institution applications
// and the reusable synthetic sample-facility catalog. Submission is not registration: PRC review,
// approval and separate activation still apply, and nothing here grants operational authority.
import { randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Pool, PoolClient } from "pg";
import { ApiFailure } from "./errors.js";
import { sha256 } from "./hash.js";
import { deriveVerifier, verifyPassword } from "./session.js";
import { identityTransaction } from "./operator-verification.js";
import { isoTimestamp, nullableIsoTimestamp } from "./time.js";

type Row = Record<string, unknown>;
export type ApplicationCategory = "BLOOD_BANK" | "REQUESTOR";
interface DocumentSlot { slot: string; required: boolean; fixtureId: string }
interface Sample {
  sampleId: string; category: ApplicationCategory;
  facility: Record<string, string | number> & { displayName: string; legalName: string; officialEmail: string; facilityLicenseReference: string; facilityLicenseValidityDays: number };
  qualification: Record<string, string | number> & { authorityReference: string; authorityValidityDays: number };
  primaryAccount: { applicantPosition: string; applicantReference: string; loginLocalPart: string; loginDomainBase: string };
}
interface Policy {
  policyVersion: string; schemaVersion: "PUBLIC_APPLICATION_V1"; catalogVersion: string; classification: "SIMULATION_ONLY";
  rateLimits: { windowSeconds: number; submissionsPerClient: number; submissionsGlobal: number; samplesPerClient: number; applicantLoginsPerClient: number };
  maxInstancesPerSample: number;
  documentSlots: Record<ApplicationCategory, DocumentSlot[]>;
  documentFixtures: Record<string, string>;
  samples: Sample[];
}
export const publicApplicationPolicy = JSON.parse(readFileSync(new URL("../../policy/synthetic-public-application-v1.json", import.meta.url), "utf8")) as Policy;
const CATEGORIES: ApplicationCategory[] = ["BLOOD_BANK", "REQUESTOR"];
const POSITION: Record<ApplicationCategory, string> = { BLOOD_BANK: "BLOOD_BANK_HEAD", REQUESTOR: "FACILITY_ADMINISTRATOR" };
const LOGIN_LOCAL: Record<ApplicationCategory, string> = { BLOOD_BANK: "bloodbank", REQUESTOR: "facility" };

const PATTERNS = {
  displayName: /^Synthetic [A-Za-z0-9 -]{1,86}$/,
  legalName: /^Synthetic [A-Za-z0-9 ,.&'-]{1,110}$/,
  streetAddress: /^[A-Za-z0-9][A-Za-z0-9 ,.#'/-]{2,119}$/,
  place: /^[A-Za-z][A-Za-z0-9 .'-]{1,63}$/,
  phone: /^SYN-[0-9]{3}-[0-9]{4}$/,
  officialEmail: /^(office|admin|contact|bloodbank|facility)@([a-z0-9][a-z0-9-]{0,19})[.]bloodledger$/,
  reference: /^SYNTH-[A-Z0-9][A-Z0-9-]{2,39}$/,
  person: /^SYNTH-PERSON-[A-Z0-9]{2,16}$/,
  professionalLicense: /^SYNTH-PRCLIC-[0-9]{6}$/,
  reason: /^[A-Za-z0-9][A-Za-z0-9 ,.'-]{2,159}$/,
  date: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
};
const ENUMS = {
  ownership: ["PRIVATE", "GOVERNMENT"],
  facilityClassification: ["LEVEL_1_HOSPITAL", "LEVEL_2_HOSPITAL", "LEVEL_3_HOSPITAL", "OTHER_LICENSED_HEALTH_FACILITY"],
  bsfCategory: ["BLOOD_BANK", "BLOOD_BANK_WITH_ADDITIONAL_FUNCTIONS", "BLOOD_CENTER"],
};
const FIELDS = {
  top: ["schemaVersion", "category", "sample", "facility", "qualification", "primaryAccount", "documents", "declaration", "correlationId"],
  facility: ["displayName", "legalName", "ownership", "facilityClassification", "streetAddress", "city", "province", "officialPhone", "officialEmail", "facilityLicenseReference", "facilityLicenseExpiresOn"],
  qualification: {
    BLOOD_BANK: ["authorityReference", "authorityExpiresOn", "bsfCategory", "headOfFacilityReference", "headOfFacilityLicenseReference", "medicalTechnologistReference", "medicalTechnologistLicenseReference", "capabilityDeclarations", "applicationReason"],
    REQUESTOR: ["authorityReference", "authorityExpiresOn", "medicalTechnologistReference", "medicalTechnologistLicenseReference", "referralFacilityName", "capabilityDeclarations", "applicationReason"],
  },
  capabilityDeclarations: ["proceduresDocumented", "personnelEquipmentContinuity", "verificationConsent"],
  primaryAccount: ["applicantPosition", "applicantReference", "requestedLoginEmail", "password"],
  declaration: ["syntheticDataOnly", "accuracyAttested"],
  sample: ["catalogVersion", "sampleId", "instance"],
  document: ["slot", "fixtureId"],
};
const MAX_EXPIRY_DAYS = 3653;

const failure = (status: number, code: string, message: string, details?: { field: string; rule: string }[]) => new ApiFailure(status, code, message, details);
/** Manila calendar date (UTC+8, no DST), offset by whole days. */
export function manilaDate(now: Date, offsetDays = 0): string {
  return new Date(now.getTime() + 8 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
export function sampleLoginEmail(sample: Sample, instance: number): string {
  return `${sample.primaryAccount.loginLocalPart}@${sample.primaryAccount.loginDomainBase}${instance > 1 ? `-i${instance}` : ""}.bloodledger`;
}
const normalize = (value: unknown) => String(value).trim().replace(/\s+/g, " ").toLowerCase();
const isObject = (value: unknown): value is Row => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const domainOf = (email: string) => email.slice(email.indexOf("@") + 1, -".bloodledger".length);
const RESERVED_DOMAIN = /^(sbank|sreq)[0-9]{2}(-i[0-9]{1,2})?$/;

class Collector {
  readonly details: { field: string; rule: string }[] = [];
  add(field: string, rule: string) { if (this.details.length < 40) this.details.push({ field, rule }); }
  keys(value: unknown, path: string, allowed: string[]): Row | undefined {
    if (!isObject(value)) { this.add(path, "OBJECT_REQUIRED"); return undefined; }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) this.add(path ? `${path}.${key}` : key, "UNSUPPORTED_FIELD");
    for (const key of allowed) if (!(key in value)) this.add(path ? `${path}.${key}` : key, "REQUIRED");
    return value;
  }
  text(row: Row | undefined, path: string, key: string, pattern: RegExp): string {
    const value = row?.[key];
    if (row && key in row && (typeof value !== "string" || !pattern.test(value))) this.add(`${path}.${key}`, "PATTERN");
    return typeof value === "string" ? value : "";
  }
  choice(row: Row | undefined, path: string, key: string, values: string[]): string {
    const value = row?.[key];
    if (row && key in row && (typeof value !== "string" || !values.includes(value))) this.add(`${path}.${key}`, "ENUM");
    return typeof value === "string" ? value : "";
  }
  truth(row: Row | undefined, path: string, key: string) { if (row && key in row && row[key] !== true) this.add(`${path}.${key}`, "MUST_BE_TRUE"); }
  date(row: Row | undefined, path: string, key: string, now: Date): string {
    const value = this.text(row, path, key, PATTERNS.date);
    if (value && PATTERNS.date.test(value)) {
      const parsed = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) this.add(`${path}.${key}`, "DATE_INVALID");
      else if (value <= manilaDate(now)) this.add(`${path}.${key}`, "EXPIRED");
      else if (value > manilaDate(now, MAX_EXPIRY_DAYS)) this.add(`${path}.${key}`, "TOO_FAR");
    }
    return value;
  }
}

export interface ValidatedApplication {
  category: ApplicationCategory; password: string; correlationId: string;
  sample: { catalogVersion: string; sampleId: string; instance: number } | null;
  /** Stored application detail: never contains the applicant password. */
  detail: Row;
}
/** Strict whole-form validation. Unknown fields are rejected, never silently dropped. */
export function validatePublicApplication(value: unknown, now: Date): ValidatedApplication {
  if (!isObject(value)) throw failure(400, "ONB_APPLICATION_INVALID", "The application body is invalid.", [{ field: "", rule: "OBJECT_REQUIRED" }]);
  if (value.schemaVersion !== publicApplicationPolicy.schemaVersion) throw failure(400, "ONB_SCHEMA_UNSUPPORTED", "The application schema version is not supported.");
  if (!CATEGORIES.includes(value.category as ApplicationCategory)) throw failure(400, "ONB_CATEGORY_UNSUPPORTED", "Only BLOOD_BANK and REQUESTOR applications are accepted.");
  const category = value.category as ApplicationCategory, v = new Collector();
  v.keys(value, "", FIELDS.top);
  if (typeof value.correlationId !== "string" || !/^CORR_[0-9A-F]{32}$/.test(value.correlationId)) v.add("correlationId", "PATTERN");
  const facility = v.keys(value.facility, "facility", FIELDS.facility);
  const f = {
    displayName: v.text(facility, "facility", "displayName", PATTERNS.displayName),
    legalName: v.text(facility, "facility", "legalName", PATTERNS.legalName),
    ownership: v.choice(facility, "facility", "ownership", ENUMS.ownership),
    facilityClassification: v.choice(facility, "facility", "facilityClassification", ENUMS.facilityClassification),
    streetAddress: v.text(facility, "facility", "streetAddress", PATTERNS.streetAddress),
    city: v.text(facility, "facility", "city", PATTERNS.place),
    province: v.text(facility, "facility", "province", PATTERNS.place),
    officialPhone: v.text(facility, "facility", "officialPhone", PATTERNS.phone),
    officialEmail: v.text(facility, "facility", "officialEmail", PATTERNS.officialEmail),
    facilityLicenseReference: v.text(facility, "facility", "facilityLicenseReference", PATTERNS.reference),
    facilityLicenseExpiresOn: v.date(facility, "facility", "facilityLicenseExpiresOn", now),
  };
  const qualification = v.keys(value.qualification, "qualification", FIELDS.qualification[category]);
  const q: Row = {
    authorityReference: v.text(qualification, "qualification", "authorityReference", PATTERNS.reference),
    authorityExpiresOn: v.date(qualification, "qualification", "authorityExpiresOn", now),
  };
  if (category === "BLOOD_BANK") {
    q.bsfCategory = v.choice(qualification, "qualification", "bsfCategory", ENUMS.bsfCategory);
    q.headOfFacilityReference = v.text(qualification, "qualification", "headOfFacilityReference", PATTERNS.person);
    q.headOfFacilityLicenseReference = v.text(qualification, "qualification", "headOfFacilityLicenseReference", PATTERNS.professionalLicense);
  }
  q.medicalTechnologistReference = v.text(qualification, "qualification", "medicalTechnologistReference", PATTERNS.person);
  q.medicalTechnologistLicenseReference = v.text(qualification, "qualification", "medicalTechnologistLicenseReference", PATTERNS.professionalLicense);
  if (category === "REQUESTOR") q.referralFacilityName = v.text(qualification, "qualification", "referralFacilityName", PATTERNS.displayName);
  const declarations = qualification && "capabilityDeclarations" in qualification ? v.keys(qualification.capabilityDeclarations, "qualification.capabilityDeclarations", FIELDS.capabilityDeclarations) : undefined;
  for (const key of FIELDS.capabilityDeclarations) v.truth(declarations, "qualification.capabilityDeclarations", key);
  q.capabilityDeclarations = { proceduresDocumented: true, personnelEquipmentContinuity: true, verificationConsent: true };
  q.applicationReason = v.text(qualification, "qualification", "applicationReason", PATTERNS.reason);
  const account = v.keys(value.primaryAccount, "primaryAccount", FIELDS.primaryAccount);
  const applicantPosition = v.choice(account, "primaryAccount", "applicantPosition", [POSITION[category]]);
  const applicantReference = v.text(account, "primaryAccount", "applicantReference", PATTERNS.person);
  const loginPattern = new RegExp(`^${LOGIN_LOCAL[category]}@([a-z0-9][a-z0-9-]{0,19})[.]bloodledger$`);
  const requestedLoginEmail = v.text(account, "primaryAccount", "requestedLoginEmail", loginPattern);
  // The login shares the official domain; a re-registered instance adds "-i<n>" (n >= 2) because retired usernames stay reserved.
  if (loginPattern.test(requestedLoginEmail) && PATTERNS.officialEmail.test(f.officialEmail) && domainOf(requestedLoginEmail).replace(/-i([2-9]|[1-9][0-9])$/, "") !== domainOf(f.officialEmail)) v.add("primaryAccount.requestedLoginEmail", "DOMAIN_MISMATCH");
  const password = account?.password;
  if (account && "password" in account && (typeof password !== "string" || password.length < 12 || password.length > 128)) v.add("primaryAccount.password", "LENGTH");
  const slots = publicApplicationPolicy.documentSlots[category], documents: Row[] = [];
  if (!Array.isArray(value.documents) || value.documents.length > slots.length) v.add("documents", "ARRAY_INVALID");
  else {
    const seen = new Set<string>();
    value.documents.forEach((entry, index) => {
      const row = v.keys(entry, `documents[${index}]`, FIELDS.document), slot = slots.find(s => s.slot === row?.slot);
      if (!row) return;
      if (!slot || seen.has(slot.slot)) { v.add(`documents[${index}].slot`, slot ? "DUPLICATE" : "ENUM"); return; }
      seen.add(slot.slot);
      if (row.fixtureId !== slot.fixtureId) { v.add(`documents[${index}].fixtureId`, "FIXTURE_REQUIRED"); return; }
      documents.push({ slot: slot.slot, fixtureId: slot.fixtureId, kind: "SYNTHETIC_FIXTURE", verificationStatus: "NOT_VERIFIED" });
    });
    for (const slot of slots) if (slot.required && !seen.has(slot.slot)) v.add(`documents.${slot.slot}`, "REQUIRED");
  }
  const declaration = v.keys(value.declaration, "declaration", FIELDS.declaration);
  for (const key of FIELDS.declaration) v.truth(declaration, "declaration", key);
  let sample: ValidatedApplication["sample"] = null;
  if (value.sample !== null && "sample" in value) {
    const row = v.keys(value.sample, "sample", FIELDS.sample);
    if (row && (typeof row.catalogVersion !== "string" || typeof row.sampleId !== "string" || !Number.isSafeInteger(row.instance) || Number(row.instance) < 1 || Number(row.instance) > publicApplicationPolicy.maxInstancesPerSample)) v.add("sample", "PATTERN");
    else if (row) sample = { catalogVersion: String(row.catalogVersion), sampleId: String(row.sampleId), instance: Number(row.instance) };
  }
  if (v.details.length) throw failure(400, "ONB_APPLICATION_INVALID", "The application has invalid or unsupported fields.", v.details);
  const detail: Row = {
    schemaVersion: publicApplicationPolicy.schemaVersion,
    institutionDisplayName: f.displayName,
    facility: f, qualification: q,
    primaryAccount: { applicantPosition, applicantReference, requestedLoginEmail },
    documents: documents.sort((a, b) => String(a.slot).localeCompare(String(b.slot))),
    declaration: { syntheticDataOnly: true, accuracyAttested: true },
    sample,
  };
  checkSampleIdentity(category, sample, detail);
  return { category, password: password as string, correlationId: value.correlationId as string, sample, detail };
}

/** Identity fields that bind a submission to one catalog facility. Other fields stay freely editable. */
function sampleIdentity(sample: Sample, instance: number): Record<string, string> {
  return {
    "facility.displayName": sample.facility.displayName, "facility.legalName": sample.facility.legalName,
    "facility.officialEmail": sample.facility.officialEmail, "facility.facilityLicenseReference": sample.facility.facilityLicenseReference,
    "qualification.authorityReference": sample.qualification.authorityReference, "primaryAccount.requestedLoginEmail": sampleLoginEmail(sample, instance),
  };
}
function read(detail: Row, path: string): string { const [section, key] = path.split("."); return String((detail[section!] as Row)[key!]); }
function checkSampleIdentity(category: ApplicationCategory, reference: ValidatedApplication["sample"], detail: Row): void {
  if (reference) {
    if (reference.catalogVersion !== publicApplicationPolicy.catalogVersion) throw failure(409, "ONB_SAMPLE_STALE", "The sample catalog version has changed; select a sample again.");
    const sample = publicApplicationPolicy.samples.find(s => s.sampleId === reference.sampleId);
    if (!sample) throw failure(400, "ONB_SAMPLE_UNKNOWN", "The sample facility reference is not recognized.");
    if (sample.category !== category) throw failure(400, "ONB_SAMPLE_CATEGORY_MISMATCH", "The sample facility belongs to another application category.");
    const changed = Object.entries(sampleIdentity(sample, reference.instance)).filter(([path, expected]) => read(detail, path) !== expected).map(([field]) => ({ field, rule: "SAMPLE_IDENTITY_CHANGED" }));
    if (changed.length) throw failure(400, "ONB_SAMPLE_METADATA_MISMATCH", "Sample identity fields were changed. Restore them or clear the sample to apply manually.", changed);
    return;
  }
  // Manual applications cannot borrow a catalog identity and bypass the sample uniqueness rule.
  const facility = detail.facility as Row, account = detail.primaryAccount as Row, qualification = detail.qualification as Row;
  const reserved = publicApplicationPolicy.samples.some(s => normalize(s.facility.displayName) === normalize(facility.displayName) || normalize(s.facility.legalName) === normalize(facility.legalName)
    || s.facility.facilityLicenseReference === facility.facilityLicenseReference || s.qualification.authorityReference === qualification.authorityReference)
    || RESERVED_DOMAIN.test(domainOf(String(facility.officialEmail))) || RESERVED_DOMAIN.test(domainOf(String(account.requestedLoginEmail)));
  if (reserved) throw failure(409, "ONB_SAMPLE_IDENTITY_RESERVED", "These identity values belong to a synthetic sample facility. Use Fill Up to apply as that sample.");
}

type Availability = "ELIGIBLE" | "APPLICATION_IN_PROGRESS" | "REGISTERED" | "INSTANCES_EXHAUSTED";
export class PublicOnboarding {
  constructor(readonly pool: Pool, readonly limits = publicApplicationPolicy.rateLimits) {}
  /** Persistent fixed windows shared by every API process on the database. */
  async throttle(scopes: { scope: string; limit: number }[], now: Date): Promise<void> {
    const windowMs = this.limits.windowSeconds * 1000;
    const blocked = await identityTransaction(this.pool, async client => {
      for (const { scope, limit } of scopes) {
        const digest = sha256({ publicOnboarding: scope });
        await client.query("INSERT INTO app.operator_attempt_windows(scope_digest,attempts,window_start) VALUES($1,0,$2) ON CONFLICT(scope_digest) DO NOTHING", [digest, now]);
        const row = (await client.query<Row>("SELECT attempts,window_start FROM app.operator_attempt_windows WHERE scope_digest=$1 FOR UPDATE", [digest])).rows[0]!;
        const start = new Date(String(row.window_start)).getTime(), fresh = start > now.getTime() - windowMs;
        if (fresh && Number(row.attempts) >= limit) return Math.max(1, Math.ceil((start + windowMs - now.getTime()) / 1000));
        await client.query("UPDATE app.operator_attempt_windows SET attempts=$2,window_start=$3 WHERE scope_digest=$1", [digest, fresh ? Number(row.attempts) + 1 : 1, fresh ? row.window_start : now]);
      }
      return 0;
    });
    if (blocked) throw new ApiFailure(429, "ONB_PUBLIC_RATE_LIMITED", "Too many public onboarding requests. Try again later.", undefined, blocked);
  }
  private async availability(client: Pool | PoolClient): Promise<Map<string, { availability: Availability; nextInstance: number }>> {
    const rows = await client.query<Row>("SELECT c.sample_id,count(*)::int instances,bool_or(c.status='ACTIVE') active,bool_or(c.status='ACTIVE' AND a.institution_id IS NOT NULL) registered FROM app.onboarding_sample_claims c JOIN app.onboarding_applications a USING(application_id) WHERE c.catalog_version=$1 GROUP BY c.sample_id", [publicApplicationPolicy.catalogVersion]);
    const byId = new Map(rows.rows.map(row => [String(row.sample_id), row]));
    return new Map(publicApplicationPolicy.samples.map(sample => {
      const row = byId.get(sample.sampleId), instances = Number(row?.instances ?? 0);
      const availability: Availability = row?.registered ? "REGISTERED" : row?.active ? "APPLICATION_IN_PROGRESS" : instances >= publicApplicationPolicy.maxInstancesPerSample ? "INSTANCES_EXHAUSTED" : "ELIGIBLE";
      return [sample.sampleId, { availability, nextInstance: instances + 1 }];
    }));
  }
  async catalog(category: unknown): Promise<Row> {
    if (category !== undefined && !CATEGORIES.includes(category as ApplicationCategory)) throw failure(400, "ONB_CATEGORY_UNSUPPORTED", "Only BLOOD_BANK and REQUESTOR samples exist.");
    const state = await this.availability(this.pool);
    const samples = publicApplicationPolicy.samples.filter(s => !category || s.category === category).map(s => ({ sampleId: s.sampleId, category: s.category, displayName: s.facility.displayName, availability: state.get(s.sampleId)!.availability }));
    return { catalogVersion: publicApplicationPolicy.catalogVersion, samples, eligibleCount: samples.filter(s => s.availability === "ELIGIBLE").length, classification: "SIMULATION_ONLY" };
  }
  /** Fill Up: a random eligible sample. Read-only; selection never reserves or consumes a sample. */
  async select(category: unknown, exclude: unknown, now: Date): Promise<Row> {
    if (!CATEGORIES.includes(category as ApplicationCategory)) throw failure(400, "ONB_CATEGORY_UNSUPPORTED", "Only BLOOD_BANK and REQUESTOR samples exist.");
    if (exclude !== undefined && (typeof exclude !== "string" || !/^SAMPLE_(BANK|REQUESTOR)_[0-9]{2}$/.test(exclude))) throw failure(400, "ONB_SAMPLE_UNKNOWN", "The excluded sample reference is not recognized.");
    const state = await this.availability(this.pool);
    const eligible = publicApplicationPolicy.samples.filter(s => s.category === category && state.get(s.sampleId)!.availability === "ELIGIBLE");
    const base = { catalogVersion: publicApplicationPolicy.catalogVersion, category, eligibleCount: eligible.length, classification: "SIMULATION_ONLY" };
    if (!eligible.length) return { ...base, status: "EXHAUSTED", sample: null };
    const pool = eligible.length > 1 ? eligible.filter(s => s.sampleId !== exclude) : eligible;
    const sample = pool[randomInt(pool.length)]!, instance = state.get(sample.sampleId)!.nextInstance;
    const { facilityLicenseValidityDays, ...facility } = sample.facility, { authorityValidityDays, ...qualification } = sample.qualification;
    return {
      ...base, status: "SELECTED", repeated: sample.sampleId === exclude,
      sample: { catalogVersion: publicApplicationPolicy.catalogVersion, sampleId: sample.sampleId, instance },
      fill: {
        category: sample.category,
        facility: { ...facility, facilityLicenseExpiresOn: manilaDate(now, facilityLicenseValidityDays) },
        qualification: { ...qualification, authorityExpiresOn: manilaDate(now, authorityValidityDays) },
        primaryAccount: { applicantPosition: sample.primaryAccount.applicantPosition, applicantReference: sample.primaryAccount.applicantReference, requestedLoginEmail: sampleLoginEmail(sample, instance) },
        documents: publicApplicationPolicy.documentSlots[sample.category].map(({ slot, fixtureId }) => ({ slot, fixtureId })),
      },
      // The applicant generates the password locally and makes every attestation deliberately.
      notFilled: ["primaryAccount.password", "qualification.capabilityDeclarations", "declaration"],
    };
  }
  async submit(value: unknown, idem: string, now: Date): Promise<Row> {
    if (!/^IDEM_[A-Z0-9_-]{1,59}$/.test(idem)) throw failure(400, "INVALID_IDEMPOTENCY_KEY", "An idempotency key is required.");
    const input = validatePublicApplication(value, now);
    const digest = sha256({ detail: input.detail, category: input.category, correlationId: input.correlationId });
    const matchDigest = sha256({ name: String(input.detail.institutionDisplayName).toLowerCase(), category: input.category });
    return identityTransaction(this.pool, async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`onboarding-public:${idem}`]);
      const prior = (await client.query<Row>("SELECT * FROM app.onboarding_applications WHERE idempotency_key=$1", [idem])).rows[0];
      if (prior) {
        if (prior.payload_sha256 !== digest || !await verifyPassword(input.password, { saltHex: String(prior.password_salt), verifierHex: String(prior.password_verifier) } as Parameters<typeof verifyPassword>[1])) throw failure(409, "ONB_IDEMPOTENCY_CONFLICT", "This idempotency key was used for a different application.");
        return { ...submissionResult(prior), replayed: true };
      }
      // Fixed lock order (facility name, then sample) serializes concurrent applicants.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`onboarding-match:${matchDigest}`]);
      if (input.sample) {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`onboarding-sample:${input.sample.catalogVersion}:${input.sample.sampleId}`]);
        const state = (await this.availability(client)).get(input.sample.sampleId)!;
        if (state.availability !== "ELIGIBLE") throw failure(409, "ONB_SAMPLE_UNAVAILABLE", "The selected sample facility already has an application in progress or is registered.");
        if (state.nextInstance !== input.sample.instance) throw failure(409, "ONB_SAMPLE_STALE", "The selected sample changed since it was filled; select it again.");
      }
      const duplicate = await client.query("SELECT 1 FROM app.onboarding_applications a LEFT JOIN app.institutions i ON i.institution_id=a.institution_id WHERE a.match_digest=$1 AND a.status NOT IN ('REJECTED','WITHDRAWN') AND (i.status IS NULL OR i.status<>'DEREGISTERED') LIMIT 1", [matchDigest]);
      if (duplicate.rows.length) throw failure(409, "ONB_DUPLICATE_APPLICATION", "An application for this facility is already in progress or registered.");
      const previous = await client.query<Row>("SELECT application_id FROM app.onboarding_applications WHERE match_digest=$1 ORDER BY created_at DESC LIMIT 1", [matchDigest]);
      const id = "ONB_" + randomBytes(20).toString("hex").toUpperCase(), applicantId = "USR_APPLICANT_" + randomBytes(16).toString("hex").toUpperCase(), salt = randomBytes(16).toString("hex");
      const inserted = await client.query<Row>("INSERT INTO app.onboarding_applications(application_id,invitation_id,applicant_id,password_salt,password_verifier,category,status,detail,created_at,idempotency_key,payload_sha256,match_digest,previous_application_id,schema_version,sample_catalog_version,sample_id,sample_instance) VALUES($1,NULL,$2,$3,$4,$5,'SUBMITTED',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *",
        [id, applicantId, salt, await deriveVerifier(input.password, salt), input.category, input.detail, now, idem, digest, matchDigest, previous.rows[0]?.application_id ?? null, publicApplicationPolicy.schemaVersion, input.sample?.catalogVersion ?? null, input.sample?.sampleId ?? null, input.sample?.instance ?? null]);
      if (input.sample) await client.query("INSERT INTO app.onboarding_sample_claims(claim_id,catalog_version,sample_id,category,instance,application_id,status,claimed_at) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',$7)", ["CLM_" + randomBytes(20).toString("hex").toUpperCase(), input.sample.catalogVersion, input.sample.sampleId, input.category, input.sample.instance, id, now]);
      const result = submissionResult(inserted.rows[0]!);
      await client.query("INSERT INTO app.account_audit(audit_id,actor_id,actor_institution_id,subject_id,action,prior_status,resulting_status,reason_code,correlation_id,idempotency_key,payload_sha256,result,created_at) VALUES($1,$2,NULL,$3,'SUBMIT_PUBLIC_APPLICATION',NULL,'SUBMITTED',NULL,$4,$5,$6,$7,$8)",
        ["AUD_" + sha256({ actor: applicantId, idem }).slice(0, 40).toUpperCase(), applicantId, id, input.correlationId, idem, digest, result, now]);
      return result;
    });
  }
  /** Applicant-scoped read of the caller's own application. Never returns credentials. */
  ownApplication(row: Row): Row {
    return { ...submissionResult(row), submittedAt: isoTimestamp(row.created_at), closedAt: nullableIsoTimestamp(row.closed_at), detail: row.detail ?? null, detailRetention: row.detail ? "RETAINED" : "PURGED" };
  }
}
function submissionResult(row: Row): Row {
  return { applicationId: row.application_id, status: row.status, version: Number(row.version), category: row.category, schemaVersion: row.schema_version, sample: row.sample_id ? { catalogVersion: row.sample_catalog_version, sampleId: row.sample_id, instance: Number(row.sample_instance) } : null, classification: "SIMULATION_ONLY" };
}
/** Release the sample claim held by an application whose lifecycle ended without registration. */
export async function releaseSampleClaim(client: PoolClient, where: { applicationId?: string; institutionId?: string }, reason: "REJECTED" | "WITHDRAWN" | "DEREGISTERED", now: Date): Promise<void> {
  if (where.applicationId) await client.query("UPDATE app.onboarding_sample_claims SET status='RELEASED',released_at=$2,release_reason=$3 WHERE application_id=$1 AND status='ACTIVE'", [where.applicationId, now, reason]);
  if (where.institutionId) await client.query("UPDATE app.onboarding_sample_claims SET status='RELEASED',released_at=$2,release_reason=$3 WHERE status='ACTIVE' AND application_id IN (SELECT application_id FROM app.onboarding_applications WHERE institution_id=$1)", [where.institutionId, now, reason]);
}
/** Synthetic fixture body. It is generated text, not an institutional or verified document. */
export function documentFixture(fixtureId: string): string | undefined {
  const description = publicApplicationPolicy.documentFixtures[fixtureId];
  return description ? `SIMULATION_ONLY synthetic document fixture\nFixture: ${fixtureId}\nCatalog: ${publicApplicationPolicy.catalogVersion}\nDescription: ${description}\nThis file is generated by BloodLedger for simulation. It is not an institutional document and has not been verified.\n` : undefined;
}
