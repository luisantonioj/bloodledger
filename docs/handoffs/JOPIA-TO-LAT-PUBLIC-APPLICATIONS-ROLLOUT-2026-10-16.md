# Jopia → Lat: public applications — decisions, merge and retained-host rollout

Date: 2026-10-16, Asia/Manila. **SIMULATION_ONLY**. Reply to your wiring report.
Contract: [public-applications handoff](JOPIA-TO-LAT-PUBLIC-APPLICATIONS-2026-10-16.md)
(its "Follow-up" and "Host prerequisites" sections were corrected in PR #68).

## Your two questions — resolved in PR #68 (`fcacc2b`)

1. **Retention anchor.** The code was right and the handoff was wrong: approval
   or rejection closes the application (ADR-039), not activation. New: activation
   after the 30-day purge returns 409 `ONB_APPLICATION_DETAIL_PURGED` (tell PRC
   the facility must reapply; do not retry). The same purge releases the sample
   of an approval that was never activated (`release_reason` `APPROVAL_LAPSED`).
   Render returned dates only, as you do now.
2. **Declarations.** The handoff was right and the code was wrong.
   `facilityProfile.qualification` no longer contains `capabilityDeclarations`.
   Keep showing declarations only in scoped application detail.

Please map `ONB_APPLICATION_DETAIL_PURGED` in the PRC activation dialog and add
one fixture test for it. No other contract changed.

## Decisions (accountable owner Jopia, 2026-10-16)

| # | Decision |
|---|---|
| D1 | Retention stays anchored on approval/rejection (ADR-039). |
| D2 | Capability declarations are excluded from the durable facility profile. |
| D3 | **Authorized:** staged rollout of **both** additive migrations, outbound `20261016000000000` then public `20261016010000000`, and the merged `main` API to **Lat's retained host**, executed by Lat under the gates below. A public-only rollout is impossible (filename order), so this authorization explicitly covers the outbound migration and its already-merged routes. |
| D4 | **Not authorized:** any live public submission, PRC activation, deregistration, reset, population, account creation or Fabric change on the retained host. Readiness checks are read-only. A live end-to-end run needs a separate bounded plan. |
| D5 | Enable `VITE_BLOODLEDGER_PUBLIC_APPLICATIONS_READY` only after rollout step 6 passes. |

## Merge reference

> **Superseded target (2026-10-16):** after gate 6 stopped on root-owned build
> files, the rollout target moved to `1124d6a` (PR #70). It has the same
> application source as `d83509b`. Steps 6–7 continue under
> [the build-recovery authorization](JOPIA-TO-LAT-BUILD-RECOVERY-2026-10-16.md).
> The text below is kept as originally sent.

PR #68 is merged into `main` as merge commit
`d83509bf333d073061c3cb125ac4914798ee8ab0`. Deploy exactly that commit (or a
later `main` that you record) and put the SHA in your evidence.

## Retained-host rollout (D3)

Stop at the first failed gate, restore nothing yourself, and report.

1. `git fetch` and check out `d83509b` on `main`. Confirm
   `npm run migrate:status` lists exactly `20261016000000000` and
   `20261016010000000` as pending.
2. Quiesce writers (API, workers). Stopping must preserve data; no volume removal.
3. Take a custom-format PostgreSQL backup, validate it with `pg_restore --list`,
   and record its SHA-256. The private dump stays out of Git.
4. Record counts: `app.institutions`, `app.application_users`,
   `app.onboarding_applications`, `app.account_audit`, `app.v2_components`,
   `app.v2_reservations`, `app.v2_commands`.
5. Run `BLOODLEDGER_MIGRATION_COUNT=1 npm run migrate:up` (outbound), then
   recheck counts and `migrate:status`. Run it again (public), then recheck.
   All recorded counts must be unchanged. The new tables
   `app.v2_outbound_verifications`, `app.onboarding_sample_claims` and
   `app.institution_profiles` must be empty.
6. Deploy the merged API, then do read-only checks:
   `GET /api/v2/onboarding/sample-facilities` returns 200 with ten `ELIGIBLE`
   samples; `GET …/sample-facilities/selection?category=BLOOD_BANK` and
   `…REQUESTOR` return `SELECTED`; `GET /api/v2/onboarding/applications` as PRC
   returns 200; counts are still unchanged.
7. Build and deploy the web app with the flag enabled (D5). In the browser,
   check read-only: Fill Up fills all four steps, ticks no checkbox and sends
   no POST. Do not press Submit (D4).

## Your frontend branch

Rebase or merge your saved wiring (`eee9f4e`) onto `d83509b`.
Add the `ONB_APPLICATION_DETAIL_PURGED` mapping, rerun `npm run check:web`,
`npm run test:web` and the affected Playwright specs with `--workers=1`, then
push and open your PR against `main`. Update `docs/frontend/BACKEND_API_GAPS.md`
(GAP-20/22) and `APPLICATION_PROFILE_FIELD_MAP.md` to the delivered contract.

## Report back

Record the merge SHA, backup SHA-256, before/after counts, `migrate:status`
output, read-only check results, the web build reference and your PR link in
`docs/validation/lat-public-applications-2026-10-16/`. State explicitly that no
live application, activation or deregistration was performed. This rollout does
not establish clinical, regulatory or production readiness.
