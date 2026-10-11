# Lat retained development validation — 2026-10-07

**Result: BLOCKED for populated integration; local setup and empty-state browser checks PASS.**
Validator: Lat, disclosed local self-validation. Classification: SIMULATION_ONLY.
This record does not complete Testing-phase acceptance, UAT, physical OCR, full
Fabric-to-browser latency, reporting policy, clinical readiness or V5 activation.
Jopia's retained-host evidence remains separately attributed in the
[delivered runbook](../PERSISTENT-DEVELOPMENT-RUNBOOK.md).

## Verified source and environment

- Branch: `codex/lat-persistent-development-validation`, created from delivered
  `e9a91d087819fab454bd3a033c7b22cdeaca1c71`.
- Exact tested source commit: `e9a91d087819fab454bd3a033c7b22cdeaca1c71`.
  Its immediate parent is Jopia's tested implementation revision
  `fee83dc43f0527f3ed57ff7e5095e9f731cdf6e2`.
- Previous clean branch `codex/lat-testing-traceability` at `00b95cd` is preserved.
  Delivered integration was fetched explicitly; main was not substituted.
- Ubuntu 24.04.4 LTS / WSL2 (`6.18.33.2-microsoft-standard-WSL2`) checkout
  `/home/yuri/projects/bloodledger-current`; Playwright 1.61.1; Node 24.17.0,
  npm 11.13.0, Python 3.12.3; PostgreSQL container
  `bloodledger-postgres-1`, database `bloodledger_dev`, internal/loopback port
  5432, retained volume `bloodledger_postgres-data`, created
  `2026-07-28T01:47:20Z`.
- API is the delivered source on loopback 3000; editable Vite frontend is on
  loopback 5174 with its existing `/api` proxy. Port 5175 fixtures were not used.
  Ordinary processes run directly under Node/npm rather than the optional
  `bloodledger-persistent-api`/`bloodledger-persistent-web` container recipe.
- General sync worker remains stopped. V2 writes are configured; V4 remains
  the default forecast dataset. No V5 binding or job was approved or persisted.

## Retained setup and preservation

The original peer was stopped after Docker Desktop reported an invalid stale
Docker socket bind mount. Recreating only that container through Compose
restored its healthy state, preserving both peer volumes and existing identities.
The retained `bloodledger-dev` channel was queried with the existing administrator.
Initial definitions were health 0.1.0/sequence 1 and inventory 0.2.0/sequence 2.
The documented additive historical contract deployment committed `historical-v1`
at sequence 3 with the same Mediatrix endorsement policy. This is local lifecycle
evidence, not historical stock import evidence. The existing API gateway MSP was
present; the delivered inspect CLI successfully queried channel genesis before
checking account mappings.

Before migrations, a private custom-format PostgreSQL backup was captured at
`build/development-local/before.dump`, SHA-256
`1717c0e21e8af2513acf5f499e78f6f5fd47bfab2322aa4459b05a359ed7d867`.
All 16 outstanding additive migrations applied: 10 applied migrations became 26.
Runtime forecast SELECT/INSERT grants existed initially. Applied migrations
were not changed. Read-only reconciliation SQL subsequently executed successfully.

All six synthetic accounts logged in through the ordinary frontend. Their
account, institution and role data dumps were identical before migrations and
after the service restart, excluding pg_dump's randomized `restrict` markers.
Passwords, usernames, roles and institutions were not changed. Initial and final
V1 inventory, V2 components/commands/donations/reservations, transfers and forecasts
were empty; no pending commands were drained. Historical units and ML census
snapshots remain empty after setup.

`prepare-local.mjs --initialize-missing-simulation-keys` created an ignored private
runtime file after verifying zero existing donations. Existing values and the
original `.env` were retained; only missing simulation keys were initialized.
No existing encrypted donation needed key recovery. Private account configuration
was derived from the existing six-account file, without provisioning accounts.

## Reconciliation and blocked dependencies

| Boundary | Local result | Required continuation |
| --- | --- | --- |
| Operational seed | BLOCKED; zero components/commands; no manifest approved | Jopia supplies an explicit Fabric actor-policy mapping for the existing accounts |
| Nine components / five types / 18 operations | NOT_RUN | Run inspect → target review → dated OCR preview → exact-hash apply after mapping is resolved |
| Requests and reservations | Zero; seeded lifecycle assertions NOT_RUN | Seed must add three PENDING requests and ACTIVE/IN_TRANSIT reservations |
| Historical import | BLOCKED; no local snapshot or units | Original workbook with supplied SHA-256 must be made available locally |
| Operational census | BLOCKED; no persisted snapshot | Delivered wrapper's inspect gate must pass before capture of 40 combinations |
| Persisted V5 | BLOCKED; zero runs/forecasts | Successful retained-target inspection and separate reviewed binding/job hashes |
| Seed/historical/forecast replay | NOT_RUN | No original manifest, import or forecast job exists to replay |
| Service restart | PASS for account preservation and real empty/unavailable responses | Populated record durability remains NOT_RUN |

The existing coordinator is `USR_SYNTH_REVIEW_ROLE02` / ROLE-02 /
`INST_MEDIATRIX`; the existing recipient is `USR_SYNTH_REVIEW_ROLE03` / ROLE-03 /
`INST_SYNTH_SECONDARY_REVIEW`. Neither user ID appears in the delivered
`chaincode/policy/interview-core-v2.json`. The runbook examples use
`USR_MEDIATRIX_TECH` and `USR_DIVINE_LOVE` / `INST_DIVINE_LOVE`.
The delivered native inspect CLI exits 2 with
`SEED_FABRIC_ACTOR_MAPPING_REQUIRED`. No account mutation, policy bypass or target
approval was used. Jopia must resolve this boundary explicitly. The forecast and
census wrappers also call inspect, so they share this blocker.

The original `BloodLedger_ML_Research_Dataset_v5.xlsx` was not found in the checked
Linux workspace/home or usual Windows Downloads/Documents/Desktop locations.
The available V5 handoff ZIP contains a model but no XLSX. Actual historical
preview/import was therefore stopped, as instructed. Required original workbook
SHA-256 is `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`;
expected historical manifest SHA-256 is
`7b8c831d37667b1459c2b16707c5bf37cf72fe6cc12b2f24bf17a6ab2449af04`.
The 486 available / 36 reserved / 522 units remain expected source counts,
not observed local counts. No Jopia receipts were copied to PostgreSQL.

The frozen runtime was recovered from the existing local Downloads transport
archive, without resend, reconstruction, rebuilding or training. Its verified
transport SHA-256 is
`dbeec3106057c00fee967052563fa2fd295e3cdc52d249928c2b899c0f8a8b1c`.
Original model bytes match
`1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`;
original image archive matches
`aa1ab6e460911f91cba6164116302015d76fb5c6e591c5208a0835bb40cd0b26`.
Importing it restored the pinned image
`sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1`.
Producer prerequisite preflight PASS is not forecast persistence evidence.
Buno model/image availability is resolved; an approved retained-target binding
and job remain unexecuted. Disposable binding approval was not reused.

The actual validation date was 2026-10-07 Manila, matching the explicit seed date.
The unchanged scenario has its expired example at `2026-10-06T23:00:00Z` and its
imminent-expiry example at `2026-10-07T23:00:00Z`. No manifest date/timestamp was
silently refreshed. After gates clear, V5 must use the actual Manila day minus
one as origin and actual generation time; after midnight a new reviewed job and
census capture may be needed. Near-expiry policy remains disabled.

## Real frontend evidence

The private probe `build/development-local/lat-browser.mjs` used Playwright
Chromium and ordinary form login at 5174, official HttpOnly cookies, the actual
API/database, and no HTTP interception. Both before and after an ordinary
API/frontend stop/start, **23 checks passed**:

- Anonymous history returns 401; coordinator V2 dashboard, transfers, alerts,
  audit and historical-list endpoints return 200 with SIMULATION_ONLY.
- V2.1 inventory truthfully displays no committed components; historical view
  truthfully displays no local import. CRYO row rendering and historical count,
  pagination and ledger-reference assertions remain NOT_RUN without stock.
- Transfers retain the local-release form and separate request/reservation
  sections; recipient retains the transfer-request form. No form was submitted.
- Alerts show the genuine empty state; audit renders authenticated off-chain
  activity. Expiry evidence, acknowledgement persistence and populated Fabric
  versus off-chain audit reconciliation remain NOT_RUN.
- V4 remains default; explicit V5 returns UNAVAILABLE with zero forecasts.
  Missing census returns UNAVAILABLE, without invented verified zeros.
- All six existing accounts sign in. Historical API is allowed only for ROLE-01
  and ROLE-02; V2 audit is allowed only for ROLE-02. Recipient component reads
  return its empty authorized scope. Wrong-origin mutation returns 403.
- Logout causes 401 and protected Analytics controls disappear after reload.
  There were no protected stock/forecast rows to test for residual display.

No populated cross-institution leakage test, actual freshness/20-series preview,
or full Fabric-to-browser timing pass is claimed. No frontend defect requiring
implementation was reproduced in this executable slice; no frontend code fixes
or unrelated changes were made.

## Commands and private evidence

Executed commands below are credential-free; connection secrets were read only
from existing/private configuration. Logs, backups, account dumps, model/archive,
probe and browser reports are ignored under `build/development-local/`.

| Command / procedure | Result / artifact |
| --- | --- |
| `git fetch origin codex/persistent-synthetic-development`; verify delivered commit and parent; create dedicated branch | PASS |
| Inspect retained Docker containers, mounts, migrations, grants, accounts and domain counts | PASS; initial 10 migrations, six accounts, empty domain rows |
| `docker exec bloodledger-postgres-1 pg_dump -U postgres -d bloodledger_dev -Fc` to private backup | PASS; `before.dump` |
| `npm run migrate:up` | PASS; `migrations.log`, 16 additive migrations |
| `docker compose --project-name bloodledger --env-file .env up -d --no-deps --force-recreate peer0-mediatrix` | PASS; retained peer healthy |
| `bash network/scripts/deploy-historical-inventory.sh --apply bloodledger-local` | PASS; `contract-upgrade.log`, sequence 3 |
| `node scripts/development-data/prepare-local.mjs --initialize-missing-simulation-keys` | PASS; protected runtime configuration |
| `node --env-file=build/development-local/runtime.env services/api/build/src/server.js` with loopback host/peer/repository overrides | PASS; `api.log` |
| `npm run dev --workspace @bloodledger/web -- --host 127.0.0.1` | PASS; `web.log`, 5174→3000 |
| Verify original transport/model/image checksums; `docker load --input` verified original image archive | PASS; unchanged pinned artifacts |
| `node tests/forecasting/v5-runtime-prerequisites.mjs --producer` with recovered model path | PASS; `v5-prerequisites.log` |
| Delivered `cli.mjs inspect` with actual host/volume metadata and private runtime/config | BLOCKED/2; `inspect-native.log`, actor mapping error |
| `bash scripts/development-data/run.sh inspect --config build/development-local/config.json` with private runtime env | Stopped during development-tools image preparation after the native CLI confirmed the blocker; `inspect.log`; wrapper inspection not completed |
| `node build/development-local/lat-browser.mjs`; ordinary API/web restart; rerun with fresh report path | PASS twice; `browser-before-restart.json`, `browser-after-restart.json` |
| `docker exec -i ... psql -v ON_ERROR_STOP=1` reading `scripts/development-data/inspect.sql` | PASS; `database-final.log` |
| Compare before/final account, role and institution dumps; read final domain counts | PASS; `accounts-final.sql`, `row-counts-final.log` |
| `npm run check:web`; `npm run test:web` | PASS; 62 web tests |
| `npm run check:api`; `npm run test:api` | PASS; 111 API tests |
| `npm run test:inventory-contract` | PASS; 36 tests |
| `npm run test:development-data`; `npm run test:historical-inventory` | PASS; recovery/historical test files |
| `npm run check:foundation`; `npm run check:database`; Bash syntax checks | PASS |
| `npm run scan:secrets`; `npm audit --json` | PASS; no leaks, zero reported vulnerabilities |

To continue, retain these services/configuration and supply the approved existing
account-to-policy mapping and exact original workbook. Then rerun the runbook's
inspect and explicit approvals; do not reset volumes, reprovision accounts,
refresh a saved manifest, use direct projection fixtures or backdate forecasts.
The existing pinned runtime requires no retraining or input history.

## Retained task and follow-up — 2026-10-08

The user's continuing task is to make genuine persisted backend inventory,
historical stock, transfers, census and forecasts visible in the ordinary editable
frontend on 5174 → 3000, then verify replay, account preservation and persistence
after restart. Preparing handoffs or demonstrating empty states does not complete
this task; 5175 sample fixtures do not satisfy it.

A follow-up read found zero operational components, historical units, forecasts
and ML census snapshots. The ordinary API/web processes had stopped since the
previous availability check; they were restarted using the same private runtime
configuration and existing frontend proxy. No domain data was inserted. Account
policy mapping, exact original workbook availability and retained-target
binding/job review remain the continuation dependencies.

Separate, user-sendable requests for Jopia and Buno are prepared outside the
repository as outgoing attachments. They have not been sent or published.
This report remains the repository evidence reference. The original 2026-10-07
test evidence remains attributed to that run;
service availability on 2026-10-08 is not a new populated integration pass.


### Requester Requests & Transfers — 2026-10-09
Implemented the MetroLipa reference structure on the existing `codex/lat-uat-frontend` checkout, preserving pending work. The expandable form reuses canonical request submission; request and linked transfer-reservation rows remain separate, with verified inline detail navigation. Backend-incompatible personal fields, automatic routing, exports, and custody mutations remain unavailable.

Validation: production TypeScript/build succeeded; 112 frontend unit tests passed; 18 focused browser regressions passed (requester scope, request retries and command identity, dashboard links, refresh denial, keyboard tabs, mobile overflow, and shared record navigation). Live 5174 requester reads returned authorized empty arrays, rendered explicit empty states, and the new form layout was visually checked. No live requests were submitted. This is simulation frontend validation, not Fabric or clinical acceptance.


### Expanded requester form placeholders — 2026-10-09
Added reference sections for requester/clinical details, pickup, document attachments and notes as disabled UI placeholders. Operator authorization now has an explanatory section pointing to the existing action-bound verification dialog. No new API or submission fields were introduced. Added the ongoing [Backend/API gap register](BACKEND_API_GAPS.md), linked from migration/extension registers and Design.

Validation: TypeScript/production build and six focused mocked browser tests passed, including disabled/no-upload controls, unchanged canonical request payload and retry identity, requester scope and mobile overflow. Live 5174 visual review and 390px overflow check passed without submitting a request or selecting files. Existing uncommitted work is preserved.


### Request-form information tooltips — 2026-10-10
Moved the Create Blood Request description and all five section descriptions/placeholder explanations into right-aligned circled information buttons. Hover, keyboard focus and tap reveal the text; Escape dismisses it. Disabled fields and request payloads remain unchanged. Production TypeScript/build and diff checks passed. Live browser checks verified six help controls, initially hidden descriptions, hoverable tooltip content, focus/Escape behavior and 390px layout without horizontal overflow. No live request was submitted.


### Request list and detail heading help — 2026-10-10
Added the same right-aligned information buttons to Blood Requests and Request Details, including the selected-record header; the corresponding Transfers view follows the same pattern. Expanded help explains list columns, record selection, refresh, pending confirmation, available detail fields and currently unavailable actions. Descriptions stay hidden until hover/focus/tap. Build, diff check and ten requester/shared-record browser regressions passed. Live scoped tooltip checks and narrow-screen overflow checks were performed without submitting data. No backend dependency changed.


### Request form placement and opening animation — 2026-10-10
Moved Create Blood Request below the Blood Requests / Request Details row. Opening the form (including dashboard new-request navigation) smoothly scrolls it into view; repeated New Blood Request clicks return to the already-open form. Reduced-motion preferences use immediate scrolling, with a scroll inset for the fixed review bar. Production build and diff checks passed. Live checks verified document order, scrolling/repeated clicks, Cancel, and mobile/reduced-motion layout without overflow. No backend behavior or payload changed.


### Requests & Transfers visual cleanup — 2026-10-10
At the user's request, removed the requester workflow card's red left accent and the top-right simulation badge on `/transfers`. The neutral card border stays in place. API classification and record provenance are unchanged; this is presentation cleanup only.


### Requester workflow card — 2026-10-10
Removed Workflow owner and the facility-name block from this card. Moved its description to a right-aligned information button and expanded it into four instructions covering form submission/operator verification, request-status review, linked transfer tracking and receipt-status limitations. Retained the four visible workflow stages, with a mobile title/help row above them. Build and diff checks passed; live hover/focus/Escape and 390px overflow checks passed. Existing backend/API gaps and disabled actions remain unchanged.


### Requester page-level PDF export removed — 2026-10-10
Removed the unused Export PDF header button from requester Requests & Transfers following user review. GAP-06 now records the page-level export as removed from current scope, with any per-transfer document subject to a future confirmed use case. Updated the existing regression to expect no export button.


### Shared red form focus style — 2026-10-10
User preference now applies BloodLedger red to focused form fields throughout all account pages. Added the `--focus-ring` token in web and capture styles, changed blue focus outlines to that token and defined input/select/textarea focus borders for click and keyboard interaction. Recorded the rule in Design for future work. Field values, validation and API behavior are unchanged.

Validation for the shared focus rule: web TypeScript/production build and all 112 unit tests passed. Live dashboard and request-form dropdown/input borders and outlines resolved to BloodLedger red (`rgb(154, 27, 27)`). Capture TypeScript passed; normal OCR preparation/default output build hit existing generated-file ownership errors, so its Vite/PWA build was verified in `/tmp/bloodledger-focus-style-20261010` without changing ownership or deleting retained assets. Isolated capture build passed.


### Role-aware breadcrumb-bar help — 2026-10-10
Added a shared information control at the far right of dashboard and Requests & Transfers breadcrumb bars. The three blood-bank accounts use identical text; requester, PRC and DOH dashboards have their own plain-language descriptions. Promoted the existing accessible help implementation to a shared UI component; form help continues to use it. Build and diff checks passed; live checks covered all six account descriptions, bank-description equality, hover/focus/Escape, requester transfers and mobile overflow. No backend/API behavior changed.


### Dashboard product selection carried into requests — 2026-10-10
Request Blood now carries the selected blood type and component from requester Network Blood Availability into the new-request form. Only supported enum values are accepted as initial defaults; inputs remain editable and normal direct navigation retains existing defaults. Existing auto-scroll and submission behavior remain in place. Production build and four focused browser tests passed, including malformed-value fallback. Live B-negative/Platelets navigation preserved both selections without submitting data. No new backend/API dependency introduced.


### Primary requester routing placeholder — 2026-10-10
Replaced editable source selection with Supplier Routing / Assign automatically and label-side information help. Primary requester submission is disabled and its handler guarded because the existing API requires a source institution but automatic routing is not connected. GAP-05 records the exact dependency. Nine focused browser checks passed (including guarded primary submission, legacy retry/status behavior and product prefill); live MetroLipa and narrow-layout checks passed without sending a request. Production TypeScript/build passed.


### Requester loading/error presentation — 2026-10-10
Restyled requester Requests & Transfers errors as neutral bordered notices with an icon, stacked heading/message and a separate compact Retry control. Loading/unavailable list states have consistent spacing/type and a reduced-motion-aware loading indicator. Removed the yellow My Requests error banner as requested; missing records remain unavailable and the dashboard header Refresh is the recovery path. Preserved stale-data handling and authorization clearing. Build and five failure/recovery/navigation browser checks passed; isolated synthetic error visual review and 390px overflow checks passed. No API fallback or stored data was added.

### 2026-10-10 — Requester Blood Unit Receipt

Added requester-only navigation and inbound scanner layout referencing metro-lipa.html source. History uses actual destination-scoped received reservations. Photo/camera picker is preview-only (JPG/PNG, 10 MB preview limit), no persistence/upload/mutation; matching/confirmation deferred in GAP-19. Verified live Metro Lipa tab and desktop/mobile layout at port 5174. Browser checks cover own/foreign receipt scope, in-transit selection, verified reservation details, photo clearing on close, keyboard close, disabled confirmation/no POST, access denial and mobile overflow.

Validation passed: web production/type build; 113 web unit tests; 8 focused receipt/requester browser tests. Existing branch codex/lat-uat-frontend retained; unrelated working changes preserved. No receipt command submitted.

### 2026-10-10 — Receipt phone layout refinement

Read MetroLipa HTML phone-shell CSS directly. Removed receipt-page Simulation only badge, green inbound chip colors and red camera tile fill. Added neutral outlined camera tile and narrow framed phone scanner with internally scrolling capture/review sections. All previous scanner functionality and pending-integration gates retained.

Validation: production/type build and both receipt browser tests passed. Live 5174 computed styles confirm no Simulation only badge, transparent inbound/camera backgrounds, ink text/strokes and neutral camera border. Desktop/mobile screenshots reviewed.

### 2026-10-10 — Receipt Scan / Manual refinement

Referenced the HTML source for Scan/Manual modes and inbound fields. Removed transaction type and incoming transfer controls. Added manual entry overlay, local unverified preview and draft cleanup. Simplified close/title styling. Matching, operator receipt submission and recognized scan output remain deferred under GAP-19.

Validation passed: production/type build, 113 web unit tests, all 3 receipt browser tests. Live 5174 scan-tabs and manual-overlay desktop/mobile screenshots reviewed. Manual dropdown accessible names checked; nested Escape closes the entry sheet and returns focus, scanner close clears both photo and manual draft; no receipt POSTs generated.

2026-10-10 receipt manual layout amendment: Manual tab now immediately displays the fields inline in the phone input card. Enter/Edit unit details button and nested overlay removed. Draft survives tab changes, clears on scanner close, and Preview Entry remains local/unverified with no submission.

2026-10-10 Alerts visual refinement: shared summary now uses All alerts / Critical / Warnings / Information severity counts. Severity chip buttons with counts replace the Filter alerts label and severity/status dropdowns, following MetroLipa HTML. Alerts page help is in the rightmost top bar. Visible Simulation only badges/captions removed across web and capture screens; API classification metadata preserved. Temporary requester sample data remains development-only and mutation-disabled; its visible layout caption removed by user request.

### 2026-10-10 — Institution Profile / Accounts separation (FR-12)

Read full mockup ProfilePage, AccountsPage and StaffDirectoryManager source. Profile now contains facility and account information, contact/licensing placeholders and supported own-name editor. Accounts / Staff contains actual operator counts, search/status filtering and existing actions; PRC administrative tables remain scoped to Accounts. Permission/verification/version/idempotency paths unchanged; no API or database edits. Live 5174 requester read showed two operators, one administrator, two PIN/reset-revoke controls and Add administrator. Desktop and mobile screens reviewed; no horizontal page overflow. Web build/type check passed, all 113 web unit tests passed, and three new browser checks passed for screen separation, requester-scoped reads, read-only permission handling, filters, PIN retry binding and responsive overflow. No live administration command submitted.

Cross-account live verification: all three blood banks and MetroLipa have Profile and Accounts / Staff; PRC retains its institution directory in Accounts only; DOH has Profile without a staff administration link. No cross-institution directory loaded for non-PRC accounts.

### Apply for Access and Profile completion — 2026-10-10

Verified branch codex/lat-uat-frontend and preserved existing uncommitted work. Implemented category-specific four-step application layout and complete Profile sections without backend/API/schema changes. Unsupported fields/uploads/security controls remain disabled and excluded from application payloads; existing basic submission/status/withdrawal and operator administration remain connected.

Validation: check:web passed; test:web passed (113 tests); focused access-application.spec.ts and institution-profile-accounts.spec.ts browser checks passed (6 tests). Browser checks cover both application categories, password confirmation, exact supported payload keys, stable retry payload/idempotency key, disabled unsupported controls and Profile/Accounts separation. Live 5174 desktop/mobile visual inspection passed with no horizontal overflow. No application or operator mutation was submitted to the live service during visual inspection. Screenshots saved in the Codex visualization directory: apply-choices.png, apply-facility.png, apply-blood-bank-qualification.png, apply-mobile.png and profile-complete-sections.png.

### Blood-bank Inventory, Requests & Transfers, Activity History — 2026-10-10

Verified codex/lat-uat-frontend and preserved accumulated uncommitted changes, including expiry wiring. Compared source sections InventoryPage, TransfersPage and AuditPage in the supplied bloodledger-full-mockup.html. Implemented scoped faceted inventory filtering/search/expiry sorting; separate request and reservation tabs/search/status/detail panel; activity-type and combined search over actual redacted events. Added rightmost page and section information controls, neutral refresh styling, compact forms and responsive cards. Unsupported mockup mutations/exports/personnel fields were not activated.

Checks: check:web passed; test:web 113 passed; blood-bank-pages.spec.ts + expiry-wiring.spec.ts + requester-transfers.spec.ts 28 passed after correcting two new test selectors to the existing page-help accessible names. Existing contract-switch late-response and role-scoped canonical-action checks passed (2 tests). git diff --check passed. No mutation submitted during live review.

Live 5174 desktop/mobile screenshots: bank-inventory, bank-transfers, bank-activity (and -mobile variants) in the current Codex visualization folder. No horizontal page overflow on the three screens. Inventory live read was unavailable: authenticated 200 response contained nine records missing expiryState, required by the current parser. Current source route includes this field. GAP-24 records runtime/service alignment; fixture tests validate inventory rows, details and expiry semantics. Live transfer and activity records loaded. No live inventory-data-success claim is made.


### 2026-10-10 mockup blood-bank inventory, transaction hub and dashboard additions

Branch `codex/lat-uat-frontend` verified; prior uncommitted changes preserved. No API/schema/ledger changes. Blood Inventory mockup toolbar, filters/table and actual PDF; separate Blood Unit Transactions navigation/history/phone capture/PDF; bank Requests & Transfers tabs/workflow/inline form; Requests and Network Blood Availability cards for all three local bank accounts. Unsupported CSV/PRC/network features remain explicit placeholders (GAP-16, 25–27). Live component read still lacks required expiryState (GAP-24); validation is not weakened.

Validation: web production build passed, 114 unit tests passed, 38 focused browser tests passed across blood-bank pages, expiry wiring, requester transfers and operational navigation. Browser checks cover filtered PDF download bytes and references, excluded records/Donation identifiers, separate transaction route and phone iframe, bank dashboard additions, new-request prefill/cancel and PRC empty state. All three actual local blood-bank accounts were inspected on 5174; Requests and Network Blood Availability cards and transaction navigation appeared. Existing cold-read session-epoch errors can require Refresh; no successful empty stock is fabricated.

A real 10-record transaction PDF from 5174 was exported and both pages rendered with Poppler and visually inspected. Table rows stay together, headings repeat, full permitted references remain readable, and page footers are present. Filtered inventory exports were verified with supported API fixtures; live inventory export stays disabled under GAP-24.

Capture typecheck passed. Normal capture build prebuild failed because existing generated OCR assets/service-worker files are root-owned. Worker, language hash and all core assets were verified against the pinned dependencies; Vite production build then completed under WSL root using those verified assets without changing source or ownership. The existing capture workspace remains the scanner command boundary.

Capture deployment verification: the running API registers static asset filenames at startup, so freshly built hashed assets initially fell through to its HTML fallback. Restarted the existing local API container to refresh static routes, then restarted the web container because it shares that network namespace. No containers or stores were replaced. Authenticated 5174 phone iframe now loads Blood Component Intake / INBOUND_OCR_V1, with no visible Simulation only badge; scanner screenshot rechecked. Database and Fabric containers remained running.


2026-10-10 sidebar scrollbar correction: removed the later restored-shell CSS override that set `.nav` scrollbar-width to thin. The existing scrollbar-width:none and WebKit display:none rules now apply, retaining overflow-y:auto. Live Chromium verification at 1280x650 confirmed hidden scrollbar computed styles and actual mouse-wheel scrolling from scrollTop 0 to 92. git diff --check passed. No navigation structure or permissions changed.


2026-10-10 bank dashboard ordering/error refinement: inventory overview moved above requests/network cards. Initial failure retains bank stats, inventory placeholder and bottom cards inside the same dashboard container. Shared dashboard loading/error notices have compact typography, wrapping details and Retry; refresh failures preserve the last confirmed read. Web build and 7 blood-bank browser tests passed, including ordering, long error wrapping at 390px, retry recovery and retained confirmed data on a subsequent refresh failure. Desktop/mobile failed-read screenshots visually inspected; API failure was browser-intercepted only, with no service or data mutation.


2026-10-10 bank dashboard request-table refinement: removed both bank-card information controls; split Blood into plain Blood Type and Component columns. Web build and git diff --check passed. Live 5174 inspection confirmed six headings, an A+ / Cryo row in separate cells, zero card information buttons, and no page overflow at 390px. Desktop screenshot visually inspected. Existing requests and product-prefill behavior retained.


### 2026-10-10 receipt-style bank mobile scanner

Branch codex/lat-uat-frontend retained and existing source changes preserved. Native phone layout now matches requester receipt scanner; adds Inbound/Outbound tabs, equal Scan/Manual tabs, inline fields and hidden-scrollbar scrolling. Inbound verified OCR capture uses compact iframe styling with same-origin/source-checked height messaging. Outbound image/manual previews remain volatile and mutation-free; switching direction or closing clears previews. Confirmation remains disabled for unconnected manual/outbound matching, with a link to supported Requests & Transfers. GAP-25 updated.

Validation: final web production build and capture TypeScript check passed; capture production build passed using existing generated root-owned output; 16 capture unit tests passed; 11 focused bank/receipt browser tests passed. Coverage includes outbound/manual rendering, photo preview, disabled confirmation, zero POSTs during previews, draft/image clearing on direction changes, mobile width, keyboard mode switching and close/focus restoration. Requester receipt tests still pass. Live 5174 inbound/outbound/manual phone screenshots visually inspected. Live compact capture recognized an approved synthetic fixture and reached extracted-field review with zero submission POSTs; iframe resized to show review controls. No real label or real-device claim.

Local API/web containers restarted to refresh capture asset filenames and their shared network listener; database/Fabric stores were not replaced. No backend source or contracts changed.


2026-10-10 temporary requester Alerts cleanup: deleted temporary-requester-alerts.ts and removed its import/enable flag/data override from FeatureRouter. This supersedes the earlier development-only alert preview state. Web build and git diff --check passed. Live requester navigation to Alerts issued GET /api/v2/alerts with status 200, and no PREVIEW_ALERT/PREVIEW_UNIT identifiers appeared. Stored API synthetic records and test fixtures were preserved; no database/ledger cleanup performed.


2026-10-10 bank toolbar icon alignment: Inventory and Blood Unit Transactions toolbar buttons use flex centering with an 8px icon-label gap and non-shrinking block SVGs. Live 5174 checks verified the gap and exact vertical icon/button center alignment for Export PDF, Import CSV, Blood Unit Transactions and Refresh. Inventory screenshot visually inspected; git diff --check passed. Button behavior and API contracts unchanged.


2026-10-10 inventory filter simplification: two compact dropdowns replace crowded chip lists; wider search shares the desktop row and stacks responsively. Web build, git diff --check and 8 blood-bank browser tests passed. Inventory coverage now selects dropdowns and verifies blood/component intersection, empty results, search, details and selected-snapshot PDF exports. Live desktop controls align at the same vertical position; desktop and 390px screenshots visually inspected with no page overflow. Live unavailable inventory behavior under GAP-24 remains unchanged.


2026-10-10 inventory dropdown availability: removed the data-loaded disabling condition from Blood type and Component filters. All supported choices can be selected during loading/error states; unavailable counts are omitted and no stock is fabricated. Live browser verification selected B_NEGATIVE and PLATELETS without valid loaded inventory, with 9 blood-type and 6 V2.1 component choices present. git diff --check passed.


2026-10-10 PRC/DOH Alerts card alignment: replaced aggregate table with shared alert cards, preserving institution/status/count/time and read-only permissions. Final web build, git diff --check and 3 focused browser checks passed: PRC and DOH card/filter/mobile/no-POST behavior plus existing institution acknowledgement retry. The new test initially expected title-case Open, corrected to the existing OPEN display convention. Live local PRC and DOH each showed one existing aggregate alert card; desktop screenshots visually inspected. No frontend samples activated and no API/database changes.


2026-10-10 alert summary severity colors: Critical, Warnings and Information cards now always apply their existing severity classes, including zero counts, across the shared Alerts view. Live PRC inspection confirmed Warnings 0 retains amber border/background and Information 0 retains blue border/background; critical remains red and All alerts neutral. git diff --check passed. Counts/filter behavior unchanged.


2026-10-10 alert card color refinement: replaced gradients and thick side accents with uniform severity borders and solid light backgrounds. Live blood-bank critical alert computed styles verified no background image, four 1px borders, red border and pale red background. git diff --check passed. Shared change also covers requester and PRC/DOH aggregate cards.


2026-10-10 alert container refinement: filter outer border removed, row inset/padding increased and chips given larger padding. Alert list and cards now transparent over the original outer surface; severity borders and colored summaries retained. Live blood-bank computed styles confirmed 0px filter border, 18px inset, 10px vertical padding, transparent card/list background and 1px alert border. Desktop screenshot visually inspected; 390px viewport has no horizontal page overflow. git diff --check passed.


2026-10-10 user clarification: restored individual alert severity background tokens (critical-container, warning-container, information-container), preserving the neutral list and borderless padded filter row. Uniform severity borders remain; no gradients or thick edge accents restored.


2026-10-10 Activity History layout refinement: duplicate permitted-record caption removed, compact heading/Refresh row, aligned summary/record edges and activity dropdown alongside search. Web production build, git diff --check and 8 blood-bank browser checks passed. Audit coverage verifies combined dropdown/search filtering, empty state, heading Refresh, absent caption and matching summary/record left/right geometry. Live 5174 desktop screenshot visually inspected: controls share a vertical position, original 16 scoped records retained. 390px layout has no page overflow. Dedicated audit read wrapper keeps header available through loading/errors and preserves authorized endpoint selection and confirmed data on refresh failures.


2026-10-10 bank request product columns: split combined Blood/component into separate Blood Type and Component cells; removed the blood badge in favor of plain black text. Web build and git diff --check passed. Live 5174 table has six distinct headers; blood type computed black with 0px border and transparent background. 390px layout has no page overflow.

## 2026-10-10 bank request/transfer details and PRC supply presentation

Branch codex/lat-uat-frontend retained; existing uncommitted changes preserved. Full request/reservation rows select fresh validated scoped details, retaining keyboard reference buttons. Linked request/reservation navigation works. Missing clinical/pickup/doc fields show unavailable; mockup decision/custody actions remain disabled under GAP-07/08/09. PRC Supply Request opens a category-specific mockup requirements form; unsupported fields and final submission are disabled under GAP-16. Supplier workflow matches requester presentation. Facility Operations, Start Local Release and Recorded Operations retained; future placement discussion noted in PAGE_MIGRATION.

Validation: check:web TypeScript + production build passed; 19 browser tests passed across blood-bank-pages, requester-transfers and blood-unit-receipt. Includes full-row detail selection, linked reservation navigation, unavailable actions/no POST, destination-only receipt, access denial clearing details, PRC form open/cancel, requester regressions and mobile width. Initial shared product layout changed requester text; corrected by limiting separate detail product fields to bank views, then all 19 passed. git diff --check passed. Live 5174 bank page verified with three actual requests: row opened scoped details, PRC supply form visible, mobile 390px fits. Screenshot bank-prc-request-form.png inspected. No backend/API/ledger mutations performed.

2026-10-10 bank detail visual revision: TypeScript/build passed and 16 bank/requester browser tests passed. Live 5174 request and transfer panels inspected using actual scoped records; desktop screenshots reviewed and inherited heading padding/duplicate borders corrected. 390px transfer view fits viewport. Progress highlights only the current canonical state, without guessed past-event evidence.

2026-10-11 dashboard outer frame removal: shared DashboardPage uses a neutral layout section instead of card/feature-card. Scoped section gutters align summaries and inventory/request/network/PRC/DOH cards with the page. check:web passed. Live 5174 verification across all six accounts (three banks, requester, PRC, DOH): outer section has zero border, transparent background, aligned first section, and no document overflow at 390px. Existing inner cards and behavior preserved.

2026-10-11 compact dashboard header validation: check:web passed. Live six-account verification confirmed removed captions, zero heading margins and 12px vertical/18px horizontal header padding. Typical desktop header height 49–51px; PRC coordination header 56px due to its existing secondary action label. All role dashboards fit 390px width. Requester initial transient session-change read recovered with existing Refresh; no API changes made.

2026-10-11 local-release frontend retirement: removed Facility operations header and V2LocalRelease form; removed frontend submitV2LocalRelease caller while preserving the API helper, endpoint and capability mapping. LOCAL_RELEASE reservations expose no mutation actions, including prepare/completion; records/history remain readable. Recovery and recorded operations retained. Existing request form remains behind New Blood Request. No service/backend source modified.
Validation: check:web passed after correcting narrowed-purpose action policy. 146 frontend unit tests passed. Browser checks: 44 of initial 47 passed; three request-correction tests still expected the retired release button, updated to supported request submission and all three reran successfully, together with two role/absence checks (5 passed). Total 49 distinct browser checks passed across runs. Local-release reservation test confirms readable evidence/no buttons/no POST. Live 5174 verified all three bank accounts: no Facility operations/Start local release/Queue/Complete local release controls and zero local-release POSTs. git diff --check passed.

2026-10-11 recovery/history removal: bank Requests & Transfers no longer shows Recover accepted command, its description, Recovery lookup, Accepted command ID or Recorded operations. Shared detail explorer hides manual recovery in this workspace, including linked component/reservation views. Backend endpoints/helpers retained. check:web passed; 26 bank/workflow browser checks passed, including absence/no POST and unchanged transfer actions, authorization and ambiguous-submission protection. Live 5174 verified all three banks with opened transfer details: recovery form and history absent.

2026-10-11 initial-screen loading polish validation: check:web passed; 146 unit tests passed. 27 browser checks passed (9 delayed-layout/transient-read checks, 10 bank-page checks, 6 requester-transfer and 2 regulatory-alert checks). After strengthening stale-session response handling, 10 focused layout/real-401 checks passed again. Stale account responses produce AUTH_CONTEXT_CHANGED before their body/errors are consumed; new session reads retry without exposing old records, while current-session 401 still clears protected UI. Live 5174 all six accounts verified with 600ms delayed V2 reads: dashboard cards and alert filters remain visible, no initial Unable to load data panel. Persistent failures retain Retry and unavailable values; no synthetic counts or records added. git diff --check passed.

2026-10-11 persistent inventory table: check:web passed; 20 bank/initial-layout browser tests passed. Added unavailable-to-empty retry check verifies six columns, centered colspan=6 row, no fabricated unit actions, disabled PDF without rows, and 390px fit. Live 5174 browser-only 503 fixture used for screenshot inventory-unavailable-table.png; layout inspected. No backend/data changes.

2026-10-11 inventory heading/hover refinement: renamed table Blood Unit Inventory and removed inventory-specific hover fill/left stripe. Existing focused Playwright inventory filtering/detail, PDF export and unavailable/empty layout checks passed (3/3), including the web build. Live 5174 browser verified heading and hovered row computed transparent background / no box shadow. Existing checkout changes preserved on codex/lat-uat-frontend.

2026-10-11 inventory layout simplification: focused inventory browser checks passed 3/3 with web build. Live 5174 verified six table columns, absent section title/counter/help row, Last refresh label and Inventory view options after the freshness footer at the bottom of the operational layout. Existing branch and uncommitted changes preserved.

2026-10-11 joined inventory filters/table: web build and focused browser checks passed 3/3. Live 5174 at 1440px and 390px confirmed zero filter/table gap, 1px separating border, six columns and no page overflow. Shared outer border uses rounded corners and table retains horizontal scrolling.

2026-10-11 inventory redundant error-control removal: web build and focused unavailable-to-empty inventory browser check passed. Verified View details and Retry inventory absent, six-column table retained, and header Refresh successfully reloads inventory.

2026-10-11 separate PRC supply action/form layout: HTML mockup inspected (prc-connection-banner followed by prc-request-form). Web build and two focused transfer/PRC browser checks passed. Live 5174 at 1440px/390px verified action card below workflow, separate from record list, full-width inline form beneath action card, Cancel closes it, and no page overflow. Submission remains disabled and backend untouched.

2026-10-11 compact PRC form: build and existing PRC open/cancel/no-submission browser check passed. Live 5174 verified first row blood type/component/units, second row priority/date-time, removed availability paragraph, authorization before footer actions, and mobile viewport fit.

2026-10-11 PRC single-row and form navigation: web build and two focused browser checks passed, covering repeated PRC clicks retaining/scrolling to the form and mutual exclusion in both directions. Live 5174 verified five aligned desktop fields, only one request form open, and no overflow at 1440/900/390px. Intermediate widths wrap fields, narrow widths stack. API behavior unchanged.

2026-10-11 bank New Blood Request visual refinement: web build and two focused browser checks passed (dashboard prefill/open/cancel and mutually exclusive request forms). Live 5174 verified five equal fields on one desktop row, 8px card/header corners, Submit label and mobile viewport fit. No submission logic changes.

2026-10-11 PRC contextual scroll/operator overlay: web build and five focused browser checks passed, including repeated PRC scrolling, mutual form exclusion, verified transfer retry/idempotency and correction behavior. Live 5174 overlay at 1440px/390px verified same-row Operator/PIN, equal compact footer buttons with Cancel left, cleaned institution header, removed PIN caption and no overflow. Live overlay inspection cancelled without entering a PIN or submitting a command.

2026-10-11 PRC Network View simplification: check:web passed. Live PRC administrator account on 5174 verified Network view page heading retained, technical subheading/paragraph absent, blood type/status cells black with transparent background and no border, and no inventory badges remaining in this table. Data and authorization unchanged.

2026-10-11 PRC Reports presentation: check:web passed. Live PRC administrator Reports on 5174 verified five report headers, removed Stored synthetic census reports title, centered no-record messages in a five-column empty row, and mobile viewport fit. No report data or backend changes.

2026-10-11 refresh icon unification: all frontend Refresh controls use shared circular arrows with standard 1.6 stroke; old duplicated icon paths removed. Live 5174 verified identical icon on all six role-account dashboards. Non-refresh camera/warning/loading symbols retained.
