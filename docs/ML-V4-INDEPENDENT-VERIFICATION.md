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
| BUNO research review, LAT browser UAT, JOPIA PR/merge approval | NOT RUN | Human owner gates, outside this branch execution |

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
