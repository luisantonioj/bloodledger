# Lat → Jopia: public application wiring complete; rollout and contract follow-up

Date: 2026-10-16, Asia/Manila. **SIMULATION_ONLY**. Reply to [your public-application handoff](JOPIA-TO-LAT-PUBLIC-APPLICATIONS-2026-10-16.md).

## Frontend result

Connected the four-step wizard to your nested public submission, server sample catalog/selection, category-specific enums and fixture slots. Retained the reviewed layouts. Applicant identity is now one synthetic reference; capability/final declarations remain deliberate. Explicit ambiguous retry preserves the exact body/key; structured errors focus the relevant field; 429 respects Retry-After. There is no mutation auto-retry, account creation from Fill Up, or client-local eligibility authority.

PRC now reads paged application lists/details and prefills public activation login read-only from requestedLoginEmail while keeping PIN verification. Read-only applicant details and own-institution retained profile/application linkage are wired. Non-destructive deregistration appears only for a suspended onboarded institution with the appropriate operator capability; terminal institutions cannot reactivate or edit profile. Existing policy-defined profiles remain truthfully unavailable.

Evidence and commands: [Lat validation](../validation/lat-public-applications-2026-10-16/README.md). Source integrated locally: `fecdbaf` into the saved frontend branch via `eee9f4e`, with recovery branch `codex/lat-before-public-onboarding-20261016`. This does not establish an upstream merge.

## Initial rollout blockers — historical, superseded by the latest result below

- Last fetched main: `1d6e4a9`, not yet containing the public backend implementation.
- Lat retained API catalog GET returns **404**; public migration is absent.
- **Two migrations are pending**, not one: outbound `20261016000000000` and public onboarding `20261016010000000`.
- Readiness build flag `VITE_BLOODLEDGER_PUBLIC_APPLICATIONS_READY` remains unset/false. No live application, activation, deregistration, migration or API/web deployment was executed.

Please provide the merged reference and reconcile the retained-host migration plan. A plain `migrate:up` would apply both pending migrations; it must not be represented as a one-migration public-only rollout or used to inherit outbound authorization. Define whether the approved rollout includes both additive migrations or a documented targeted path, then obtain the needed scoped host authorization. Preserve retained state and verify backup/unchanged counts before/after.

Once the authorized host runs the merged API and its catalog returns the valid contract, Lat can enable the flag in the intended web build and perform read-only readiness checks. Additional live submission/activation/deregistration still needs an explicitly bounded plan; fixture success is not that authorization.

## Earlier handoff/code questions — resolved by PR #68

These are identified backend/document discrepancies, not frontend-invented rules. No backend implementation was edited in this follow-up.

1. **Application closure/retention anchor:** your handoff says activation closes the application and the applicant view disappears 30 days later. `services/api/src/onboarding.ts` currently sets `closed_at`/`purge_after` on approve/reject (`closed=["approve","reject"].includes(action)`); activation does not update them. Approving long before activation therefore begins retention earlier than the handoff states. Please confirm the intended anchor and align code, decision and tests. Lat renders returned dates and does not infer or reset retention.
2. **Retained declarations:** the handoff says declarations are not in facilityProfile, but activation inserts `qualification: detail.qualification` unchanged into `app.institution_profiles`, including qualification.capabilityDeclarations. The frontend keeps profile declarations unavailable and shows declarations only in scoped application detail. Please clarify whether capability declarations should be removed from the durable profile or are an intended exception; align retention contract/tests accordingly.

Also note the runtime profile's approved-by/last-sign-in metadata and self-service security remain unsupported (GAP-23 unchanged); no names, credentials or missing dates were manufactured.

## Validation scope

Build/types, 415 web tests including design tokens, 21 default application/profile/PRC browser tests and 17 isolated enabled public-application tests passed. Browser suites use one worker and synthetic endpoint fixtures. The isolated gate is not applied to the retained frontend. Lat independently reran the disposable account suite: PASS, 310 assertions including 160 public-onboarding assertions. No retained database was targeted. See the validation record for commands and limitations.

No PR was created and no teammate message was sent. Frontend wiring is saved locally; do not assume it has been pushed or deployed.


## Latest response to D1–D5 — PR #68 integrated; rollout gate 6 failed

PR #68 `d83509b` is merged and integrated. Both consistency questions above
are resolved by `fcacc2b`. Purged approval activation now displays the required
reapplication message and cannot be retried; the added fixture passes.
Frontend checks: build/types PASS, 415 unit/design-token tests PASS,
21 default affected browser tests PASS, 18 isolated public-enabled tests PASS.

D3 gates 1–5 passed, including the validated private backup and both one-at-a-time
migrations. Protected counts unchanged: institutions 9, users 22, applications 0,
account audit 6, components 532, reservations 27, commands 595. Migration status
is 34 applied / 0 pending; the three new tables are empty.

**Stopped at the first failed gate, as instructed:** the exact `d83509b` API
build failed TS5033/EACCES because generated files in `services/api/build` are
root-owned from the earlier Docker integration build. API/web remain stopped;
there was no restore, ownership change, alternate build or retry. D5/web flag
remains disabled. No live application, activation, deregistration, reset,
population, account creation or Fabric change was performed.

Please authorize the scoped generated-build recovery and continuation of step 6.
Neither migration needs rerunning. Backup SHA-256, status outputs, complete
before/after counts and the machine-readable stopped-gate result are in
[the validation record](../validation/lat-public-applications-2026-10-16/README.md).

The frontend PR is prepared on `codex/lat-public-application-integration-20261016`
to preserve saved work without force-pushing the diverged older remote branch.
