# Institution staff management — 2026-10-21

SIMULATION_ONLY. PA-STAFF-01 / ADR-052. Implemented and activated locally for blood banks and
requester hospitals. PRC expansion is deferred; DOH is excluded. Lat implemented
frontend and backend under the user's approved plan. Automated checks are
self-validation, not independent teammate review.

## Delivered source

- Add staff opens Add institutional staff. Job title is required and limited to
  80 characters; titles do not grant permissions.
- Administration grants ROLE-06. Role permissions selects existing bank
  ROLE-01/02 or requester ROLE-03. Changes require an existing administrator's
  individual PIN and the host's configured PIN length.
- Revoke/restore preserve history. Revoked staff remain visible under
  Revoked/All, with Reset PIN and Restore. PIN reset does not reactivate staff.
- Concurrent revocations cannot remove the last active administrator. The
  legacy revocation entry point also checks this condition.
- Reset PIN first verifies an administrator, then displays replacement-PIN
  inputs. Its two-minute approval is bound to account, session, administrator
  version and target version. Final submission binds one body/key; exact retries
  return the original result. PINs are hashed and excluded from audit results.
- Unknown outcomes freeze the attempt for explicit retry; no automatic mutation
  retries. Successful changes refresh the directory and operator roster.
- New operational staff retain their own actor identity. The gateway supplies
  a transient attestation bound to the exact ledger proposal. Worker checks
  active staff/account/institution authority under shared locks through commit;
  chaincode restricts authority to existing institution/operational-role pairs.
  Titles and PINs never enter ledger assets or transient evidence.
- A compatible session advertises staffManagementPolicyVersion or staff action
  capabilities. Older API hosts keep the existing controls until activation.

Contracts: `services/api/openapi-v2.json`, additive `/staff` routes.
Migration: `database/migrations/20261021000000000_add-institution-staff.js`.
Ledger rollout: `network/scripts/deploy-institution-staff.sh`, targeting
`institution-staff-v1`. The script was syntax-checked and subsequently deployed under the explicit local rollout approval.

## Validation

Node 24.17.0; synthetic fixtures only. Playwright uses
mcr.microsoft.com/playwright:v1.61.1-noble, ordinary UID/GID, DejaVu fonts,
normal networking and --workers=1.

| Check | Result |
|---|---|
| check:web / test:web | Pass / 488 tests in the exact staff publication; 491 in the local tree including separate phone work |
| check:api / test:api | Pass / 246 tests passed |
| check:inventory-contract / test:inventory-contract | Pass / 48 tests passed |
| check:format | Pass |
| Staff/profile plus web.spec.ts browser suite | 58 passed, 7 skipped |
| Final staff/profile browser rerun with summary-filter regression | 8 passed |
| Disposable PostgreSQL 17.10 lifecycle probe | 32 checks; 42 migrations |
| Disposable actual HTTP login/PIN/reset probe | 15 checks passed |
| Secret scan, history/index/candidate files | Pass; final scan recorded below |
| git diff --check and rollout-script Bash syntax | Pass |

The database probe covers roles, scope, versions, replay/conflict, revoked PIN
reset, expired/session-mismatched approvals and concurrent administrator
revocation. HTTP checks require normal login and bound PIN verification; missing
approval, foreign origin and changed reset retries fail. Ledger fixtures cover
new operators at all three existing banks and requester proposal authorization.
No live new-staff ledger transaction was performed.

Reproduce only in a fresh disposable PostgreSQL 17.10 database named
bloodledger_staff_test, localhost port 56541, trust authentication, with no
retained volume. Build API, then run:

```sh
node services/api/test/institution-staff-database-probe.mjs
node services/api/test/institution-staff-http-probe.mjs
```

The first creates fresh test roles and applies migrations. The second uses that
fixture database. Synthetic screenshots were visually reviewed under ignored
build/institution-staff-preview-20261021/. Private backup/configuration and
fingerprints remain in ignored build/institution-staff-private-20261021/.

## Initial retained-host stop before explicit activation approval

After verifying empty queues and writer lock, existing writers were stopped and
a fresh custom-format backup was validated with pg_restore --list. Automatic
approval review rejected the migration plus ledger deployment: implementation
approval did not explicitly authorize persistent live activation. That command
did not run, and no alternate activation was attempted.

Original API/web/checkpoint service and guarded UAT worker were restored.
API /healthz READY; frontend localhost:5174 HTTP 200. General sync-worker remains
stopped. Migration status: 41 applied, 1 pending (only the staff migration).
No retained staff creation, PIN change, revoke or restore occurred in this task.

| Protected table | Before / after |
|---|---|
| Institutions | 9 / 9 |
| Application users | 24 / 24 |
| Institution operators | 13 / 13 |
| Onboarding applications | 1 / 1 |
| Account audit | 11 / 11 |
| V2 components | 535 / 535 |
| V2 reservations | 27 / 27 |
| V2 commands | 598 / 598 |
| Forecast runs | 1 / 1 |

Protected fingerprints also match. Pending V2 commands, pending V1 scans and
population writer lock are zero; 598 commands remain committed. Existing data,
accounts, PINs, identities, volumes, forecasting and earlier phone UI remain
preserved. Publication was requested after this validation; see the Jopia staff handoff for the published code reference.

## Authorized local activation — completed

The user explicitly authorized: “Apply the staff migration and deploy the
matching API and ledger changes locally,” and requested that summary cards
agree with the staff table. This supersedes the earlier activation stop only
for this local staff rollout. No live staff or blood transaction was authorized
as a test or executed.

A fresh validated custom-format PostgreSQL backup and protected-data
fingerprints were taken after quiescing the existing API/web, guarded UAT worker
and checkpoint service. Private evidence lives under
`build/institution-staff-activation-private-20261021/`. The new backup SHA-256 is
`73df360135deb3d60736cd1f8f834a43301ecc5790fa35120e77629e3ec5eff0`.
The earlier backup was preserved.

- Before: 41 migrations applied, only the new staff migration pending;
  pending V2/V1 commands and population writer lock zero.
- Applied exactly `20261021000000000_add-institution-staff` with the documented
  migrator and `BLOODLEDGER_MIGRATION_COUNT=1`. After: **42 applied, 0 pending**.
  All protected row counts and fingerprints matched before/after.
- Deployed `institution-staff-v1` at **sequence 8**, preserving chaincode name,
  endorsement policy, identities, namespaces, existing assets and volumes.
  Verified package:
  `bloodledger-institution-staff-v1_37c5f67bef19:362d3d50bdf19d04df82dd9a7dfbef8603b4322482c3b3dbbc37ff369d579d3b`.
- Built API/coordination as normal UID/GID using Node 24.17.0. Foreign-owned
  build entries: 0. API uses immutable build copies in the private evidence
  directory, preserving all previous configuration and flags. Prior API/web
  containers remain stopped and retained as before-staff fallbacks.
- Build base is commit `476e6a6`; the staff/phone/UI work remains uncommitted.
  API build tree SHA-256:
  `f3adc953c229a89bd1902bce55b417e1a2e274e326389bb67faea938ade247c7`.
  Coordination build tree SHA-256:
  `6f6d7dcf058836fecf962e3d21f68b24e1ab1dfe470e8161d7c1225527e4a8e7`.
  Private `build-reference.json` records full base and build hashes. Deployed
  staff/worker files were compared byte-for-byte to the tested build.
- API health READY; ordinary login/profile reads passed for all six existing
  accounts. The staff policy is READY for the three banks and requester, and
  remains deferred for PRC/DOH. Gateway evaluation verified existing component
  readability and required ledger methods without a domain transaction.
- Restored web on port 5174, the unchanged dedicated checkpoint service and
  guarded UAT worker after the empty-queue check. General sync-worker stays
  stopped. No census/forecast rerun, population, reset or identity change.
- Live browser checks through `http://localhost:5174/` passed for Mediatrix,
  Medix, N.L. Villa and Metro Lipa using ordinary login forms. Add staff is
  enabled; role fields and institution-specific permission sets are editable;
  last active administrator Revoke is disabled; revoked rows expose Reset PIN
  and Restore; all six toolbar accounts load. Screenshots remain private.
  No staff mutation or PIN-verification submission was made in these live checks.

### Summary-card correction

Previously the cards counted all staff, while the table initially filtered
Active. Mediatrix has four historical records: three active, one revoked;
its two historical administrators include one revoked administrator. Cards now
use the same status/search-filtered dataset as the table, across all pages.

- Mediatrix Active: Operators 3, Active 3, Administrators 1, Revoked 0.
- Mediatrix All: Operators 4, Active 3, Administrators 2, Revoked 1.
- Mediatrix Revoked: Operators 1, Active 0, Administrators 1, Revoked 1.

The underlying last-active-administrator guard still counts the full institution,
not a filtered table. Browser fixtures cover all status filters, title search
and an empty match. Actual host counts were checked for all four facilities.

### Local review origin compatibility

The opt-in local toolbar supports localhost and 127.0.0.1 on port 5174. Its
middleware normalizes only same-origin localhost `/api/` requests to the
configured loopback API origin before proxying. Mismatched origins/public hosts
remain restricted; the API origin policy itself was not broadened. Requests
have bounded toolbar-load timeouts instead of an indefinite Loading state.
The local switcher tests pass (12 cases); full web tests pass (491).

### Final preservation check and limits

The protected counts in the table above also match after activation, ordinary
login/profile reads and browser verification; fingerprints match as well.
Other checked tables (outbound verifications, receipt verifications, request
details and documents) remain empty. All 598 V2 commands remain committed;
pending V2/V1 and writer lock remain zero. No staff record, PIN, audit record,
blood component, reservation or forecast was changed by live testing.

Physical-device staff tests and a live domain transaction by a newly created
staff member remain unperformed. Creation/revoke/restore/reset and new-actor
ledger authorization are covered by disposable database/HTTP and deterministic
ledger fixtures. No clinical, regulatory or production readiness is claimed.
The initial activation used local uncommitted source. The subsequently requested staff commit/push is recorded in the Jopia handoff; no PR was requested.

Final scanner review identified the published API build checksum above as a
false positive. A path-scoped exact-checksum allowlist preserves the full
artifact evidence without weakening credential scanning elsewhere. The final
history/index/candidate scan passes with that reviewed exception.


## Publication scope verification

Before publication, the staged staff-only tree was exported to an ignored
snapshot and checked independently: check:web passed; 56 web test files and
488 tests passed. The local working tree includes three additional tests from
the earlier phone-scanner work (491 total), which is not included in this staff
commit. Staff-only hunks were staged in application.tsx, global.css and DESIGN.md;
the remaining phone edits were left untouched. Deployment evidence above refers
to the local running tree at the time of the authorized rollout.
