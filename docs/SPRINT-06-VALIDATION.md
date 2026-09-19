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
