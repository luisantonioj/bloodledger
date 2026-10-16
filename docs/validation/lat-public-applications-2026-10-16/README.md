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

## Initial live host gate — historical, superseded by the rollout below

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


## Authorized PR #68 retained-host rollout — stopped at API build gate

The user relayed Jopia's D1–D5 authorization on 2026-10-16. PR #68 is merged at
**`d83509bf333d073061c3cb125ac4914798ee8ab0`**, including fix `fcacc2b`.
It was merged into Lat's saved wiring at `35d86f3`. Both prior discrepancies
are resolved: approval/rejection anchors retention; capability declarations
are excluded from the durable profile. The frontend now maps
`ONB_APPLICATION_DETAIL_PURGED` to a reapplication message and blocks retry;
one additional synthetic browser scenario covers it.

Frontend checks after this merge: `npm run check:web` PASS, `npm run test:web`
**415 / 47 files** PASS (including design-token checks); default affected
Playwright **21 PASS**, isolated public-enabled suite **18 PASS**;
both use `--workers=1`. No live web build was enabled. The earlier 17-test
and disposable 310-assertion results above belong to the pre-fix baseline;
Jopia reports 325 disposable assertions for the corrected backend.

### Completed gates

1. Checked out exact merged-main `d83509b` in detached mode in the retained
   checkout. Local `main` is attached to another checkout; it was not altered.
   Migration status listed exactly the two authorized pending files.
2. Stopped retained web/API, verified both workers stopped. Pre-stop queues:
   V1 0, V2 0, population writer lock 0. No volumes or identities removed.
3. Took custom-format PostgreSQL dump and validated `pg_restore --list`.
   Private dump: ignored `build/lat-public-rollout-private/before-public-rollout.dump`
   (0600, parent 0700). **SHA-256:
   `2a47f8b66f93c7c189f7ff9bec123759c6e1aaac0ed95ca94312c886e725e263`**.
4. Baseline counts and both post-migration comparisons matched:

| Table | Before | After outbound | After public |
|---|---:|---:|---:|
| institutions | 9 | 9 | 9 |
| application_users | 22 | 22 | 22 |
| onboarding_applications | 0 | 0 | 0 |
| account_audit | 6 | 6 | 6 |
| v2_components | 532 | 532 | 532 |
| v2_reservations | 27 | 27 | 27 |
| v2_commands | 595 | 595 | 595 |

5. Ran each separately with `BLOODLEDGER_MIGRATION_COUNT=1 npm run migrate:up`:
   outbound first, public second. History advanced **32→33→34 applied**,
   pending **2→1→0**. All new tables (`v2_outbound_verifications`,
   `onboarding_sample_claims`, `institution_profiles`) are empty.
   Sanitized status outputs: [before](before-migration-status.txt),
   [after outbound](after-outbound-migration-status.txt),
   [after public](after-public-migration-status.txt).

### First failed gate — stopped, no self-directed recovery

At step 6, `npm run build --workspace @bloodledger/api`, from exact `d83509b`,
failed with TypeScript **TS5033 / EACCES** writing generated files under
`services/api/build`, including `src/public-onboarding.js` and
`src/blood-bank-reads.js`. Inspected files are `root:root`, mode `0644`.
The earlier disposable integration suite built generated API artifacts through
Docker as root; the subsequent host-user build cannot overwrite them.

The `docker start` was chained after successful build and **did not run**.
Compilation may have partially updated generated artifacts; do not start this
API until a clean successful build from the recorded target is confirmed.

Following Jopia's explicit “stop at the first failed gate, restore nothing
yourself” instruction, no chmod/chown, alternate builder, rollback, restore,
restart or further readiness probe was executed. **API/web remain stopped.**
D5 remains unmet: the public flag is still unset/false, web deployment and live
browser Fill Up checks are **NOT_RUN**. Source was returned to Lat's integrated
branch for the frontend PR only; services were not restored by that switch.

**No live application, activation or deregistration was performed.** No reset,
population, census/forecast rerun, account creation or Fabric change occurred.
[Machine-readable gate result](RETAINED-ROLLOUT.json).

### Continuation decision for Jopia

Authorize a narrowly scoped generated-artifact build recovery (for example,
build the exact target using the existing pinned Node container, or repair
ownership only in the generated API build directory), then resume step 6.
Do not rerun either applied migration. Confirm the read-only catalog,
selection, PRC list and unchanged counts before D5/web deployment. The intended
frontend build reference is `35d86f3` plus this evidence update; actual enabled
web build remains **NOT_DEPLOYED**.

### Branch delivery

The existing remote `codex/lat-analytics-activity-layouts` diverges from Lat's
saved rebased work. No force-push is used. Delivery uses
`codex/lat-public-application-integration-20261016`, preserving the saved work
and icon commit. PR reference is recorded after creation.
