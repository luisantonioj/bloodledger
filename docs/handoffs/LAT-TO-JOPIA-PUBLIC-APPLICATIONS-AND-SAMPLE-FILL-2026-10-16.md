# Lat → Jopia: public applications, complete forms and reusable sample facilities

Date: 2026-10-16, Asia/Manila. Owner: Jopia for backend, storage, contracts and integration; Lat for frontend wiring. Scope: SIMULATION_ONLY prototype.

## User decision — implement, rather than request permission again

The user has selected public application entry for both Blood Bank and Requestor facilities. Any prospective facility may complete an application from the login screen. No preliminary PRC credential is part of this flow. This changes who can apply; it does not remove PRC review, approval, separate activation, operator authorization or account-category boundaries.

The user also wants every application field editable, a **Fill Up** button immediately left of Continue (and alongside final-step actions), and a sample pool. One click fills the whole four-step application, including steps not yet displayed. Subsequent clicks select another randomized eligible sample for that category. Fields remain editable afterward. Filling does not submit, activate an account, attach official evidence or attest on the user's behalf.

Prepare five synthetic Blood Bank facilities and five synthetic Requestor facilities. This is a ten-facility catalog, not ten accounts to pre-create. Do not populate the retained database merely to demonstrate this UI.

## Current implementation and frontend preparation

Relevant source:

- [Application wizard](../../apps/web/src/features/auth/synthetic-application.tsx).
- [Synthetic sample catalog and draft builder](../../apps/web/src/features/auth/application-samples.ts).
- [Existing onboarding service](../../services/api/src/onboarding.ts).
- [Published OpenAPI](../../services/api/openapi-v2.json).
- [Institution-account rules](../INSTITUTION-ACCOUNTS.md).
- [Application/profile field map](../frontend/APPLICATION_PROFILE_FIELD_MAP.md).
- [Frontend gaps, especially GAP-20/22](../frontend/BACKEND_API_GAPS.md).

The current service accepts only a basic application shape; extended qualification fields and uploads are not supported. Its existing entry/storage dependency also prevents public submission. Lat removed the obsolete entry field and requirement text from the wizard. Final submission is temporarily disabled, with both a button state and a form-submit guard, rather than sending a request the old API will reject. Existing applicant status and withdrawal remain available.

Lat has now implemented editable fields on all four steps and five synthetic samples per category. Fill Up chooses a non-repeating randomized preview, fills the entire draft and matching fresh password, and prepares three in-memory synthetic document examples. Documents can be attached/replaced/removed as generated samples; arbitrary file uploads remain unconnected. Capability/final declarations stay unchecked and reset when the draft is replaced. Preview choices cycle after all five; they do not consume accounts. Registered/deleted eligibility is still pending the backend contract below. No public submission is enabled or claimed complete.

## 1. Public submission and lifecycle

Publish the public submission contract in OpenAPI. An unauthenticated applicant must be able to submit either permitted category without any prior account or entry credential. Replace the old service/schema/storage dependency using an additive migration where needed; never rewrite applied migrations.

Keep same-origin checks, bounded input sizes, strict field allowlists, idempotency/correlation, safe validation/duplicate errors, applicant password hashing, scoped applicant sessions and the existing decision audit. Define suitable public submission rate limits and stable error responses. These are implementation tasks within the selected public-entry scope, not a request to reapprove it.

Application submission is not official account registration. Preserve separate PRC review/approval/activation and the non-clinical initial administration role. Do not create operational privileges, Fabric identities, peers or stock ownership during submission.

Record the superseding prototype decision in requirements/architecture and reconcile the public-entry implications of RQ-13. Keep real institutional-data/research authorization and unrelated unresolved decisions explicit; this task selects synthetic public entry, not an operational deployment.

## 2. Publish support for the whole four-step form

Use the field map and wizard to inventory all fields. Return an exact validation/storage/read contract so Lat can enable them without silently dropping values.

| Step | Fields to cover |
|---|---|
| Facility | Display and registered legal name, ownership, facility classification, address/city/province, official generic phone/email, facility LTO reference and expiration |
| Qualification | Category-specific authority/license reference and expiration; bank BSF category and professional-role details; requestor receiving capability/referral facility; capability declarations; application reason |
| Primary account | Applicant role/position and the requested account fields, applicant password/confirmation behavior; distinguish applicant status credentials from provisioned institution credentials |
| Documents/declaration | Category-specific required/optional attachment slots, explicit applicant declaration and submission validation |

The present repository forbids collecting real staff identifiers, unrestricted documents or clinical/personal information. For this selected simulation, publish synthetic-only field semantics and synthetic document fixtures. Where the mockup asks for a personal name, employee ID or professional license, do not silently make it a real-person data-collection feature: define the synthetic representation or documented replacement. Do not store arbitrary files while claiming they have been institutionally verified.

Define attachment types, limits, access, retention, validation and download behavior if attachments are implemented. Sample filling may supply generated synthetic example files only if the contract supports them; otherwise Lat must clearly identify an unconnected attachment step rather than imply a file was uploaded.

Provide authorized application detail and own-institution profile linkage for the new fields where required. Apply retention deliberately: do not assume applicant details remain available forever after activation. Do not expose passwords/PINs in reads, activity or profile data.

## 3. Exact sample reuse rule

The user clarified that **selection is not consumption**. Successfully registered/activated sample facilities are excluded from future Fill Up selections. A facility deleted through the supported institution/account lifecycle becomes eligible again. Clicking Fill Up, changing steps, submitting an invalid request or receiving a failed response must not permanently consume a sample.

Use stable catalog IDs, category and a catalog version. Suggested identity keys are `SAMPLE_BANK_01`–`05` and `SAMPLE_REQUESTOR_01`–`05`; these are synthetic catalog references, not institution IDs, license approval or login credentials. Agree on the exact IDs with Lat and publish them before wiring.

Required behavior:

1. Choose randomly among currently eligible samples for the selected category; exclude already registered sample institutions.
2. Keep all fields in one selected facility internally consistent across all four steps. Generate acceptable synthetic values and a fresh applicant password without changing the facility's stable sample identity on every click.
3. A pending application is not an activated account. Define pending/submitted handling explicitly: permit revisiting the same draft or report that an application is already in progress; never create duplicate pending applications merely because the account is not yet active. Preserve the identity until its lifecycle allows another application.
4. After successful registration/activation, make the sample unavailable across browser reloads, browsers and hosts sharing the database. Browser localStorage is not the authority for this rule.
5. After actual supported deletion of that facility/account linkage, make the sample available again. Failed deletion, logout and changing browser do not release it. Suspension is not deletion. Do not add a destructive delete/reset or purge retained domain history to satisfy sample reuse.
6. Preserve minimal audit/linkage for the previous lifecycle; a later registration is a new instance, not reuse of old credentials or authority. Define safe behavior if a deleted sample has retained custody or other unresolved obligations.
7. Enforce uniqueness transactionally for concurrent applicants. Two browsers filling the same sample must not create two active facilities. Idempotent retries return the original result rather than allocating another facility.
8. If no samples remain, return an explicit exhausted state. Keep manual application possible; never reuse an active sample or silently fabricate a sixth catalog identity.
9. Do not rewrite user-edited fields during background eligibility refresh. Revalidate before submission and surface a safe conflict if another application registered the selected facility in the meantime.

Publish an appropriate sample eligibility/allocation interface for the unauthenticated wizard. It must operate only on this synthetic catalog and reveal no general institution directory, private applications, personal details or credential data. Lat should not receive the full privileged application list to calculate availability. Define safe handling of unknown IDs, category mismatches and altered sample metadata; manual editing must not bypass identity uniqueness.

No additional user permission question is needed for the stated sample behavior. If existing deletion semantics do not support it, identify the exact lifecycle gap and implement within a documented non-destructive contract; do not treat suspension or a frontend hidden row as a deleted institution.

## 4. Jopia deliverables and exact return handoff for Lat

- Versioned public application schemas/routes, expanded field map, validation constraints and response shapes.
- Category-specific required fields, document semantics, declaration and account-activation behavior.
- Sample catalog/version and authorized public eligibility contract; pending, registered, deleted and exhausted semantics.
- Stable error codes for validation, duplicate/pending conflict, sample unavailable, exhausted pool, rate limiting and stale state.
- Paging/detail permissions and backwards compatibility for PRC review and applicant status/profile reads.
- Additive migrations and deployment prerequisites, with retained-data backup/unchanged-state requirements.
- Synthetic fixtures and independent test evidence; identify anything still deferred.
- Tell Lat exactly when to connect the published public submission route and remove the temporary readiness block. Do not simply flip the block before the host API supports the contract.

## 5. Required synthetic tests

- Public bank/requestor submission without prior credentials; unsupported categories rejected.
- Every supported field validates and round-trips under the correct permissions; unrecognized fields rejected rather than silently dropped.
- Idempotent ambiguous-response retry, changed-body conflict and concurrent duplicate registration.
- Five samples per category; repeated Fill Up populates all steps with consistent values; filling alone issues no submission.
- Registered sample excluded, failed submission not consumed, pending duplicate handled, actual deletion re-enables, suspension does not re-enable, all-used exhaustion and cross-browser consistency.
- Fill Up never checks declarations or changes official review status; replacing a draft clears earlier confirmations. Final submission remains deliberate.
- Applicant data isolation, safe errors, bounded public submission and no directory enumeration.
- Expanded fields/documents follow approved synthetic handling; no secrets in logs/audit/read responses.
- Existing PRC approval/activation, institution role boundaries and applicant status/withdrawal regressions.

Lat runs `check:web`, relevant unit/design-token checks and affected Playwright specs with `--workers=1` after wiring. Backend tests and disposable integration belong to Jopia. Live retained-host applications/activation/deletion, migrations, resets or population are not authorized by this handoff; use fixtures/disposable test databases and report host deployment prerequisites separately.

## Acceptance

A new synthetic facility can apply through the public wizard, review all fields filled once, submit intentionally, pass through PRC review and become registered through the existing authorized lifecycle. Its sample then disappears from the eligible pool. A supported later deletion restores that sample without deleting ledger history or reusing credentials. No UI-only exclusion or fabricated success qualifies as completion.

## Lat frontend checks — latest follow-up

- `npm run check:web`: PASS (existing >500 kB bundle advisory).
- `npm run test:web`: PASS, 411 tests / 47 files, including design-token checks and catalog tests.
- `npm run test:e2e --workspace @bloodledger/web -- access-application.spec.ts --workers=1`: PASS, 5 synthetic browser tests. Both categories fill all steps once; fields stay editable; matching passwords, manual declarations, local sample document controls, five-choice non-repeat cycles, draft/category clearing, mobile width and the no-POST submission guard are checked.
- No live application, activation, account deletion, migration or data write was performed. Changes are saved locally and not committed by this task.
