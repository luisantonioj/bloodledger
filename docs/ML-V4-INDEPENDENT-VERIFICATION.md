# ML V4 independent verification and remediation

**Status:** Proposed verification scope on `codex/ml-v4-verification`  
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
not expose the signed-in account identity or a byte-level SHA-256 result. The
digest therefore remains a JOPIA verification item until the bytes can be
checked through an authorized read-only download. Workbook bytes and rows must
remain outside Git and application fixtures.

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
| External workbook bytes match documented SHA-256 | handoff release record | NOT YET DEMONSTRATED | Authorized read-only byte download and independent SHA-256 output |

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
