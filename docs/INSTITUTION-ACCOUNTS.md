# Institution accounts — Jopia delivery

Status: implementation and isolated self-validation delivered; retained-host
migration, Fabric deployment and Lat frontend integration are pending.
Classification: **SIMULATION_ONLY**. Authorized by Jopia on 2026-10-08 in response
to [Lat PR #24](https://github.com/luisantonioj/bloodledger/pull/24).
Branch: `codex/jopia-institution-accounts`; exact retained integration base:
`daf4ada29b5a0346a804815817fde64f4893a390`. The original Lat checkout remained
at `6e26606b6e5bdb56f8c772758790eb226646dc11` and was not modified.
Jopia supplies backend/database/Fabric behavior. Lat owns UI integration and
independent retained-host validation; this delivery does not accept that review.

## Decisions and authoritative contracts

[ADR-036–039](ARCHITECTURE.md#accepted-institution-account-architecture--2026-10-08)
and [PA-ACCOUNT-01/02](REQUIREMENTS.md#pa-account-01--approved-synthetic-institution-accounts-2026-10-08)
supersede login-equals-role, selected Medix/N.L. Villa application restrictions,
and PRC read-only administration within the approved synthetic scope. Existing
role IDs, one Mediatrix MSP/peer and endorsement remain. RQ-14 real-world
retention and RQ-09/10/12/15 operational decisions remain unresolved.

Executable truth lives in these artifacts:

- [Account/operator/retention policy](../services/api/policy/institution-accounts-v1.json):
  six initial logins, eight-digit PINs, five failed attempts, fifteen-minute
  lockout, two-minute command grants and thirty-day retention.
- [Login and session contract](../services/api/openapi.json) and
  [V2 verification/onboarding contracts](../services/api/openapi-v2.json).
- [Additive Fabric policy](../chaincode/policy/institution-core-v1.json), version
  `SYNTHETIC_INSTITUTION_CORE_V1`; earlier policies are retained unchanged.
- Forward migrations `20261008010000000`, `20261008020000000`,
  `20261008030000000` in [database migrations](../database/migrations).
  Do not edit applied migrations or downgrade these identity/evidence tables.

Scope links: FR-01, FR-03–16, BR-SEC-03–05, BR-ONB state/authorization rules,
NFR-01/13, BL-WEB-01, BL-API-02, BL-WEB-05/06 and BL-TST-02. This synthetic
extension does not authorize UAT, V5 activation, physical OCR acceptance,
real institutional onboarding, model changes or deployment.

## Identity and retained mapping

The account policy defines the six email identifiers and new institution IDs.
ROLE01/ROLE02 review principals become Mediatrix operators without interactive
credentials. ROLE03/ROLE04/ROLE06 preserve their original institutions, actor
references and history and become retired. ROLE05 remains separate internal
maintenance. New banks, Metro Lipa, PRC and DOH receive distinct primary users;
Medix/N.L. Villa/Metro operators have distinct actor IDs. No domain row is
relabelled as a newly created institution.

[The migration roster](../services/api/src/account-migration.ts) also provisions
four ROLE-06 institution administrators. These operators can update their own
synthetic profile and administer their own non-clinical operators. PRC reviewer
capabilities are explicit; PRC has no ROLE-05, capture, custody or approval role.
DOH has no mutation operator. Exactly six product accounts are initially
activated; later approved applications may add institutions.

A database partial unique index enforces one active primary per institution.
The institution-row lock and legacy-login trigger also cover concurrent writes
and reactivation. Replacement retires the former primary atomically, preserves
its references, attaches existing operators to the replacement and revokes old
sessions/grants. Using the same login identifier resets credentials in place.
Institution version checks apply to both operations. Replacement does not
change an operator's ledger actor ID. Forward rollback suspends access for the
migrated institutions, including replacement accounts, while leaving subsequently
onboarded distinct institutions and historical data intact.

## Lat integration handoff

Use ordinary cookie login at `POST /api/v1/auth/session`, session restoration at
`GET` of that path and logout at `DELETE`. No fixture/bearer authentication is
an institution-login substitute. Cookies remain HttpOnly, SameSite=Strict,
fifteen minutes, and Secure outside isolated localhost. Unauthenticated login
failures remain non-enumerating.

The restored principal separates `accountId` from the operator actor. It adds
`accountCategory`, `accountState`, `authorizationPolicyVersion`,
`verificationRequired`, `operators` and `administrativeCapabilities`.
`permissions` contains effective account reads; each operator profile includes
its role, version, permissions and `actionCapabilities`. These values control
visibility only. Server checks every requested action, institution and state.

For each privileged command:

1. Retain the exact command body and its `IDEM_*` key in account-isolated work.
2. POST `/api/v2/auth/operator-verifications` with `operatorId`, private `pin`,
   `action` (for example `POST /api/v2/transfers`), the complete command
   `payload`, and `idempotencyKey`.
3. Send the original command with `Operator-Verification: <verificationId>`,
   `Idempotency-Key` and, for operational commands,
   `x-bloodledger-contract-version: V2.1`.
4. Recover/poll the returned durable command/status URL. An accepted queue
   result is pending, never ledger confirmation. Matching retries return the
   original command; changed payload, operator, session, action or key fail.

An unused grant expires after two minutes. A consumed grant can authorize only
its bound retry during the same active session. PIN reset/revocation invalidates
outstanding grants and sessions. Institution/session attempt windows are
persistent in addition to operator lockout. Verification ID and PIN must stay
out of browser storage, logs, audit payloads and offline records.

| Screen | Account source and expected assertion |
|---|---|
| Login/navigation/profile | Restore the server principal. Show reads and available operator actions separately. Profile is own-institution metadata, never a selected fixture role. |
| Accounts | PRC reads `/api/v2/onboarding/institutions` and applications. Other accounts may read only their own `/institutions/{id}` profile. DOH cannot administer or list applications. |
| Inventory/dashboard | `/api/v2/components`, `/api/v2/dashboard`, V2.1. Medix/N.L. Villa start with empty operational stock and no projection timestamp; never copy Mediatrix counts. Dashboard `evidenceStatus` distinguishes projected rows from `NO_OPERATIONAL_ROWS`. |
| Transfers | Source is an explicitly approved bank; destination is the authenticated requestor/bank. Bank administrators approve/reject, technologists capture/prepare/dispatch. Source and destination reservation reads remain institution-scoped. |
| Analytics | Institution-scoped forecasting/census contracts retain unavailable/stale states. Historical snapshots remain a separate Mediatrix research read and never enter operational totals. Regulatory reads expose safe aggregates. |
| Capture PWA | Confirmed OCR uses the authenticated custody institution, separate from issuer. New issuer formats are `SYNMEDIX-YYYY-NNNN` and `SYNNLVILLA-YYYY-NNNN`. Receipt transfers bank custody under the new policy, retaining the original issuer; received stock remains `RECEIVED`, not available. |

Primary accounts receive `INSTITUTION_V2_READ_REQUIRED` on legacy V1 dashboard,
inventory, transfer, alert, audit and report routes to prevent the UI from
silently showing old V1 projections. V1 authentication/profile/forecast routes
remain usable. Do not add placeholder forecast rows or interpret an absent
projection as verified zero.

Handle safe errors without attempting privilege fallback:

| Code | UI behavior |
|---|---|
| `OPERATOR_VERIFICATION_REQUIRED`, `OPERATOR_VERIFICATION_INVALID`, `OPERATOR_VERIFICATION_EXPIRED` | Request a new bound PIN verification; preserve unsubmitted account-owned work. |
| `OPERATOR_PIN_LOCKED`, `OPERATOR_RATE_LIMITED`, `OPERATOR_VERIFICATION_FAILED` | Explain rejected verification/lockout without treating it as a durable command failure. |
| `AUTH_REQUIRED`, `AUTH_SESSION_REVOKED`, any 401 | Clear visible protected data and verification state; restore only after ordinary login. |
| `ACCOUNT_PRIMARY_EXISTS`, `ACCOUNT_IDENTITY_CONFLICT` | Show a safe account conflict; do not provision another active primary. |
| `ONB_VERSION_CONFLICT`, `ONB_APPLICATION_CONFLICT`, `OPERATOR_BINDING_CONFLICT` | Reload scoped current state; use a new key for a materially new action. |
| `ONB_ACTIVE_TRANSFER_BLOCKS_SUSPENSION` | Resolve pending requests, reservations, queue failures/conflicts and transfers first. |
| `ONB_NOT_AUTHORIZED`, `AUTH_SCOPE_FORBIDDEN` | Keep the action unavailable; never select another institution/actor to retry. |

Logout, account switching and 401 must clear visible protected data and grants.
Offline records retain their original account/operator ownership, remain
inaccessible to other accounts, and require fresh verification on reconnect.
Legacy unsubmitted browser work is quarantined for explicit recovery. Lat must
validate this UI behavior; backend tests do not establish it.

## Synthetic onboarding

PRC verifies its reviewer PIN for invitations, review, approve/reject, separate
activation, suspension/reactivation and account administration. A one-day
invitation exposes its opaque secret only on initial issuance; an identical
retry returns null rather than retaining a deliverable secret in audit. If
private delivery fails, issue a new invitation.

Submission accepts synthetic institution/contact/license/attestation fields
only; uploads and verification documents are prohibited. Applicant login uses
a separate scoped cookie and exposes only that application's status/withdrawal.
Review records a synthetic generic-contact confirmation; no actual institutional
verification is claimed. Category is restricted to bank/requestor. PRC cannot
activate a PRC/DOH applicant or assign itself clinical authority; affiliated
review/self-approval is rejected. Reapplications retain predecessor references
and stable match digests even after old details are purged.

Approval and rejection close the application. Thirty days after closure,
closed detail/verification fields are purged by a restricted off-chain function;
minimal decision, digest and reference rows remain. Applicant access expires at
that deadline even if the hourly purge has not yet run. Activation requires a
separate versioned command and private primary/operator credentials and grants
only ROLE-06 institution administration. Operational assignment requires a
separately approved capability and Fabric-policy change; no activation calls CA,
changes membership or adds a peer.

## Retained-host migration runbook

Run against the reviewed retained checkout with its existing private `.env`,
gateway identity, TLS material and channel. This worktree has no generated
identities. Do not reenroll identities or reset Docker volumes to make checks
pass. The wrapper checks the project-owned PostgreSQL volume and stops if the
general sync worker is running. Quiesce affected interactive access and all
writers from preview through preservation verification; stopping must preserve
data. The existing maintenance recovery path handles already accepted commands
using their original actors/envelopes/transaction IDs. Retired credentials
cannot create new commands.

The following is the delivered sequence, **not evidence of live execution**:

```bash
# Apply additive schema with the established database migration workflow.
npm run migrate:up
# Private configuration for inspect contains only classification and scope.
bash scripts/institution-accounts/run.sh inspect \
  --config build/accounts/inspect.json --output build/accounts/target.json
# Capture a private custom-format PostgreSQL backup, validate pg_restore --list,
# and review target.json (DB instance + project volume + channel genesis).
# Generate private random account credentials; third argument is that backup.
node scripts/institution-accounts/provision-private.mjs \
  build/accounts/private.json REVIEWED_TARGET_DIGEST build/accounts/retained.dump
bash scripts/institution-accounts/run.sh preview \
  --config build/accounts/private.json --output build/accounts/preview.json
# Review the six legacy mappings, identity/session and domain fingerprints.
# Deploy the additive package only as part of separately authorized host rollout.
bash network/scripts/deploy-institution-accounts.sh --apply bloodledger-local
bash scripts/institution-accounts/run.sh apply \
  --config build/accounts/private.json --manifest build/accounts/preview.json \
  --approve-manifest REVIEWED_MANIFEST_SHA256 --backup build/accounts/retained.dump \
  --output build/accounts/applied.json
bash scripts/institution-accounts/run.sh verify \
  --config build/accounts/private.json --output build/accounts/verified.json
```

Commands require the pinned Node runtime; use the existing Docker Node wrapper
where native Node is unavailable. All private JSON/dumps live in ignored
`build/accounts/`, directory mode 0700 and file mode 0600. Provisioning never
prints credentials. Backup approval is bound to its SHA-256. Preview refuses
unreviewed principals; apply refuses target/mapping/fingerprint drift and checks
the installed actor-policy digest for every selected clinical operator.

Identity migration is a single transaction. Before commit, failure leaves no
partially migrated identities; after commit, the checkpoint makes identical
`apply`/`resume` calls return the original result. Use `resume` with the same
config, manifest, approval hash and backup, and a new output filename. Outputs
are exclusive and never overwrite earlier private evidence. `verify` must run
before reopening writes; subsequent legitimate domain activity changes those
fingerprints and must not be called migration corruption.

Forward access rollback is available with `rollback --config ...
--approve-manifest <SHA256> --output ...`. Its approval hash is the account hash
helper's canonical SHA-256 of `{migrationId: INSTITUTION_ACCOUNTS_20261008_V1,
targetDigest: <reviewed digest>, action: rollback}`. It is idempotent, revokes new
access and never restores old sessions, modifies ledger history or replaces a
database over newer ledger activity. `purge --config ... --output ...` invokes
only the closed synthetic onboarding retention function.

## Reproducible validation and limitations

All checks below are Jopia agent self-validation on an isolated WSL checkout,
not Lat's independent host evidence. Node 24.17.0, PostgreSQL 17.10 and
Playwright 1.61.1 images were used. No live retained migration or Fabric upgrade
was executed. The observed host had two older interactive accounts rather than
the six reviewed retained principals, and no running Mediatrix peer. The
migration deliberately rejects that account mapping. The retained backup,
installed lifecycle sequence/package ID and private credential delivery remain
host prerequisites.

| Check | Command | Result |
|---|---|---|
| API type/unit | `npm run check --workspace @bloodledger/api`; `npm run test:api` in `node:24.17.0` | 123 passed |
| Chaincode format/lint/type/unit | `npm run check:inventory-contract`; `npm run test:inventory-contract` | 41 passed, including deterministic three-bank OCR/custody/replay |
| Disposable PostgreSQL + real Chromium cookies | `bash tests/accounts/postgres-integration.sh` | 150 assertions passed; thirty migrations applied |
| API static boundary | `bash tests/api/static-boundary.sh` with pinned Node and host rg | Passed |
| JSON/database static checks | `npm run check:format`; `npm run check:database` | Passed |
| Web build/type/unit | `npm run check:web`; `npm run test:web` | Passed; 62 unit tests |
| Capture build/type/unit | `npm run check:capture`; `npm run test:capture` | Passed; 14 unit tests |
| Existing browser regressions | `npm run test:web:e2e`; `npm run test:capture:e2e` in `mcr.microsoft.com/playwright:v1.61.1-noble` | Web 57 passed / 7 skipped; Capture 3 passed. Existing UI fixtures, not new account integration evidence |
| Runtime dependency audit | `npm audit --omit=dev --audit-level=high --json` | Zero reported vulnerabilities |
| Secret scan | `bash scripts/scan-secrets.sh` | History, index and candidate content passed Gitleaks 8.30.1 |
| Shell/diff hygiene | `bash -n` on new wrappers; `git diff --check` | Passed |
| Live Fabric deployment / exact retained migration / Lat rerun | Runbook above + Lat UI assertions | NOT_RUN; host prerequisites and independent UI work remain |

The disposable suite seeds nine distinct operational components, acknowledgement
and command/receipt references, and a separate 522-component historical fixture
with 524 import steps, saved envelopes and schema-valid **fabricated** receipts.
It proves fingerprint preservation, replay/projection idempotency, six initial
accounts, concurrent migration/provisioning rejection, identity drift rejection,
role/PIN/session denials, replacement, expiry, source/destination suspension
blocking, retention and forward rollback. Those fixture receipts are not live
Fabric evidence and do not prove preservation of the actual retained ledger.

The live-host follow-up must capture and compare actual counts/IDs/receipts,
exercise three-bank flows on separate synthetic fixtures, and test interruption,
worker recovery, projection retry, restart and exact saved-envelope replay.
Lat must also integrate and rerun login/navigation/Accounts/Analytics/Capture and
prove protected-data clearing and offline ownership isolation. Seven existing
web browser tests remained intentionally skipped; no skipped or unavailable
check is represented as passing acceptance evidence. Clinical, research-data,
physical-device, privacy/regulatory and production gates remain unchanged.
