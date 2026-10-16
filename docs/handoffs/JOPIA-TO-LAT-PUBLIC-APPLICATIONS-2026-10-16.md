# Jopia → Lat: public applications, complete forms and reusable sample facilities

Date: 2026-10-16, Asia/Manila. Classification: **SIMULATION_ONLY**.
Answers Lat's handoff "public applications, complete forms and reusable sample
facilities" of the same date. Owner: Jopia for backend, storage, contracts and
integration; Lat for wiring the wizard.

Branch: `codex/jopia-public-applications`. Decision: [PA-ACCOUNT-03](../REQUIREMENTS.md#pa-account-03--public-synthetic-applications-and-sample-facilities-2026-10-16)
and ADR-048. Exact shapes and error codes: [`openapi-v2.json`](../../services/api/openapi-v2.json).
Catalog and limits: [`synthetic-public-application-v1.json`](../../services/api/policy/synthetic-public-application-v1.json).
Migration: [`20261016010000000_create-public-onboarding.js`](../../database/migrations/20261016010000000_create-public-onboarding.js).

## Follow-up to Lat's wiring report (2026-10-16)

Lat confirmed the wiring and reported two discrepancies and a rollout gap. All
three are resolved on the same branch (PR #68):

1. **Retention anchor.** The code was right and this handoff was wrong:
   approval or rejection closes the application (ADR-039). See
   [Retention](#retention), which adds `ONB_APPLICATION_DETAIL_PURGED` and the
   `APPROVAL_LAPSED` sample release that this exposed.
2. **Declarations in the profile.** This handoff was right and the code was
   wrong. Activation now stores `qualification` without
   `capabilityDeclarations`; the probe asserts it.
3. **Rollout.** Two migrations are pending, and a public-only rollout is not
   possible. See [Host prerequisites](#host-prerequisites).

PR #68 is not merged yet. Its merge commit is the reference to deploy. Keep
`VITE_BLOODLEDGER_PUBLIC_APPLICATIONS_READY` off until step 5 of the host
prerequisites passes.

## When to connect, and when to remove `publicApplicationsReady=false`

Wire against this branch now, using fixtures and the disposable suite. Flip the
readiness block only when **both** are true:

1. this branch is merged, and
2. the host API you test against has applied migration `20261016010000000` and
   runs a build containing `POST /api/v2/onboarding/public-applications`.
   `GET /api/v2/onboarding/sample-facilities` returning 200 confirms the
   deployment. A 404 means the host is still on the old API: keep the block.

Live host migration and deployment are not part of this handoff (see
[Host prerequisites](#host-prerequisites)).

## Routes

All under `/api/v2`. Public routes need no session. Mutations need the
`Origin` header your app already sends.

| Route | Who | Purpose |
|---|---|---|
| `GET /onboarding/sample-facilities/selection?category=…&exclude=…` | public | Fill Up: one random eligible sample with values for all four steps. Read-only |
| `GET /onboarding/sample-facilities?category=…` | public | Catalog availability only (IDs, synthetic names, state) |
| `POST /onboarding/public-applications` | public | Submit. `Idempotency-Key` header required |
| `GET /onboarding/document-fixtures/{fixtureId}` | public | Download a generated synthetic fixture (text) |
| `GET /onboarding/applicant/application` | applicant cookie | Own application detail. No credentials |
| `GET /onboarding/applicant/status`, `POST …/applicant/withdraw` | applicant cookie | Unchanged |
| `GET /onboarding/applications` | PRC `onboarding:read` | Unchanged without parameters. Add `limit` (1–100) for cursor pages (`nextCursor`, `ONBA_…`) |
| `GET /onboarding/applications/{id}` | PRC `onboarding:read` | New detail: verification, sample reference, claim status |
| `POST /onboarding/applications/{id}/{review,approve,reject,activate}` | PRC, PIN | Unchanged. Activation of a public application must use the requested login email |
| `POST /onboarding/institutions/{id}/deregister` | PRC, PIN | New non-destructive deletion (see below) |
| `GET /onboarding/institutions/{id}` | own institution or PRC | Adds `facilityProfile` and `application` linkage |

The invitation routes (`POST /onboarding/invitations`, `POST /onboarding/applications`)
are deprecated but still work for existing invitation records. Do not use them
in the public wizard.

## Submission body (`PUBLIC_APPLICATION_V1`)

```json
{
  "schemaVersion": "PUBLIC_APPLICATION_V1",
  "category": "BLOOD_BANK",
  "sample": { "catalogVersion": "SYNTHETIC_FACILITY_CATALOG_V1", "sampleId": "SAMPLE_BANK_01", "instance": 1 },
  "facility": { "...": "step 1" },
  "qualification": { "...": "step 2, category-specific" },
  "primaryAccount": { "...": "step 3" },
  "documents": [{ "slot": "HEALTH_FACILITY_LTO", "fixtureId": "SYNTH_DOC_HEALTH_FACILITY_LTO_V1" }],
  "declaration": { "syntheticDataOnly": true, "accuracyAttested": true },
  "correlationId": "CORR_<32 upper hex>"
}
```

`sample` is `null` for a manual application. Every object is strict: an
unknown or cross-category key returns `ONB_APPLICATION_INVALID` with
`error.details: [{field, rule}]`. Use `details[].field` to highlight the input
and jump to its step. Values are never echoed.

### Field map

| Step | Wizard label | Field | Rule |
|---|---|---|---|
| Facility | Facility name | `facility.displayName` | `Synthetic …`, letters/digits/space/hyphen, ≤ 96 |
| | Registered legal name | `facility.legalName` | `Synthetic …`, may add `, . & '`, ≤ 120 |
| | Ownership | `facility.ownership` | `PRIVATE`, `GOVERNMENT` |
| | Facility classification | `facility.facilityClassification` | `LEVEL_1_HOSPITAL`, `LEVEL_2_HOSPITAL`, `LEVEL_3_HOSPITAL`, `OTHER_LICENSED_HEALTH_FACILITY` |
| | Complete address | `facility.streetAddress` | 3–120 chars, letters/digits and `, . # ' / -` |
| | City / Municipality | `facility.city` | 2–64 |
| | Province | `facility.province` | 2–64 |
| | Official phone | `facility.officialPhone` | `SYN-NNN-NNNN` (synthetic line, no real numbers) |
| | Official facility email | `facility.officialEmail` | `office\|admin\|contact\|bloodbank\|facility@<domain>.bloodledger`, domain ≤ 20 |
| | Hospital / Health Facility LTO number | `facility.facilityLicenseReference` | `SYNTH-…` |
| | LTO expiration | `facility.facilityLicenseExpiresOn` | `YYYY-MM-DD`, after today (Manila), ≤ 10 years |
| Qualification | DOH BSF LTO / Blood Station ATO number | `qualification.authorityReference` | `SYNTH-…` |
| | License / authority expiration | `qualification.authorityExpiresOn` | as above |
| | BSF category (bank only) | `qualification.bsfCategory` | `BLOOD_BANK`, `BLOOD_BANK_WITH_ADDITIONAL_FUNCTIONS`, `BLOOD_CENTER` |
| | Head of Blood Service Facility (bank only) | `qualification.headOfFacilityReference` | `SYNTH-PERSON-…` (replaces a name) |
| | Physician PRC license (bank only) | `qualification.headOfFacilityLicenseReference` | `SYNTH-PRCLIC-NNNNNN` |
| | Medical technologist-in-charge | `qualification.medicalTechnologistReference` | `SYNTH-PERSON-…` |
| | Medical technologist PRC license | `qualification.medicalTechnologistLicenseReference` | `SYNTH-PRCLIC-NNNNNN` |
| | Referral blood bank (requestor only) | `qualification.referralFacilityName` | `Synthetic …` |
| | Three capability checkboxes | `qualification.capabilityDeclarations.{proceduresDocumented, personnelEquipmentContinuity, verificationConsent}` | each `true` |
| | Application reason | `qualification.applicationReason` | 3–160 chars |
| Primary account | Official position | `primaryAccount.applicantPosition` | `BLOOD_BANK_HEAD` (bank), `FACILITY_ADMINISTRATOR` (requestor) |
| | Full name + Employee ID | `primaryAccount.applicantReference` | one `SYNTH-PERSON-…` field. Relabel as "Applicant reference (synthetic)" and drop the separate Employee ID input |
| | Facility Account email | `primaryAccount.requestedLoginEmail` | `bloodbank@…` (bank) or `facility@…` (requestor); same domain as the official email, optionally `-i<n>` |
| | Applicant password | `primaryAccount.password` | 12–128. Confirmation stays client-side and is not sent |
| Documents | Attachment cards | `documents[]` | `{slot, fixtureId}`; each slot accepts only its own fixture |
| | Final declaration | `declaration.syntheticDataOnly`, `declaration.accuracyAttested` | both `true`. Show two checkboxes or one checkbox that sets both |

Document slots:

| Category | Slot | Required | Fixture ID |
|---|---|---|---|
| Both | `HEALTH_FACILITY_LTO` | yes | `SYNTH_DOC_HEALTH_FACILITY_LTO_V1` |
| Blood Bank | `BSF_LTO` | yes | `SYNTH_DOC_BSF_LTO_V1` |
| Blood Bank | `BSF_ASSESSMENT_PACKAGE` | yes | `SYNTH_DOC_BSF_ASSESSMENT_PACKAGE_V1` |
| Requestor | `BLOOD_STATION_AUTHORIZATION` | yes | `SYNTH_DOC_BLOOD_STATION_AUTHORIZATION_V1` |
| Requestor | `REFERRAL_AGREEMENT` | no | `SYNTH_DOC_REFERRAL_AGREEMENT_V1` |

There is no file upload. Change "Attach document" to "Attach synthetic
fixture" and say plainly that it is a generated example, not verified. A
manual applicant attaches the same fixtures. "View" can link to the fixture
download route.

## Fill Up wiring

1. On click, call `GET /onboarding/sample-facilities/selection?category=<cat>&exclude=<currentSampleId>`.
2. `status: "SELECTED"`: replace all four steps with `fill`, keep the
   `sample` object as-is for submission, and generate a fresh applicant
   password locally (Web Crypto, ≥ 16 chars), filling both password and
   confirmation. Never request a password from the server.
3. `notFilled` always lists `primaryAccount.password`,
   `qualification.capabilityDeclarations` and `declaration`. **Do not tick any
   checkbox.** Clear them on each Fill Up so that every attestation is
   deliberate.
4. `status: "EXHAUSTED"` (`sample: null`): say no sample facilities remain for
   that category and keep manual entry available. Do not invent a sixth.
5. `repeated: true` means the excluded sample was the only eligible one.
6. All fields stay editable. These identity fields bind the sample:
   `facility.displayName`, `legalName`, `officialEmail`,
   `facilityLicenseReference`, `qualification.authorityReference` and
   `primaryAccount.requestedLoginEmail`. If the user edits one, either restore
   it or set `sample: null` and show "Manual application". Submitting an
   edited identity with the sample returns `ONB_SAMPLE_METADATA_MISMATCH`.
   Manual entry that reuses a catalog identity returns
   `ONB_SAMPLE_IDENTITY_RESERVED`.
7. Do not poll and rewrite fields in the background. The server revalidates
   at submission.

Filling writes nothing. The integration probe confirms that eight Fill Ups
created no application, claim, account or institution.

## Submission handling

- Keep the existing retry discipline: one `Idempotency-Key` and one body per
  attempt. An ambiguous network failure is retried with the same key and body;
  the original result comes back with `replayed: true`. Changing any value
  needs a new key (an old key with a new body gives `ONB_IDEMPOTENCY_CONFLICT`).
- On success, show the `applicationId`, explain that it is **an application
  awaiting PRC review, not an account**, and that the applicant password is
  only for checking status.
- The applicant panel can call `GET /onboarding/applicant/application` to
  revisit the submitted values (read-only).

| Code | HTTP | UI behavior |
|---|---|---|
| `ONB_APPLICATION_INVALID` | 400 | Highlight `details[].field`; go to the first failing step |
| `ONB_SCHEMA_UNSUPPORTED`, `ONB_CATEGORY_UNSUPPORTED` | 400 | Client defect; show a generic error |
| `ONB_SAMPLE_UNKNOWN`, `ONB_SAMPLE_CATEGORY_MISMATCH` | 400 | Drop the sample reference; ask for Fill Up again |
| `ONB_SAMPLE_METADATA_MISMATCH` | 400 | Restore identity fields or switch to manual |
| `ONB_SAMPLE_UNAVAILABLE` | 409 | "This sample facility was just used by another application." Offer Fill Up for another sample; keep the user's edits until they choose |
| `ONB_SAMPLE_STALE` | 409 | The sample instance or catalog changed; offer Fill Up again |
| `ONB_SAMPLE_IDENTITY_RESERVED` | 409 | Use Fill Up for that sample, or choose other identity values |
| `ONB_DUPLICATE_APPLICATION` | 409 | "An application for this facility is already in progress or registered." Suggest checking status |
| `ONB_IDEMPOTENCY_CONFLICT` | 409 | Generate new keys and resubmit deliberately |
| `ORIGIN_FORBIDDEN` | 403 | Client/proxy configuration defect |
| `ONB_PUBLIC_RATE_LIMITED` | 429 | Show "try again later"; respect `Retry-After` seconds |

## Sample lifecycle

| Event | Availability |
|---|---|
| Fill Up, step change, invalid or failed submission, logout, another browser | unchanged |
| Successful submission (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED` but not activated) | `APPLICATION_IN_PROGRESS` |
| PRC activation | `REGISTERED` |
| Suspension, failed deregistration | still `REGISTERED` |
| Rejection, applicant withdrawal, successful deregistration | `ELIGIBLE` again, next instance |

Availability is stored in PostgreSQL, so it is the same for every browser and
host sharing that database. Never derive it from localStorage or the PRC list.
The next registration of a released sample is instance 2, with login
`bloodbank@sbank01-i2.bloodledger`: retired usernames stay reserved, so
credentials are never reused.

## PRC screens

- Activation of a public application must send `loginEmail` equal to the
  application's `detail.primaryAccount.requestedLoginEmail`. Prefill it
  read-only from the detail read; otherwise you get `ONB_LOGIN_EMAIL_MISMATCH`.
  PRC still enters the institution password and initial PIN (GAP-23 unchanged).
- The application list rows add `schema_version`, `sample_id`,
  `sample_instance`; `detail` has the nested `facility`, `qualification`,
  `primaryAccount` (no password), `documents`, `declaration`, `sample` and the
  existing `institutionDisplayName`.
- **Deregister** (the supported "delete facility"): PIN-verified, body
  `{expectedVersion, correlationId, reasonCode}`, available only when the
  institution is `SUSPENDED`. Show it only for onboarded institutions; others
  return `ONB_DEREGISTRATION_NOT_SUPPORTED`.
  `ONB_RETAINED_OBLIGATIONS_BLOCK_DEREGISTRATION` means it still holds custody
  (any unit not `RELEASED`, `COMPROMISED` or `EXPIRED`), open PRC supply
  requests or pending commands, transfers or reservations. `DEREGISTERED` is
  terminal: no reactivate, no profile edits, no logins. History stays visible.

## Profile (GAP-20/22 backend side)

`GET /onboarding/institutions/{id}` now returns:

- `facilityProfile`: `{facility, qualification, documents, loginEmail, sample}`
  from activation, where `qualification` excludes `capabilityDeclarations`, or `null` (policy-defined institutions, or 30 days after
  deregistration).
- `application`: `{applicationId, schemaVersion, submittedAt, approvedAt,
  activatedAt, deregisteredAt}` or `null`. `approvedAt` is the approval
  decision time.

Applicant reference, capability and final declarations and the applicant
password are not in the profile; declarations stay in the scoped application
detail until its purge. Passwords and PINs are never readable. Profile display-name editing
is unchanged; editing the other facility fields remains unsupported.

## Retention

Application detail keeps the 30-day post-closure purge (ADR-039). **Approval or
rejection closes the application; activation does not.** The applicant view,
application detail and verification therefore disappear 30 days after the
approval decision, however late activation happens. *(Corrected 2026-10-16: an
earlier version of this handoff wrongly said activation closes it.)*

- Activation within 30 days of approval copies the facility data into
  `facilityProfile`, which lives until 30 days after deregistration.
- Activation after the purge returns 409 `ONB_APPLICATION_DETAIL_PURGED`. Tell
  PRC the facility must apply again; do not retry.
- The same purge releases the sample of an approval that was never activated
  (claim `release_reason` `APPROVAL_LAPSED`), so it becomes `ELIGIBLE` again.

Claims and decision references remain as minimal linkage. Show the dates the
API returns; do not compute or reset retention in the client.

## Host prerequisites

*(Corrected 2026-10-16 after Lat's host observation.)* Not executed by this
delivery, and not authorized by it.

**Two migrations are pending, not one.** A retained host on `1d6e4a9` has not
applied `20261016000000000_create-outbound-verifications` (ADR-047, from PR #67,
already on `main`). Migrations apply strictly in filename order, so the public
migration `20261016010000000` cannot run without the outbound one before it.
The API build on `main` also already serves the outbound routes. A public-only
rollout is therefore not possible. The rollout is *the merged `main` API plus
both additive migrations*, and its authorization must name both: the outbound
migration and routes are not covered by the public-application decision.

Staged path, once the host owner authorizes it in writing:

1. Quiesce writers and take a custom-format PostgreSQL backup; validate it with
   `pg_restore --list` and record its SHA-256.
2. Record counts: institutions, application users, onboarding applications,
   account audit, V2 components, V2 reservations and `npm run migrate:status`.
3. `BLOODLEDGER_MIGRATION_COUNT=1 npm run migrate:up` applies only
   `20261016000000000` (new empty `app.v2_outbound_verifications`). Re-check
   the counts and `migrate:status`.
4. `BLOODLEDGER_MIGRATION_COUNT=1 npm run migrate:up` applies only
   `20261016010000000`: new empty `app.onboarding_sample_claims` and
   `app.institution_profiles`, new nullable columns with defaults on
   `app.onboarding_applications`, `DEREGISTERED` added to the institution
   status check, and a replaced purge function. Re-check the counts: they must
   be unchanged.
5. Deploy the merged API. Confirm `GET /api/v2/onboarding/sample-facilities`
   returns 200 with ten `ELIGIBLE` samples on a host that has not used them.
   Only then build the web app with `VITE_BLOODLEDGER_PUBLIC_APPLICATIONS_READY`
   enabled and run Lat's read-only readiness checks.

No population, account creation, reset or Fabric change is part of this. Live
submission, activation or deregistration needs its own bounded plan; fixture
success is not that authorization. The API reads `request.ip` without a
trusted proxy, so behind a shared proxy the per-client limit acts as a shared
limit (the global limit still applies).

## Evidence (Jopia self-validation, isolated WSL checkout)

| Check | Command | Result |
|---|---|---|
| API type check | `npm run check --workspace @bloodledger/api` | PASS |
| API unit (Node 24.17.0) | `npm run test:api` | 196 passed, 0 failed (7 new in `public-onboarding.test.ts`) |
| Disposable PostgreSQL 17.10 + Playwright 1.61.1 image | `bash tests/accounts/postgres-integration.sh` | PASS: 325 assertions, of which 175 are the new public-onboarding probe; all earlier probes still pass |
| Database / API static boundary | `npm run check:database`; `bash tests/api/static-boundary.sh` (Codex `rg` on PATH) | PASS |
| JSON format / diff hygiene | `npm run check:format`; `git diff --check` | PASS |
| Secret scan | `bash scripts/scan-secrets.sh` | Gitleaks: no leaks |

The disposable probe covers both public submissions without credentials,
unsupported category, unknown fields, same-origin, idempotent replay and
changed-body conflict, a concurrent same-sample race (exactly one claim),
read-only Fill Up, pending-duplicate refusal, reserved identity, applicant
isolation, PRC list/page/detail and DOH denial, login-email mismatch,
activation and profile linkage, suspension that does not release, blocked
deregistration with custody, successful deregistration that keeps history and
releases, instance-2 reuse with new institution and login, withdrawal and
rejection releases, exhaustion with manual fallback, retention purge, fixtures,
audit hygiene, no directory enumeration and the per-client rate limit.

Not covered: your wizard wiring, Playwright, the retained host and any live
application/activation/deregistration. Real applicant verification, recovery,
document upload and real retention (`RQ-14`) remain deferred.

## Your checks after wiring

`npm run check:web`, `npm run test:web` (including design tokens) and the
affected Playwright specs with `--workers=1`, mocking the routes above. Please
include: Fill Up fills all four steps and issues no POST; repeated Fill Up
changes the sample; no checkbox gets ticked; editing an identity field makes
the application manual; exhausted state; each 409 code above; retry with the
same key after a simulated network failure.
