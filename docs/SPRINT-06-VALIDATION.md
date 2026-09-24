# Sprint 6 Frontend/Backend Integration Validation

**Status:** Jopia backend integration implemented and technically validated;
browser automation and human acceptance remain open

**Branch:** `codex/s6-frontend-backend-integration`

**Source baseline:** Lat commit
`111681e26d2c91515cdea75f71faf341768cc1fa`, which contains `main`
`fbd9a844fe65b0a66d5eecb64daa44455fbddb6e` and seven subsequent frontend
integration commits

**Accountable technical owner:** Jopia

**Validation dates:** 2026-09-19 through 2026-09-20

**Classification:** `SIMULATION_ONLY`

This record contains sanitized synthetic evidence only. It does not contain an
interview transcript, approval artifact, exact Donation No., OCR material,
participant identity, patient/donor information, or institutional production
data.

## Decision and implementation baseline

`BL-DEC-S6-2026-09-19-01` records the adopted prototype decisions for
`SYNTHETIC_RECONCILIATION_REASONS_V1`,
`DOH_CENSUS_COLUMN_ORDER_V1`, and zero browser persistence of exact Donation
No. values. The sanitized interview source is `BB-INTERVIEW-2026-09-07` and
the provenance was reported by Jopia. The reconciliation vocabulary and
browser retention rules are technical prototype decisions; they are not
interview-approved clinical classifications.

The integration implementation is grouped in these Jopia commits after Lat's
baseline:

| Commit | Scope |
|---|---|
| `665274d` | Integration baseline and synthetic decisions |
| `ba16250` | Session-cookie forecast authentication |
| `e270b44` | Scoped reservation reads and action scope |
| `635295d` | Versioned reconciliation reason discovery and enforcement |
| `12a2a96` | Authorized census snapshot discovery |
| `15db63f` | Actor-scoped safe command recovery |
| `d66cf03` | V2 OpenAPI repository formatting correction |
| `ce55130` | PostgreSQL recovery-status parameter typing correction |
| `4f712c9` | PostgreSQL and real-Fabric recovery harnesses |
| `9a5d768` | Scoped secret-scan fixture cleanup |

Lat's seven inherited commits remain unchanged. The branch was not rebased,
squashed, or rewritten.

## Reproducible technical evidence

| Boundary | Result |
|---|---|
| API build and tests | **PASS** — 97 tests passed, 0 failed. The five affected V2 contract tests passed again after the final fixture cleanup. |
| Chaincode | **PASS** — format/lint/typecheck, static boundary, and 30 tests passed. |
| Web application | **PASS** — production build and 50 unit tests passed. |
| Capture PWA | **PASS** — pinned OCR assets prepared, production build, and 14 unit tests passed. |
| PostgreSQL | **PASS** — a disposable database applied all 21 forward migrations; legacy probes and Sprint 6 reservation, V2.1 cryoprecipitate, recovery scope, census discovery, replay/conflict, and privacy probes passed. |
| Static contracts | **PASS** — API typecheck/static boundary, Sprint 6 integration boundary, OpenAPI/JSON formatting, version consistency, environment-template, and chaincode boundaries passed. |
| Secret scan | **PASS for Jopia changes** — Gitleaks 8.30.1 scanned all changed files from `111681e` and found no leaks. The repository-wide history command still reports six inherited findings and therefore is not recorded as a repository-wide pass. |
| Real Fabric recovery | **PASS** — isolated validation chaincode `bloodledger-inventory-s6-20260919`; transaction `28de6e6411c8c58191a25222a13bbfb7a77049966e09e41d2534948ca358d28f`; one initial submission; command remained `LEDGER_COMMITTED_PROJECTION_PENDING`; project-scoped peer/orderer restart; recovery made zero submissions, completed on attempt 2, wrote one projection row at version 1, and preserved the same transaction ID. |
| Playwright web/Capture suites | **BLOCKED** — the local Chromium binary cannot load `libnspr4.so`; web and Capture suites stop at browser launch. Production builds and unit tests above are separate evidence. |

The real-Fabric test used a separately named validation definition because the
running shared `bloodledger-inventory` definition is the earlier Sprint 3
package and does not contain `InterviewCoreContract`. The shared definition was
not replaced. The validation harness runs its gateway client in an ephemeral
Node 24.17.0 container on the project Docker network, restarts only
`bloodledger-peer0-mediatrix-1` and `bloodledger-orderer0-1`, and uses a
disposable PostgreSQL database.

Primary tool versions were Node.js 24.17.0 for final focused validation,
TypeScript 5.9.3, PostgreSQL 17.10, Fabric peer/orderer 2.5.16, Docker 29.6.1,
Docker Compose 5.3.0, and Gitleaks 8.30.1. An earlier complete API rerun used
Node.js 24.18.1 because that was the available Linux runtime before the pinned
24.17.0 installation was selected.

## Verified behavior

- Forecast reads accept a valid revocable `bloodledger_session` for ROLE-01,
  ROLE-02, and ROLE-03. An invalid, expired, or revoked supplied cookie fails
  authentication and does not fall back to bearer credentials.
- Reservation list/detail reads are source-institution scoped for ROLE-01/02
  and destination scoped for ROLE-03. Out-of-scope and absent records have the
  same not-found response. V2 does not silently discard V2.1
  `CRYOPRECIPITATE` components.
- Reconciliation discovery returns exactly the seven
  `SYNTHETIC_RECONCILIATION_REASONS_V1` codes. Unknown codes and free text are
  rejected before enqueue, and the policy version is carried as command
  evidence while excluded from the Fabric contract payload.
- Census discovery lists only existing snapshots, applies institution scope to
  ROLE-01/02 and aggregate scope to ROLE-04, publishes the confirmed display
  order, and keeps capture/copy/export unavailable pending full format approval.
- Command recovery is limited to the original actor and institution, supports
  exact idempotency-key lookup, and returns safe envelopes without stored
  payloads. Idempotency keys cannot cross actor or institution scope.
- Exact Donation No. and OCR material are excluded from reservation, census,
  command-recovery responses and logs exercised by the tests.

## Remaining gates

- Lat must implement the frontend follow-ups in
  [LAT-S6-FRONTEND-HANDOFF.md](./LAT-S6-FRONTEND-HANDOFF.md) and perform human
  browser acceptance. The automated Playwright block must be resolved or
  rerun on a host with the required Chromium libraries.
- Buno retains human forecasting method and lineage review. `RQ-07` still
  blocks operational forecast-accuracy claims.
- Full DOH report format approval, capture activation, copy/export, external
  issuer rules, key custody/rotation/recovery, physical Android OCR evidence,
  approved UAT participants/consent/instrument/custody, and all unresolved
  clinical, operational, institutional, privacy, regulatory, and production
  decisions remain open.
- Jopia performed this technical validation. It is self-validation and is not
  independent stakeholder review, human UAT, clinical validation, deployment,
  or production acceptance.

Issues #9 and #13 and overall Sprint acceptance remain open until their
remaining owner and human acceptance criteria are satisfied.

## LAT follow-up validation — 2026-09-23

PR #14 was reviewed at `91ac87d` in an isolated worktree and merged through
the normal merge-commit method at `40b8c64`. LAT's technical review recorded
API 97/97, chaincode 30/30, web 50/50, Capture 14/14, web browser 22 passed
with seven retired V1 fixtures skipped, Capture browser 3/3, and all 21
migrations plus the Sprint 6 disposable-PostgreSQL probes. This host's Chromium
launched successfully; the earlier `libnspr4.so` block remains a true record
of Jopia's separate host.

The separate `codex/s6-frontend-followups` branch connects reservation,
reconciliation, census, and actor-scoped command recovery. Web and Capture
production builds passed; web unit 54/54, Capture unit 14/14, web browser
23 passed with seven retired V1 fixtures skipped, and Capture browser 4/4
passed. Repository foundation checks passed. The Sprint 6 static boundary
script exits at its explicit branch-name gate on this frontend branch; its
backend-branch evidence remains recorded above.
An isolated live API smoke test used the built frontend bundles and a
disposable PostgreSQL database with all 21 migrations and one synthetic
ROLE-01 account. Cookie-authenticated forecast, reservation, reconciliation
reason, census, and command-recovery GETs returned HTTP 200. The test server
and database were removed. This confirms connectivity and authentication, not
populated custody workflows or human UAT.
This is LAT technical validation, not human UAT. Jopia's prior real-Fabric
restart/submission-count result was not repeated because these follow-ups do
not change chaincode or its backend submission path.

Those September 23 discrepancies are resolved by the Jopia review below.
BUNO's human method/lineage review and all formal
participant/consent/instrument gates remain open.

## Jopia review of draft PR #15 — 2026-09-23

**Review baseline:** LAT head `847e43e`; isolated branch
`s6-pr15-backend-review`, with LAT commits preserved. Jopia performed this
technical validation and records it as self-validation. PR #15 remains draft.

- `fix(api)` corrects the OpenAPI reconciliation discovery path while retaining
  the hold POST. A focused contract test confirms both operations.
- `BL-DEC-S6-2026-09-23-01` versions four synthetic compromise reason codes.
  ROLE-01/02/03 may discover them. API validation rejects unknown or free-text
  codes before enqueue; chaincode independently enforces them, authorization,
  version, state, and deterministic replay. Committed reservation evidence
  includes the code and policy version; components become `COMPROMISED`.
- Web compromise actions require discovery, an eligible committed reservation,
  a reason, and explicit quarantine confirmation. Policy failure disables the
  action. Capture receipts are scoped to actor and institution; terminal
  retention starts on observation and expired receipts cannot be recreated by
  recovery. Cancellation, timeout, logout, and session loss invalidate late
  asynchronous results and clear the native file input.

**Executed on Node 24.17.0/npm 11.13.0:** repository foundation, API,
chaincode, web, and Capture checks/builds passed. API 100/100, chaincode 31/31,
web 55/55, and Capture 14/14 unit tests passed. The disposable PostgreSQL
probe applied all 21 migrations and passed the Sprint 6 scenarios plus
compromise quarantine and replay without a second component version change.
The pinned `mcr.microsoft.com/playwright:v1.61.1-noble` container passed Capture
7/7 browser cases and web 25 passed with seven retired V1 cases skipped. These
are automated synthetic tests, not human UAT or physical Android evidence.

The complete repository-history Gitleaks 8.30.1 scan reported seven inherited
findings; the review commits and current tracked/candidate content had no
findings in scoped scans. Two synthetic projection-probe idempotency IDs have
a path- and value-scoped allowlist in `.gitleaks.toml`; they are not credentials.
The Sprint 6 integrated script was not run because
its explicit branch guard admits only its original backend branches; its
applicable checks were run separately.

**Live Fabric `BLOCKED`:** the project peer was stopped by a stale Docker
socket mount. A project-scoped peer recreation preserved its volumes and
restored container health, but peer logs show repeated TLS verification
failure against the orderer authority. No new compromise transaction was
submitted. The prior accepted real-Fabric recovery result applies to its
older validation package only. Do not count this as live-chaincode acceptance.

LAT visual acceptance, BUNO human method/lineage and wording review, formal
participant UAT, institutional compromise policy, `RQ-07`, full report format,
offline V2 capture, physical Android OCR, clinical/regulatory, and production
gates remain open. Issues #9 and #13 remain open.

## LAT combined frontend validation — 2026-09-24

LAT integrated BUNO's authored Analytics review commit above Jopia's PR #15
head, preserving both authors' commits. The one browser-test conflict retained
the compromise and stale-forecast cases. Old browser expectations were updated
for PRC Analytics access and date-matched forecasts.

On Node 24.17.0: web build passed; web unit 56/56; web Playwright 26 passed
with seven retired V1 cases skipped. Capture build and 14/14 unit tests passed;
Capture Playwright passed 7/7. These are synthetic technical checks. LAT visual
acceptance and participant UAT remain unrecorded. Live Fabric validation of the
changed compromise transaction remains Jopia's separate TLS-blocked gate.

## Jopia follow-up to LAT's 2026-09-24 Fabric request

**Branch:** `codex/s6-fabric-compromise-validation`, based on PR #15 head
`c61ce3e`; LAT and Buno commits remain ancestors. **Owner/validator:** Jopia
(self-validation). **Classification:** `SIMULATION_ONLY`.

The stale Docker socket mount stopped the project peer. Jopia recreated only
`peer0-mediatrix` with `docker compose --project-name bloodledger up --detach
--no-deps --force-recreate peer0-mediatrix`, preserving both Fabric data volumes,
identities, and the orderer. The peer became healthy. Its block-delivery logs
still report `x509: certificate signed by unknown authority` when connecting to
the orderer. A signed `peer channel getinfo` fails the channel's Application
Readers policy. The orderer admin API reports `bloodledger-dev` active at height
49 with `consensusRelation: follower`. The orderer TLS server certificate
verifies against the generated root; the generated channel block pins the same
orderer server certificate and orderer/Mediatrix roots as the current generated
files. This does **not** prove that the peer's persisted channel configuration
trusts those files. The cause of that persisted-channel disagreement remains
unresolved.

Grouped commits add a read-only
[`preflight-fabric-trust.sh`](../network/scripts/preflight-fabric-trust.sh)
and a one-shot
[`v2-fabric-compromise.sh`](../tests/api/v2-fabric-compromise.sh) validation
harness. The preflight checks generated and mounted certificate fingerprints,
channel-block roots, node health, signed peer channel access, and synchronized
heights. The harness refuses an existing validation definition/database, pins
the package ID and definition, and uses a disposable database and synthetic
Gateway scenario for capture, FEFO reservation, preparation, dispatch,
compromise, quarantine projection, restart recovery, and replay. On this host,
`BLOODLEDGER_COMPROMISE_RUN_SUFFIX=S6SEP24A
tests/api/v2-fabric-compromise.sh` stopped at the preflight **before** package
installation, database creation, or a compromise submission. The focused live
result is therefore **BLOCKED**, not a pass; there is no new package ID or
transaction ID to report.

Static syntax checks passed for both shell scripts and the Node probe. API
typecheck and 100/100 unit tests passed; chaincode formatting, lint, typecheck,
and 31/31 unit tests passed. Those results retain their separate automated
scope and do not validate the changed package on live Fabric.

**Recovery gate:** keep the current ledger and identities unchanged. First
locate an approved backup of the identity/channel trust material matching the
persisted ledger or establish an authorized channel-configuration update path.
If neither exists, the project-scoped `reset-fabric` policy in
[`LOCAL-DEVELOPMENT.md`](LOCAL-DEVELOPMENT.md#level-1--fabric-network-reset)
is the documented recreation path, but it deletes the local Fabric ledger and
generated identities. That destructive operation needs a separate explicit
decision after preservation/backup and impact review. Do not use it to turn the
current blocked result into a pass.

LAT visual acceptance, Buno personal acceptance, participant UAT, institutional
compromise policy, `RQ-07`, full report format, offline V2 capture, physical
Android OCR, and clinical/regulatory/production gates remain open. Issues #9
and #13 remain open; PR #15 remains draft.
