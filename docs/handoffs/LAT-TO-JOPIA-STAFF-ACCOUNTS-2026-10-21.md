# Lat → Jopia: staff accounts and local rollout — 2026-10-21

**SIMULATION_ONLY.** This covers the staff-account discussion, test-administrator
cleanup context, approved implementation, local activation, summary-card fix
and permission-label clarification. One user authorized the Lat/Jopia work in
this conversation; automated checks are self-validation, not an independent
teammate review. PRC staff expansion is deferred; DOH is excluded.

## Source to use

- Branch: `lat-sync-20261020`, pushed to `origin`.
- Staff implementation: **`67ff03e0c059099376a06f10cade8ae57f69e9c7`**.
- Its parent is `476e6a6`, the previous published Lat MVP handoff baseline.
- This handoff follows in a separate documentation commit on the same branch.
- No PR was created for this delivery.

Fetch the branch and inspect the staff commit before integrating it. Preserve
your own edits and the saved frontend layouts; do not reset a retained checkout
or replace its private configuration. Current remote main was `5a624d9` when
Lat fetched it for this publication. This delivery was not rebased onto that
new main; resolve integration against your actual branch deliberately.

```sh
git fetch origin
git show --stat 67ff03e0c059099376a06f10cade8ae57f69e9c7
git log -3 origin/lat-sync-20261020
```

Read AGENTS.md, the bloodledger-role skill and docs/TESTING-PHASE.md first.
PA-STAFF-01 in REQUIREMENTS.md, ADR-052 in ARCHITECTURE.md and the staff section
of DESIGN.md record the accepted behavior. Coordinate any ADR-number collision
on another integration branch rather than silently changing historical IDs.

## What changed

- Blood banks and requester hospitals now use **Add staff**, opening **Add
  institutional staff** below the directory on the right.
- A required, nonblank **Role / Job title** is free text, up to 80 characters.
  It is a display label, not a permission grant.
- **Access profile** is Administration or Role permissions. Administration uses
  ROLE-06. Role permissions selects an existing facility-appropriate role.
- Staff use the existing shared institution login and their individual operator
  PINs; adding staff does not create another interactive email/password login.
- Add, revoke and restore require an existing institution administrator's
  individual operator PIN. There is no new shared administrator secret.
- Active staff show Reset PIN and Revoke. Revoked staff show Reset PIN and
  Restore under the Revoked or All filter. Revocation preserves the record and
  history; resetting a PIN never restores revoked access.
- Reset PIN first verifies an administrator. Only then are replacement-PIN
  fields displayed. Approval expires after two minutes and is bound to the
  current session, administrator/version and target/version.
- PIN confirmation must match. Lat's existing host uses six-digit PINs; clients
  follow operatorPinLength from the session. Legacy eight-digit hosts retain
  their configured policy. Existing PINs/passwords were not changed here.
- The final active administrator cannot be revoked. Both UI and backend enforce
  this; the backend serializes concurrent changes and protects the legacy
  revocation path as well.
- Mutations use expected versions, correlation and idempotency keys. Uncertain
  outcomes retain an exact frozen attempt for explicit retry, bound to its
  original administrator. They are not automatically retried.
- Successful changes refresh the staff directory and authorized operator list.
  Old grants/sessions are not revived by restoring an operator.

### Permission names: resource versus UI wording

REQUIREMENTS.md defines **ROLE-01 Medical Technologist** (scan/custody work) and
**ROLE-02 Hospital Administrator** (inventory oversight and request decisions).
The bank dropdown maps to those existing IDs. It currently describes ROLE-02
as **Hospital coordinator · requests, approval and blood operations**; that
wording was added by Lat and explicitly clarified to the user. It is not a new
role from the manuscript. The user accepted the explanation and requested this
commit. ROLE-03 is the requester operational permission set. A typed job title
does not change any of these permissions. Administration is a separate access
profile from the operational ROLE-02 permission set.

### Summary cards now agree with the table

Default status is Active. Operators, Active, Administrators and Revoked count
the same status/search-filtered dataset as the table, across all pages. Missing
reads show unavailable counts, not invented records. The security check for the
last administrator uses the full institution roster regardless of table filters.

Mediatrix has four historical records, including a previously revoked test
administrator. The earlier user-requested revocation remains intact; nothing
was deleted or reactivated by this rollout.

| Filter | Operators | Active | Administrators | Revoked |
|---|---:|---:|---:|---:|
| Active | 3 | 3 | 1 | 0 |
| All | 4 | 3 | 2 | 1 |
| Revoked | 1 | 0 | 1 | 1 |

The old mismatch occurred because cards counted the full historical roster
while the table initially showed active staff only.

### Local account-switcher compatibility

The explicitly enabled development toolbar now works on both localhost:5174
and 127.0.0.1:5174. Bounded fetch timeouts prevent indefinite Loading accounts.
The local review middleware canonicalizes only same-origin localhost API
requests to the existing configured loopback origin before proxying. Foreign
origins/public hosts remain restricted; API origin policy was not broadened.
No private credentials are returned by the toolbar or included in Git.

## Backend and ledger integration

Published schemas are in services/api/openapi-v2.json. Additive routes:

```text
POST /api/v2/staff
POST /api/v2/staff/{id}/revoke
POST /api/v2/staff/{id}/restore
POST /api/v2/staff/{id}/reset-pin-approval
POST /api/v2/staff/{id}/reset-pin
```

Creation uses the institution version. Other changes use the target operator
version. Staff administration returns synchronous off-chain results; it is not
a blood-stock command and does not require command polling. Final PIN reset
uses the short-lived Staff-Reset-Approval header instead of a second PIN prompt.
The server checks that approval independently; it is not a general command
verification bypass. See the OpenAPI schemas and errors rather than inventing
request bodies from this summary.

The additive migration is
`database/migrations/20261021000000000_add-institution-staff.js`:
job-title metadata plus session/subject-bound PIN-reset approvals. There is no
automatic down migration for retained staff history.

New operational staff receive their own opaque USR_STAFF_ actor IDs. The worker
checks active staff/account/institution rows under shared locks through ledger
endorsement/commit. The existing authenticated gateway supplies transient
institution_staff_v1 evidence bound to the exact proposal, actor, institution,
role and operator version. Chaincode permits only existing supported
institution/operational-role pairs; it does not impersonate a static operator
or add a Fabric member. Titles, PINs and raw credentials stay off the ledger.
Existing actor-policy files and existing opaque attribution are preserved.

**API, worker and chaincode must match.** Do not deploy just the new API and
create operational staff against an old ledger. The compatible API advertises
SYNTHETIC_INSTITUTION_STAFF_V1/session capabilities; older APIs keep legacy
controls. Runtime staff authorization is not created by copying this handoff.

## Lat host: already activated and verified

The user explicitly authorized the staff migration and matching local API/ledger
deployment. That authorization applies to Lat's local host, not to Jopia's host.
A fresh custom-format backup was validated before changing anything. Writers
were quiesced; the queue and population lock were empty.

- Applied only the new staff migration: **42 applied, 0 pending**.
- Ledger: **institution-staff-v1, sequence 8**, existing chaincode name and
  endorsement policy unchanged. Package verified by the deployment script.
- Matching API/worker build uses immutable private build copies and the
  existing runtime configuration/flags. Builds ran as ordinary UID/GID with
  Node 24.17.0; foreign-owned build entries were zero.
- API health READY; localhost:5174 returns HTTP 200. Web, guarded UAT worker and
  existing dedicated checkpoint service are running. General sync-worker stays
  stopped. Previous API/web containers remain stopped as preserved fallbacks.
- All six accounts passed ordinary login/profile-read checks. Staff is enabled
  for the three banks and Metro Lipa; PRC/DOH staff expansion remains deferred.
- Live browser checks passed for those four facilities: Add staff editor,
  facility-specific permission options, filtered cards/table counts, revoked
  actions, last-administrator UI protection and six toolbar accounts.
- Gateway evaluation confirmed existing component readability and required
  ledger methods, without a live domain write.

Protected counts and row fingerprints matched before migration, after migration,
after API deployment and after live read-only browser checks:

| Retained records | Before / after |
|---|---|
| Institutions / application users / operators | 9 / 24 / 13, unchanged |
| Onboarding applications / account audit | 1 / 11, unchanged |
| Components / reservations / commands | 535 / 27 / 598, unchanged |
| Forecast runs | 1, unchanged |

Outbound/receipt verifications and request details/documents stayed empty.
Pending V2/V1 queues and population writer lock stayed zero; 598 commands remain
committed. No new staff, PIN reset, restore, revocation or blood transaction was
submitted as a live test. No population, census/forecast rerun, reset, credential
change or identity change accompanied activation.

Full evidence and artifact hashes:
[staff validation](../validation/lat-institution-staff-2026-10-21/README.md).
Private backup, credentials, container configuration and live screenshots remain
only in ignored build directories on Lat's host. They are not part of this push
and must not be copied into a PR/message.

## Validation and reproduction

- Exact published staff-only source: check:web passed; **488 web tests passed**.
  The local tree had 491 including three separately unpublished phone tests.
- API type/static checks passed; **246 API tests passed**.
- Ledger type/static checks passed; **48 ledger tests passed**.
- Disposable PostgreSQL 17.10: **32 staff lifecycle checks**, all 42 migrations.
- Disposable actual HTTP login/PIN/reset flow: **15 checks passed**.
- Staff/profile plus desktop web Playwright run: **58 passed, 7 skipped**.
- Final affected staff/profile run including filtered-count regression:
  **8 passed**. Local toolbar tests: **12 passed**.
- Formatting, design-token tests, whitespace checks and history/index/candidate
  secret scans passed. The published build checksum has one exact path-scoped
  scanner exception; it is not a credential.

Use Node 24.17.0 and rg on PATH. Run check:web, test:web, check:api, test:api,
check:inventory-contract and test:inventory-contract. Browser command:

```sh
npx playwright test e2e/institution-staff.spec.ts e2e/institution-profile-accounts.spec.ts --workers=1
```

Run in mcr.microsoft.com/playwright:v1.61.1-noble with normal networking,
ordinary UID/GID and DejaVu fonts. Do not use --network none. The validation
README gives the disposable-database probe prerequisites. Never point those
probe scripts at retained data.

## Jopia: integration and host rollout instructions

1. Review the source/ADR/OpenAPI and integrate with your current branch while
   preserving other work. This commit includes the staff changes only, plus
   related local review fixes. Earlier phone-only scanner work remains local
   and uncommitted on Lat; do not assume it is in this delivery.
2. Rerun the checks on your integrated source. Pay particular attention to
   operator selection, frozen retries, staged reset approval, revoked status,
   concurrent last-administrator protection and new-actor ledger authorization.
3. Before any retained-host rollout, obtain authorization for **your** target.
   Inventory your actual migration history, ledger version, queues, running
   workers and configuration. Lat's 42/sequence-8 state is not your baseline.
4. With target authorization, take and validate a fresh private backup, quiesce
   writers, confirm only the reviewed migrations are pending, and apply them
   with the documented migrator. The Lat rollout used
   BLOODLEDGER_MIGRATION_COUNT=1; do not use it blindly if your pending set differs.
   Compare protected counts/fingerprints before and after. Never edit a migration
   that has already been applied.
5. Deploy the matched ledger using
   `bash network/scripts/deploy-institution-staff.sh --apply bloodledger-local`
   on the approved target. It checks the existing policy and advances the actual
   lifecycle sequence; do not hard-code sequence 8 on another host. Deploy
   matching normal-user API/worker builds with your own private configuration.
   Start web only after API health and ordinary scoped reads pass. Restore only
   the previously approved worker set after checking queues.
6. Stop at a failed gate and report the exact safe error. Do not reset, repopulate,
   replace credentials, roll back history, activate models or retry another
   deployment approach to get around a failed gate. Do not create a live test
   staff member or blood transaction without a separate bounded test decision.
7. Report your own target source, migration/ledger versions, checks and counts.
   Physical-device evidence and a new staff member's live ledger transaction
   remain unperformed; passing fixtures do not establish those results.

Lat can continue frontend polishing from the published staff source. PRC staff
management remains the next separate design/authorization discussion. No
clinical, regulatory or production-readiness claim is made by this delivery.
