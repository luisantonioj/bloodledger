# Lat — public application contract wiring, 2026-10-16

Classification: **SIMULATION_ONLY**. Frontend integration/self-validation, with separately attributed backend evidence. No institutional, clinical, regulatory or production acceptance.

## Source and preservation

- Saved frontend baseline: `e9c86e8`, `codex/lat-analytics-activity-layouts`, including editable application drafts and approved layout.
- Recovery branch: `codex/lat-before-public-onboarding-20261016` at `e9c86e8`.
- Integrated Jopia's published backend branch `origin/codex/jopia-public-applications`, implementation `fecdbaf`, through local merge `eee9f4e`. Existing frontend changes were preserved; no source conflict occurred.
- Published contracts: [OpenAPI](../../../services/api/openapi-v2.json), [catalog/policy](../../../services/api/policy/synthetic-public-application-v1.json), [Jopia handoff](../../handoffs/JOPIA-TO-LAT-PUBLIC-APPLICATIONS-2026-10-16.md), PA-ACCOUNT-03 / ADR-048.
- At the read-only merge check, `origin/main` remained `1d6e4a9`; it did **not** contain `fecdbaf`. Local integration is not upstream merge or deployment.

## Delivered frontend behavior

| Area | Result |
|---|---|
| Public application | Exact nested `PUBLIC_APPLICATION_V1` body to `/api/v2/onboarding/public-applications`; no deprecated submission route or entry credential |
| Fill Up | Server-owned random eligible selection with category/current-sample exclusion. Full four-step replacement, locally generated fresh password/confirmation, unchecked declarations. No localStorage availability or invented sixth sample |
| Sample identity | Retains catalog version, ID and instance. Editing a bound identity switches to manual (`sample:null`); registered/deleted eligibility remains server-authoritative |
| Failure/empty states | Exhaustion and failed reads preserve current draft/manual entry; sample conflict/stale/reserved/duplicate errors shown without silently replacing user edits |
| Documents | Exact category-specific slot/fixture references; attach/remove/replace and View route. Synthetic examples, no file upload or licensing-verification claim |
| Applicant identity | Single synthetic applicant reference; separate employee ID removed. Qualification role-holder references replace real names. Category-specific enum values match the published schema |
| Submission safety | Explicit action only; structured field errors navigate/focus the corresponding step. Required fixtures/declarations checked locally. Rate limits respect Retry-After; no automatic mutation retries |
| Ambiguous submission | Frozen body/key, navigation/edit lock, unload warning and explicit retry. Response sample must match the submitted instance. No new account is claimed on application success |
| Applicant status/detail | Existing applicant session and scoped status/withdrawal preserved; new own-application read shows retained values and declarations without passwords/PINs |
| PRC review | Cursor-paged list, detail and retained decision state. Public activation uses requestedLoginEmail from detail, prefilled read-only. Existing PIN/version/idempotency flow retained |
| Deregistration | Exposed only after a profile read establishes onboarded linkage, SUSPENDED state and operator capability. Warns terminal/non-destructive behavior. DEREGISTERED institutions have no reactivate/profile-edit controls |
| Profile | Retained facility/contact/qualification, fixture and login metadata, actual linked submission/approval/activation references. Null/purged or policy-defined profiles remain unavailable; no fabricated history |
| Layout | Existing field/card spacing, related-field rows, document cards and mobile form layout preserved |

The obsolete client-only sample generator was removed. Server availability is essential to the user's registered/deleted reuse rule; successful Fill Up reads do not consume samples.

## Live host gate — not satisfied

`VITE_BLOODLEDGER_PUBLIC_APPLICATIONS_READY` remains **unset/false** in the retained frontend. Production submission requires this deliberate deployment gate **and** a successfully parsed category catalog read. Tests enable the gate only in a separate synthetic preview build.

Read-only checks on Lat's host:

- Public sample catalog endpoint: **404** from the existing API.
- Migration `20261016010000000_create-public-onboarding`: **not applied**; `app.onboarding_sample_claims` absent.
- Pending migrations: **two**, `20261016000000000_create-outbound-verifications` and `20261016010000000_create-public-onboarding`.
- Retained components: 532. Retained onboarding applications: 0 at this inspection.
- No migration, deployment/restart, public application, activation, deregistration or model/census/population run was performed by this wiring task.

Consequently, live Fill Up reports the unavailable endpoint and preserves manual input. There is no runtime mock fallback. Final submission remains disabled. A test-enabled build is not suitable for redeploying the retained service before prerequisites are met.

## Checks

Node 24.17.0. Browser mutations use synthetic fixtures only and `--workers=1`.

| Check | Result |
|---|---|
| `npm run check:web` | PASS; existing >500 kB bundle advisory |
| `npm run test:web` | PASS, 415 tests / 47 files, including design tokens and strict public-contract mapping |
| `npm run test:e2e --workspace @bloodledger/web -- access-application.spec.ts institution-profile-accounts.spec.ts prc-supply.spec.ts --workers=1` | PASS, 21 tests |
| `npm run test:e2e --workspace @bloodledger/web -- --config playwright-public-application.config.ts --workers=1` | PASS, 17 tests in isolated readiness-enabled preview |
| `bash tests/accounts/postgres-integration.sh` | PASS, 310 assertions including the public-onboarding probe’s 160; disposable PostgreSQL only |
| `git diff --check` | PASS |

The enabled tests cover both categories, exact payload, no deprecated field, no POST from Fill Up, deliberate declarations, manual identity editing, sample exhaustion, each specified 409, fresh keys after definitive rejection, same body/key after ambiguous response, focused structured errors, Retry-After, fixed activation email/PIN and guarded deregistration/profile reads. Existing role/profile and PRC supply tests remain intact.

Jopia's backend handoff reports 196 API tests and 310 disposable integration assertions; those original counts remain Jopia self-validation, not frontend browser evidence. Lat independently reran `bash tests/accounts/postgres-integration.sh`: PASS, 310 assertions including the public probe’s 160. It built the API/chaincode test artifacts and used a temporary no-network/tmpfs PostgreSQL container; the cleanup trap removed only that test container. No retained migrations, accounts or domain rows were changed. This is one independent run, not a new claim of repeated backend runs or real Fabric acceptance.

## Next step

Return the [rollout and consistency follow-up](../../handoffs/LAT-TO-JOPIA-PUBLIC-APPLICATIONS-WIRING-AND-ROLLOUT-2026-10-16.md). Obtain scoped retained-host rollout authorization only after confirming the backend merge and resolving the two-migration plan. Do not infer authority for live registration/deletion from this successful fixture run.
