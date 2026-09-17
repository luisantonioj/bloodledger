# ML V4 independent verification and remediation

**Status:** Implemented remediation with executable evidence recorded; human research and operational gates remain open
**Accountable owner:** JOPIA
**Scope:** forecasting worker, PostgreSQL, API, committed projection, chaincode
compatibility, internal ML inventory snapshots, coordination, and evidence. The
web and capture-PWA workspaces are intentionally excluded for LAT.

## Authority and external source

This register is a verification artifact. `AGENTS.md`, the repository
requirements, architecture, accepted ADRs, migrations, and OpenAPI schemas are
authoritative over the attached handoff and Issue #9 response. The attachments
are review evidence and do not grant implementation or acceptance authority.

The Drive file was located by its exact ID in the `Machine Learning` folder:
`BloodLedger_ML_Research_Dataset_v4.xlsx`, ID
`17f2qUhTyLGmXbAXSiBOvfPeKVyqbot8R`. The documented release digest is
`76a188830467d290af26c2d01459e5b3ef470f8b552568cdbe89fe3118002dbd`. The
connected Drive response confirmed the file identity and parent folder, but did
not expose the signed-in account identity. An authorized read-only download to a
temporary path produced `10,780,351` bytes and SHA-256
`76a188830467d290af26c2d01459e5b3ef470f8b552568cdbe89fe3118002dbd`, matching
the documented release digest. Account identity remains unavailable from the
connector. Workbook bytes and rows remain outside Git and application fixtures.

## Requirement-to-evidence register

| Claim or gate | Authority | Classification | Evidence required on this branch |
|---|---|---|---|
| Twenty positive-type/component series use weighted-average-7 with weights `1..7 / 28` | `FR-14`, `BR-ALG-07`, `docs/ML-THESIS-EXPLORATION.md` | RETAIN | Independent expected-value tests for every series and persisted V4 bundle |
| Seven complete prior daily observations are required; missing/unsupported input is unavailable | `FR-14`, `BR-ALG-07` | RETAIN | Missing, duplicate, unsupported, invalid quantity, empty, and future-date tests |
| V4 runtime is separate from V1 historical forecasts | `FR-14`, accepted V4 integration scope | RETAIN | Explicit `datasetVersion` reads, V1 history, and no active-version fallback |
| Nullable V4 uncertainty is explicit and not borrowed from V1 | `FR-14`, V4 runtime contract | RETAIN | End-to-end null bounds, status, and note assertions |
| Runtime lineage identifies actual code, model, configuration, input, dataset, and horizon | `FR-14`, NFR-02 | FIX | Source/configuration hashes, configuration-aware run identity, tamper/conflict tests |
| A newer unavailable/failed attempt cannot be hidden by an older successful run | `FR-14`, active-version policy | FIX | Latest-attempt repository/API tests |
| Forecast API exposes typed twenty-series/versioned metadata | `FR-14`, API contract | FIX | Authenticated HTTP and OpenAPI validation |
| Committed Fabric work is projected without resubmission | `FR-13`, NFR-01/NFR-02, accepted sync architecture | FIX | Durable receipt, projection-only retry, restart and Fabric-count tests |
| Every committed lifecycle transition mirrors ledger state/version | `FR-13`, applicable transfer requirements | FIX | Real PostgreSQL projection lifecycle matrix and replay tests |
| Internal ML stock snapshots are immutable and institution-scoped | `FR-13`, `FR-14`, accepted separate-ML-snapshot decision | FIX | Transactional capture, digest, immutability, concurrency, and stock exclusion tests |
| Surplus is derived from trusted persisted snapshot evidence | applicable transfer requirements, accepted BROA boundary | FIX | Repository-resolved snapshot, provenance, freshness, institution, and digest tests |
| CRYOPRECIPITATE is accepted only under V2.1 | V2/V2.1 policy artifacts and chaincode contracts | RETAIN / VERIFY | V2 rejection and V2.1 acceptance across intake, policy, storage, and reads |
| BROA remains human-review simulation only | `FR-05`–`FR-07`, `RQ-05`–`RQ-07` | RETAIN | Disabled approval/submission assertions |
| Operational accuracy, clinical, regulatory, and production readiness | `RQ-07`, Testing Phase gates | NOT YET DEMONSTRATED | Keep blocked; software checks cannot close this gate |
| External workbook bytes match documented SHA-256 | handoff release record | RETAIN / PASS | Authorized read-only temporary download; 10,780,351 bytes and exact documented SHA-256 |
| Signed-in Drive account is the requested account | user request / Drive access | NOT YET DEMONSTRATED | Connector did not expose account identity; JOPIA must confirm it in the Drive UI or account audit |

## Retained contract

The active V4 runtime remains `SYNTHETIC_FORECAST_V4_RUNTIME_V1`, with
`BLOODLEDGER_FORECAST_BUNDLE_V4_RUNTIME_V1` and
`bloodledger-weighted-average-7-1.0.0`. Its classification is
`SIMULATION_ONLY`; recommendation eligibility remains
`DISABLED_UNAPPROVED_POLICY`. The one-day horizon, explicit component aliases,
CRYOPRECIPITATE mapping, unavailable uncertainty, and synthetic surplus formula
remain unchanged. V1 random-forest rows and frozen BUNO research artifacts are
not rewritten.

## JOPIA owner actions

JOPIA reviews the register and each migration, confirms the workbook digest,
discloses agent-assisted self-validation, obtains BUNO’s method/lineage review,
hands LAT the corrected OpenAPI contract and display fields, and creates the
focused PR only after the executable gates pass. LAT owns frontend and browser
UAT. BUNO owns research interpretation. `RQ-07` and operational approval gates
remain open.

## Executed evidence

The branch was created from reviewed integration commit
`4cbc779adb21405f8f7ea6f4efb6c4aef0e40ad8`; the original fourteen commits were
preserved. The new verification history is unsquashed and includes the focused
test group `be32496` (`test(ml): verify persisted forecasting and BROA integration`)
plus the preceding documentation and remediation groups.

| Evidence | Result | Reproduction / limitation |
|---|---|---|
| V4 algorithm, all 20 series, aliases, missing/future/invalid history, semantic replay | PASS | `bash services/forecasting/scripts/run-quality.sh test`; 52 passed |
| Forecasting formatter, lint, and mypy | PASS | `bash services/forecasting/scripts/run-quality.sh check`; pinned Python 3.13.11 image |
| API regressions and explicit V1/no-V4-fallback contract | PASS | Pinned Node 24.17.0 container; 89 passed |
| Coordination regressions, persisted snapshot reader, freshness, BROA gate | PASS | Pinned Node 24.17.0 container; 14 passed |
| V2/V2.1 chaincode compatibility, including CRYOPRECIPITATE boundary | PASS | Pinned Node 24.17.0 container; 30 passed |
| Fresh and upgrade-path PostgreSQL migrations | PASS | `bash tests/forecasting/v4-runtime-integration.sh`; 20 fresh and 10+10 upgrade migrations |
| Authenticated HTTP → persisted V4 → internal ML snapshot → persisted surplus → BROA | PASS | Same integration command; synthetic fixture only |
| Real PostgreSQL committed projection lifecycle and receipt replay | PASS | Same integration command; Fabric submission itself is not exercised by this probe |
| Secret scan | PASS | `scripts/scan-secrets.sh`; Gitleaks 8.30.1 resolved digest recorded by command output |
| External workbook bytes and documented SHA-256 | PASS | Read-only temporary download; workbook was not used as live application input |
| Real Fabric network restart/commit-count evidence | NOT RUN | Requires the authorized Fabric runtime/network; test-double and PostgreSQL receipt evidence are separate |
| BUNO research review | CHANGES_REQUESTED | BUNO reviewed `f732fcb`; four forecasting-owner findings remain open |
| LAT browser UAT and JOPIA PR/merge approval | NOT RUN | Human owner gates, outside this branch execution |

The verification was agent-assisted self-validation by the current reviewing
model (GPT-5; deployment identifier not exposed). This is engineering evidence,
not independent institutional, clinical, or research acceptance.

## Final handoffs

JOPIA must retain the register and evidence with the PR, confirm the Drive account
identity, obtain BUNO’s review of method fidelity and lineage, and explicitly
accept the simulation-only boundary. JOPIA gives LAT the corrected
`services/api/openapi.json` and `services/api/openapi-v2.json` contracts with
the `CURRENT`/`STALE`/`UNAVAILABLE` fields, dataset/model identity, dates, and
nullable uncertainty fields. LAT implements frontend and browser UAT. No
production, clinical, accuracy, regulatory, or autonomous-transfer claim is
closed by these results; `RQ-07` remains open.

## BUNO review reconciliation — 2026-09-17

BUNO reviewed PR 11 commit `f732fcb8504abe0198180b0ecaeebb72f1b724a5` with
research-method and lineage scope. The review confirmed the weighted-average
calculation and requested four forecasting-owner changes. It is a
`CHANGES_REQUESTED` research review, not frontend/UAT, technical-owner,
Drive-account, production, or merge approval. The earlier focused tests remain
historical evidence and do not close these findings.

| BUNO finding | Owner | Current disposition |
|---|---|---|
| Forecast IDs must include complete institution and run lineage | BUNO | Open; producer change and cross-institution persistence rerun required |
| Dataset digest must identify actual source evidence | BUNO | Open; supplied-path and in-memory input semantics require producer change |
| Null observations must persist an unavailable attempt | BUNO | Open; producer persistence and successful-to-unavailable API rerun required |
| Unavailable results must retain the requested horizon | BUNO | Open; producer date-resolution change and rerun required |

## Issue 9 backend finding reconciliation

The attached Issue 9 handoff was reconstructed on 2026-09-17 from a review of
the September 13 baseline. It is review evidence rather than an implementation
instruction, and its findings were not automatically revalidated against every
subsequent change.

| Issue 9 backend finding | Current branch evidence | Remaining owner/action |
|---|---|---|
| Projection omitted lifecycle mutations | `PostgresV2Projector` covers registration, receipt, reservation, preparation, dispatch, transit, release, cancellation, reconciliation, expiry, compromise, and transfer persistence; PostgreSQL lifecycle replay is recorded above | Rerun against the current database/Fabric boundary; real Fabric restart evidence remains separate |
| Freshness accepted expired or malformed evidence | V2.1 `validateForecastFreshness` requires strict UTC, evaluation ordering, and the next Asia/Manila date; coordination tests cover the boundary | Preserve version-specific behavior and add malformed/future/stale regression cases |
| Snapshot/digest provenance was syntactic only | Internal ML snapshots are persisted atomically, read back by institution, digest-checked, and resolved by `TrustedCensusSnapshotReader` before surplus production | Harden cross-institution pending-command detection and rerun tamper/mismatch cases |
| Census snapshots could be rewritten | Immutable database triggers plus idempotent insert/replay and digest conflict checks are present | Keep scheduled/report-policy gate disabled until approved order is supplied |
| Exact Donation No. could cross the read boundary | ADR-034 allows encrypted off-chain storage; component projections omit ciphertext and plaintext, and API responses are redacted | Continue testing privileged reads and keep exact values out of forecasting inputs |
| OpenAPI component response shape differed from implementation | V2 route returns `{ scope, components, classification }`, matching the corrected contract | Re-run contract/static checks after any schema edits |

The Issue 9 wording that broadly prohibited Donation No. persistence conflicts
with accepted ADR-034. The implementation boundary is encrypted off-chain
storage with keyed equality evidence; plaintext, ciphertext, unrestricted OCR
text, images, and exact values remain excluded from component API responses,
forecasting reads, logs, and evidence.

The internal ML snapshot digest covers the snapshot identifier, scheduled time,
timezone, policy version, and all normalized component/blood-type counts. Its
projection watermark is the maximum projected component ledger version included
in that institution-scoped snapshot; it is not a global Fabric checkpoint.

## Rerun dependencies and claim limits

Backend and coordination checks can run against this branch now. Producer-to-
database-to-API scenarios depending on BUNO's four forecasting changes remain
`BLOCKED` until BUNO supplies the producer fix and records a re-review. No
simulation result closes `RQ-07`, clinical or operational policy gates, UAT,
real-Fabric restart evidence, or production readiness.

## Validation rerun — 2026-09-17

The backend changes and regression tests were rerun in the pinned
`node:24.17.0-bookworm` environment with npm `11.13.0`. Results are reproducible
from the current HEAD and remain simulation-only. The grouped implementation
commits are `6f55076` (review register), `c8ba10a` (backend projection and
contract tests), `12d2d80` (snapshot provenance), and `8ee8800` (integration
boundaries), followed by the final rerun-evidence and response-documentation
commit.

| Command or evidence | Result |
|---|---|
| `npm run test --workspace @bloodledger/api` | PASS — 91 tests, including V2 envelope/privacy and schema-boundary tests |
| `npm run test --workspace @bloodledger/coordination` | PASS — 16 tests, including freshness rejection and Asia/Manila midnight boundaries |
| `bash tests/api/static-boundary.sh` | PASS |
| `bash tests/coordination/static-boundary.sh` | PASS |
| `bash tests/forecasting/static-boundary.sh` | PASS |
| `bash tests/forecasting/v4-runtime-integration.sh` | PASS — fresh/upgrade migrations, persisted V1/V4 replay, PostgreSQL projection lifecycle, snapshot provenance, surplus, and BROA integration |
| `bash scripts/scan-secrets.sh` | PASS — Gitleaks 8.30.1, image digest `sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f` |

The first coordination run exposed an incorrect test fixture at the exact
Asia/Manila midnight transition; the fixture was corrected and the rerun passed.
The API and coordination checks execute the existing producer-independent
boundaries. Producer-to-database-to-API verification of BUNO's four requested
forecasting changes is `BLOCKED` until BUNO supplies the producer fix and
records her research re-review. Real Fabric network restart and submission-count
evidence remain `NOT_RUN`.


## Local BUNO producer corrections — 2026-09-17

User-authorized implementation on `codex/ml-v4-forecast-corrections`, based on
JOPIA verification revision `0729179`. This section records agent-assisted local
engineering verification, not BUNO/JOPIA acceptance, a posted research re-review,
or permission to push. The earlier open findings above describe the reviewed
baseline; these corrections are local pending handoff.

| Finding | Implemented correction | Regression evidence |
| --- | --- | --- |
| Institution and immutable lineage missing from forecast identity | Common immutable run identity includes institution, all lineage digests, versions, dates and status/reason; per-series IDs derive from that identity; persistence verifies IDs and scope | Cross-institution/file-revision persistence, independent code/config/model hash changes, timestamp-only replay, altered-payload rejection |
| Dataset digest did not identify actual evidence | Readable file bytes hashed when supplied; missing/directory paths rejected; canonical allowlisted memory rows hashed otherwise | Changed observations change digest; CRLF/LF file evidence differs while normalized input stays identical |
| Null quantities bypassed unavailable persistence | Canonical JSON null preserved; valid nulls produce an empty UNAVAILABLE bundle through the normal CLI persistence path | None/NaN/pd.NA, shuffled replay, null versus zero, successful-to-unavailable authenticated API read |
| Early returns lost requested origin/horizon | Resolve and validate the requested one-day window before availability; every result uses that window | Empty/short/unsupported/missing/future/null inputs with both dates or either date; malformed date rejection and Manila fallback |

The first cross-institution database test found the inherited
`demand_forecasts_institution` constraint still restricted all forecast rows to
Mediatrix. New forward migration `20260917100000000` binds forecast institution
to its parent run with a composite foreign key, permits scoped V4 forecasts, and
retains V1's Mediatrix-only rule. Applied migrations and historical rows are
unchanged. The contract schema now declares the already-emitted institution,
origin and per-series as-of fields instead of rejecting them as extra fields.

Validation: forecasting formatting/lint/strict typing and **89 tests passed**.
Forecasting, API and coordination static boundaries and PostgreSQL static checks
passed. Full history/index/candidate secret scanning passed locally. Fresh and
upgrade-path producer-to-database-to-API verification passed: 21 fresh migrations
and the 10+11 upgrade path; cross-institution and changed-file insertion/replay;
conflict rejection; direct composite-foreign-key enforcement; persisted null and
short-history attempts; authenticated UNAVAILABLE results retaining requested
dates; V1 history; committed projection lifecycle; snapshots, surplus and BROA. Frozen workbooks/models were neither read nor
modified for these corrections. V4's 1..7 / 28 method is unchanged.

The repository-wide JSON-format gate reports an existing formatting failure in
`services/api/openapi.json`, which is unchanged from JOPIA's base revision.
The edited forecast bundle schema is valid, two-space JSON. No unrelated OpenAPI
reformatting was included, and this repository-wide gate is not reported passed.

Human research re-review, JOPIA acceptance, LAT frontend/browser UAT and real
Fabric restart/submission-count evidence remain separate. ADR-034 permits
controlled encrypted off-chain storage; no plaintext or encrypted donation
identifiers enter this forecasting producer. RQ-07 and operational gates remain
open. No comments, pushes, PR updates or merges were performed for this task.
