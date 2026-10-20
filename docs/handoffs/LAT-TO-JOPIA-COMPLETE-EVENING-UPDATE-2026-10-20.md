# Lat → Jopia: complete evening update — 2026-10-20

**SIMULATION_ONLY.** User-requested frontend/backend follow-through, shared
credentials and final publication. Agent implementation/self-validation; no
independent teammate review or clinical, regulatory or production claim.

## Summary — what changed

- Integrated your PR #99 requester-form implementation locally, preserving the
  morning UI work and existing scanner/table/Analytics designs. Provenance:
  `codex/jopia-lat-ui-20261020`, `9b2c737`; the earlier equivalent morning patch
  was already present and was not applied twice.
- Connected supplier choice, requester/staff/physician/required-time fields,
  pickup details, supporting documents and notes. Added the permitted detail
  panel and pending-request edit/document actions. Patient / Case Reference
  remains disabled under RQ-20.
- Applied the same expanded request form to all three blood-bank institution
  accounts, retaining each operator's existing permissions and PIN verification.
- Added **Fill Up**, immediately before Cancel. It replaces only the lower
  details/pickup/documents/notes with fictional values. Supplying bank, blood
  type, component, quantity and urgency stay exactly as selected. It does not
  submit, open a PIN dialog or upload files by itself.
- Fixed phone-width detail-panel spacing, hidden duplicate file controls,
  stable Notes accessibility and missing detail/document operator-capability
  mappings. Updated Refresh-label fixtures to the existing stable wording.
- Made 09:00/16:00 Manila stock recording independent of the manually started
  ledger worker through a dedicated, restartable checkpoint service. Empty stock
  produces a zero matrix; missed slots remain missing. No historical records
  were fabricated.
- Standardized each identity's credentials for cross-laptop import: **6 distinct
  account passwords, exactly 12 characters each**, and **12 distinct six-digit
  operator PINs**. The final password-only adjustment preserved all PIN values,
  PIN hashes and operator versions. This is not a universal password/PIN.
- Took private backups, preserved domain data and identities, restored the UAT
  worker and kept the general sync worker stopped. Added reproducible tests,
  rollout evidence and the private-package import tool/instructions.
- Repaired an outdated static API assertion for the already-existing versioned
  location-policy loader, and normalized OpenAPI JSON formatting. No location
  behavior changed. Identified remaining OpenAPI coverage work for you below.

## 1. Source to get

Repository: `luisantonioj/bloodledger`.
Branch: **`lat-sync-20261020`**.
Implementation commit: **`056d6dbf6023e41918c51ae7afe3fc1a70519a82`** (`056d6db`).
This handoff is delivered in the following documentation commit on that branch.
Previous published Lat head: `6cbccabda43c123a28e0587c2e1dff51581fad9c`.
Underlying demo source remains based on `56d5577`, not an assumption that every
open demo PR has merged into `main`.

Preserve your own uncommitted edits, private runtime files and retained services
first. Inspect on an isolated branch; do not use reset/clean or overwrite files:

```sh
git fetch origin
git switch -c jopia-lat-evening-20261020 origin/lat-sync-20261020
git show --stat 056d6db
git diff 6cbccab 056d6db -- apps services database scripts docs tests
```

Choose a different review-branch name if it already exists. If your working
branch already includes PR #99, do not cherry-pick its four commits again.
Integrate this delivery through your normal reviewed merge/cherry-pick process,
resolving overlapping edits against both versions. Keep the newer saved layouts.
No new PR was requested or created for this delivery; pushing updates the
existing source branch. A Git source update does not migrate a database, change
host credentials or deploy a service by itself.

## 2. Request forms and backend integration

PA-REQ-01..05 / `SYNTHETIC_REQUEST_DETAIL_V1` remain the accepted simulation
rules. See [your decisions](../frontend/REQUESTER-FORM-DECISIONS.md),
[requirements](../REQUIREMENTS.md) and
[local rollout evidence](../validation/lat-requester-local-rollout-2026-10-20/README.md).

- `GET /api/v2/eligible-suppliers` supplies available banks for the selected
  product/quantity. The first is preselected; the institution confirms or changes
  it. Bands disclose availability, not network counts or approval. A requesting
  bank cannot supply itself. No eligible stock means an empty supplier list and
  disabled submission, not a broken form. This is not autonomous assignment.
- Submission still uses `POST /api/v2/transfers`, now with the accepted optional
  `details`/`documents` additions. Required time is entered in Manila time and
  stored UTC, and must be future. Staff/pickup references remain synthetic.
- Details and documents are scoped to requester and selected supplier. Details
  live in `app.v2_request_details`; document metadata in
  `app.v2_request_documents`. Bytes remain off-chain in
  `BLOODLEDGER_REQUEST_DOCUMENT_DIR`, default `.local/request-documents`.
  The directory is Git-ignored and must persist with the API host/storage mount.
- PDF/PNG/JPEG are checked by content signature: maximum 5 MB each, three per
  request. Notes are at most 500 characters. Real retention remains RQ-14.
- The detail panel supports the accepted pending-request edit, upload/download
  and removal flow. Detail/document mutations map to `transfer:request` and are
  operator-verified. Document metadata/digests are bound to verification; file
  bytes are not put into the PIN payload. New request submission asks for the
  PIN once for the combined details/documents request.
- Preserve expected versions, frozen idempotent retries and clear queued versus
  committed versus bank-approved states. Typed pickup details are stated, not
  verified pickup identity. Do not add patient/case data while RQ-20 is open.

The bank form reuses the shared requester sections; no duplicate backend was
invented. Fill Up randomizes fictional requester/staff/physician information,
required time roughly 48–72 hours ahead, pickup references, notes and two small
valid synthetic PDFs. Repeated clicks replace those draft values/files. Files
stay in browser memory until explicit submission. No patient/case value or PIN
is generated by Fill Up.

Main implementation references:
`features/transfers/v2-operations.tsx`, `requester-request-fields.tsx`,
`request-detail-panel.tsx`, `synthetic-request-fill.ts` and
`services/api/request-details.ts` under `apps/web/src/`;
`services/api/src/request-details.ts` and `services/api/src/v2-routes.ts`.

**OpenAPI follow-up for Jopia:** the supplied implementation/typed client and
fixtures implement the new supplier/detail/document routes, but their path and
schema entries are still absent from `services/api/openapi-v2.json`. Publish
that coverage, including optional request `details`/`documents`, permissions,
errors, versions and replay behavior. The gap register records this accurately;
do not treat these accepted runtime routes as unavailable or invent a second
wire format.

## 3. Database and retained runtime — inspect your host first

Lat went from 39 applied / 2 pending to **41 applied / 0 pending**, after a fresh
validated private backup, applying in normal order:

1. `20261020000000000_add-reservation-delay-location-expiry-service` — already
   part of the demo source, but previously pending on Lat. It intentionally added
   one suspended INTERNAL `USR_SERVICE_EXPIRY` identity (22 → 23 total users).
2. `20261020010000000_add-request-details-documents` — PR #99's additive tables.

Your retained database may already have either/both. Run `npm run migrate:status`
with your own private migrator config. Never rerun an applied migration or copy
Lat's history. Back up and compare existing-record fingerprints before any
needed rollout; apply only verified expected pending migrations using the
repository migrator. Stop on unexpected pending entries, history-order errors
or data differences; do not invent an unordered runner/reset/repopulation.

Build with **Node 24.17.0**, as your normal user:

```sh
npm ci --ignore-scripts
npm run build --workspace @bloodledger/api
npm run check:web
```

Preserve your own approved flags, app/migrator separation, document storage,
Fabric identities and volumes. Do not copy Lat's `.env`, Docker inspection dump,
backups or build/config snapshots. Lat's API/web were rebuilt/recreated with
private snapshots; their current app source matches this delivery. Later
credential/password changes required no API/web source rebuild.

A stale Docker Desktop socket initially prevented Lat's existing peer starting.
Only that peer was recreated with the same image/config/identities/volumes;
health and channel height 1138 were observed. This is recovery evidence, not an
instruction to recreate your healthy peer. No chaincode install/upgrade or
Fabric policy change was performed here. A default-identity lifecycle query was
ACL-denied; no alternate identity was used to bypass it.

## 4. Automatic Saved Stock Records

See [checkpoint evidence](../validation/lat-stock-checkpoints-2026-10-20/README.md)
and [local setup](../LOCAL-DEVELOPMENT.md#dedicated-stock-checkpoints--local-activation-2026-10-20).

Root cause on Lat: reporting flags were absent and scheduling depended on a
manually restarted ledger worker. The new `stock-checkpoint-main.ts` runs only
this off-chain task; it does not connect to Fabric or run forecasts/expiry.

On your host configure both API and checkpoint service with:

```text
BLOODLEDGER_DOH_REPORT_POLICY_VERSION=SYNTHETIC_STOCK_CHECKPOINT_V1
BLOODLEDGER_DOH_BLOOD_TYPE_ORDER=O_POSITIVE,A_POSITIVE,B_POSITIVE,AB_POSITIVE,O_NEGATIVE,A_NEGATIVE,B_NEGATIVE,AB_NEGATIVE
```

Set `BLOODLEDGER_STOCK_CHECKPOINT_WORKER_MODE=dedicated` in the API/command-worker
environment so only the dedicated service schedules checkpoints. Give the
scheduler only its own app DB/policy environment, not unrelated private API keys:
`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_APP_USER`,
`POSTGRES_APP_PASSWORD` plus the reporting settings above.

After building, start/manage it through your retained service configuration:
`npm run stock-checkpoints --workspace @bloodledger/api`. Lat's container is
`bloodledger-stock-checkpoints`, pinned `node:24.17.0`, user `1000:1000`, existing
Docker network and source/build mounts, restart `unless-stopped`. API/web also
use `unless-stopped`. Do not create a second scheduler if one already exists.
The health command reads `/tmp/bloodledger-stock-checkpoint-health.json` and
requires `healthy: true` with a `checkedAt` age under 180 seconds; Lat probes it
every 30 seconds, timeout 5 seconds, start period 10 seconds, retries 3.

Rules remain PA-DEF-07:

- Active blood banks only; each is discovered on every one-minute tick.
- One immutable record per bank per slot. First capture wins; no overwriting.
- 09:00–09:29:59 and 16:00–16:29:59 **Asia/Manila** only. Missed slots remain
  not captured. No late backfill or copying today's stock into a past slot.
- Unexpired AVAILABLE/RESERVED stock only. Matrix: eight blood groups × four V2
  components; cryoprecipitate is not part of this report contract.
- Zero inventory still produces the complete zero-filled matrix. Copy reads
  the saved matrix. This is not a DOH-approved regulatory submission.

Check `docker inspect --format '{{.State.Health.Status}}' bloodledger-stock-checkpoints`
and `docker exec bloodledger-stock-checkpoints cat /tmp/bloodledger-stock-checkpoint-health.json`.
Check the ordinary institution's census GET/list and copy behavior. On Lat,
activation was after the Oct 20 afternoon window; next slot was Oct 21 at 09:00,
then 16:00. Actual retained records were still zero when checked. The six-record
persistence/empty-stock test passed on a disposable DB; the next real scheduled
capture has not yet been observed. Keep the laptop awake and Docker running.

## 5. Shared credentials — use the FINAL replacement package

This section and [the credential handoff](LAT-TO-JOPIA-SHARED-CREDENTIALS-2026-10-20.md)
include the user's final adjustment. [The import procedure](../../scripts/institution-accounts/SHARED-CREDENTIALS.md)
contains exact tool invocations and safety checks.

- Six existing institution accounts, each with its own **12-character random
  alphanumeric password**. Twelve operators, each with its own **six-digit PIN**.
  The same identity should use the same secret across laptops; unrelated accounts
  and operators do not share one universal secret.
- New package policy `SYNTHETIC_ACCOUNT_PASSWORD_12_V1`; PIN policy
  `SYNTHETIC_OPERATOR_PIN_6_V1`. Matching PIN hashes/versions are left intact.
- The earlier long-password package is superseded. Its PINs were preserved in
  the replacement; all final account passwords changed. Prior sessions/grants
  were revoked. Lat users must sign in again.
- **Your host has not been changed.** Git contains the tool and instructions,
  not the passwords/PINs. The user must privately transfer the final package.

Private source-host paths, deliberately absent from Git:

```text
build/accounts/shared-credentials.json
build/accounts/LOCAL-ACCOUNT-ACCESS.txt
build/accounts/bloodledger-shared-credentials-transfer-20261020.zip
```

Final package SHA-256:
`28e83ae9c2a601c37865a66ec7d70088a6807f22aa639429554f81b7312a80ea`.
Final ZIP SHA-256:
`146d23e3de388ea0039c3ead759eb143d5c3e800bdc49ded5eba7c8eeea8a347`.
A checksum is not encryption. Do not put the package, readable list or ZIP in a
PR, chat message, Git commit, public URL or ordinary evidence attachment.
The ZIP's credential-only patch is a fallback; **prefer the complete Git source**
and do not apply that patch blindly over code already integrated from this branch.

On your host:

1. Preserve any older private package and access file. Privately receive the
   final bytes, verify the checksum and set directory 0700 / file 0600. Do not
   run `generate` again, edit the package or substitute your old runtime file.
2. From the updated/built source, run compatibility check before writes:

```sh
node scripts/institution-accounts/shared-credentials.mjs check \
  --file build/accounts/shared-credentials.json \
  --sha256 28e83ae9c2a601c37865a66ec7d70088a6807f22aa639429554f81b7312a80ea
```

3. Exact account/operator IDs, usernames, institution scopes, roles and capability
   profiles must match. If not, stop and report; never create, reactivate or remap
   identities just to pass the check.
4. Quiesce writers; check no pending commands/population lock. Take a fresh
   private custom-format backup, validate with `pg_restore --list`, record its
   checksum and existing identity/domain fingerprints. Then apply explicitly:

```sh
node scripts/institution-accounts/shared-credentials.mjs apply \
  --file build/accounts/shared-credentials.json \
  --sha256 28e83ae9c2a601c37865a66ec7d70088a6807f22aa639429554f81b7312a80ea \
  --backup <your-validated-private-custom-dump> --confirm-target bloodledger_dev
```

5. Set `BLOODLEDGER_OPERATOR_PIN_POLICY_VERSION=SYNTHETIC_OPERATOR_PIN_6_V1`
   in your private API environment with matching credentials and source.
   Default/`OPERATOR_PIN_8_V1` preserves eight-digit hosts; unknown policy stops
   startup. Do not enable six against old eight-digit PIN hashes. Matching
   session/UI `operatorPinLength` must be 6.
6. Retire stale local credential sources. Lat uses
   `build/accounts/private.json` as a relative symlink to the canonical package
   for the local review switcher. Preserve the old file privately before changing
   such a compatibility path. Your `.env` and host-specific private runtime file
   stay local; do not replace them with Lat's configuration.
7. Verify every login/PIN without submitting a domain command; confirm old
   sessions invalid and domain fingerprints unchanged. Import appends one
   explicit maintenance audit, so that count is expected to increase by one.
   Exact replay verifies hashes without another audit/version bump. Report your
   own results and checksum before calling cross-host synchronization complete.

A host that imported the earlier six-digit package keeps the same PIN hashes and
operator versions; a host still on its original PINs can import the replacement
directly to synchronize both passwords and PINs. Do not run the old eight-digit
bootstrap against the six-digit configuration. No new migration is required
for this PIN/password maintenance itself.

## 6. Final state observed on Lat

| Item | Result |
| --- | --- |
| Institutions / total users | 9 / 23 |
| Onboarding applications | 1 |
| Components / reservations / commands | 535 / 27 / 598 |
| Command queue / writer lock | 0 pending V1/V2; lock 0 |
| Census snapshots | 0 at the last check; no backfill |
| Account audit | 7 → 8 for initial rotation → 9 after password-length adjustment |
| Request-detail/document/location tables | empty after rollout; no live request submitted |
| Migration status | 41 applied / 0 pending |
| API / frontend | READY / port 5174 available |
| UAT worker / checkpoint scheduler | running / healthy |
| General sync worker | stopped |
| Expiry evaluator / label extraction preview | remained off on Lat |

Do not use Lat's counts as assertions about your different retained dataset.
Existing domain/non-credential identity fingerprints matched throughout. Operator
rows were exactly unchanged by the final password-only adjustment. Private
backups, Docker configs, screenshots and test artifacts remain under ignored
`build/` directories; they are not part of this handoff's Git delivery.
Your existing separately approved runtime flags remain your host's decisions.

## 7. Validation and reproduction

Node 24.17.0 / npm 11.13.0. Final consolidated rerun:

```sh
npm run check:web
npm run test:web
npm run check:api
npm run test:api
npm run check:ignore
npm run check:format
npm run scan:secrets
```

- Web check passed; **481 tests / 56 files passed**, including design-token tests.
- API check passed; **244 tests passed**. The static test now checks the actual
  shared policy directory plus explicit V1 and V2 location-policy mappings.
- Ignored-path checks and repository JSON-format checks passed.
- Secret scanning passed for Git history, index and non-ignored candidates.
  Private credential/runtime files were excluded; older private context notes
  remain local. No broad scanner allowlist was added.
- Pinned `mcr.microsoft.com/playwright:v1.61.1-noble`, normal user, DejaVu fonts,
  `--workers=1`, network enabled: **109 passed / 7 skipped / 0 failed** across:

```sh
npx playwright test e2e/requester-transfers.spec.ts \
  e2e/dashboard-alerts.spec.ts e2e/blood-bank-pages.spec.ts \
  e2e/blood-bank-completion.spec.ts e2e/institution-profile-accounts.spec.ts \
  e2e/testing-phase.spec.ts e2e/web.spec.ts --workers=1
```

These are seven affected specs, not a claim about the complete browser suite or
a physical camera device. Earlier targeted rollout evidence remains linked:
[request forms](../validation/lat-requester-local-rollout-2026-10-20/README.md),
[checkpoints](../validation/lat-stock-checkpoints-2026-10-20/README.md),
[credentials](../validation/lat-shared-credentials-2026-10-20/README.md).

Disposable checkpoint DB: all 41 migrations, three zero-stock banks × two slots,
six snapshots / 192 zero cells; copy, first-capture immutability, inactive/requester
exclusion and no-backfill passed. Never run its fixture probe on a retained DB.
Disposable credential clone: apply/replay, private modes, hash/roster/duplicate
PIN rejection; final package rejects 11-/13-character passwords and preserves
complete operator rows. Actual host: six new-password logins, twelve unchanged
PIN verifications, 24 wrong-length PIN rejections, old session 401. Actual browser
confirmed six-digit dialog on 5174 and cancelled before domain submission.

## 8. Remaining follow-through and boundaries

- Jopia: integrate source without losing your edits; publish missing requester
  OpenAPI coverage; inspect your own migration/document-storage prerequisites.
- Jopia: privately import the **final** credential package and report results.
  Merely pulling the branch does not synchronize credentials.
- Jopia/Lat: observe the next legitimate 09:00/16:00 checkpoint while the host
  is awake; verify saved/copy records. Past missed slots must remain missing.
- A bounded live request/documents/approval end-to-end exercise is still separate.
  Current live checks were read-only except explicitly authorized migrations,
  credential maintenance and the scheduler's future normal checkpoint writes.
- RQ-20 patient/case, RQ-14 real retention, RQ-18 unsupported request transitions
  and real-label/physical-device gates remain explicit. No PHI/real employee
  identifiers or real labels should be added to demonstrate these forms.
- Forecasts, demonstration stock bands, forecast-derived excess and human
  transfer approval remain separate. No census/forecast rerun, stock population,
  model activation, reset, account creation or chaincode upgrade is requested.
- Keep accounts, identities, volumes, history, evidence, original OCR provenance,
  idempotency and expected-version protection intact. No silent rollback/reset.

## Short message to forward

Jopia, today's full update is on `lat-sync-20261020`, implementation `056d6db`;
read this handoff for the exact source and rollout steps. It includes your #99
integration, expanded bank/requester forms, draft-only Fill Up, the dedicated
09:00/16:00 checkpoint worker and the final 12-character passwords / six-digit
PIN import tooling. All final checks passed (481 web, 244 API, 109 browser passed,
7 skipped). Your host still needs its own prerequisite checks and private final
credential-package import. Git contains no passwords, PINs, backups or private
config. Please preserve our saved layouts and report the OpenAPI follow-up,
credential import and next real scheduled checkpoint results.
