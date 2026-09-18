# V4 Runtime Integration Evidence and LAT Handoff

**Branch:** `codex/ml-v4-integration`

**Baseline:** `origin/main` / `6bd704a873e6249d4ff0faa00928c2b99ff94cd7`

**Owner:** JOPIA

**Scope:** backend, forecasting worker, database, API, chaincode policy,
projection, census, and coordination only. `apps/web` and
`apps/capture-pwa` were not modified.

## External source verification

On 2026-09-17 the Drive connector verified the exact
`BloodLedger_ML_Research_Dataset_v4.xlsx` file in the `Machine Learning`
folder:

- file ID: `17f2qUhTyLGmXbAXSiBOvfPeKVyqbot8R`
- folder ID: `1KllQ7SC6TKaLvfQ6LbxO2wYRJDajSZJt`
- documented SHA-256: `76a188830467d290af26c2d01459e5b3ef470f8b552568cdbe89fe3118002dbd`

The workbook was not copied, committed, loaded as live application data, or
used as a runtime fixture. The committed demonstration generates bounded
synthetic rows in a temporary test directory.

## Implementation evidence

The branch contains the nine requested focused commits plus small follow-up
validation commits. They remain unsquashed:

1. `867fa39` — `docs(ml): define v4 runtime integration scope`
2. `99093f5` — `feat(contracts): add v4 forecast and V2.1 evidence contracts`
3. `d7cc9cc` — `feat(forecasting): implement weighted-average-7 runtime bundle`
4. `1bec13e` — `feat(database): persist versioned forecasts and immutable snapshots`
5. `efe3dbd` — `feat(chaincode): add V2.1 cryoprecipitate policy support`
6. `6dc9f37` — `fix(api): complete V2 projection and privacy-safe reads`
7. `a40ad79` — `feat(coordination): produce validated synthetic surplus evidence`
8. `5946588` — `test(ml): verify forecasting through API and BROA boundary`
9. `docs(ml): record evidence, limitations, and LAT handoff` — this document

Follow-up validation commits:

- `4dcc0b4` — `test(chaincode): correct V2.1 synthetic fixtures`
- `7525cb9` — `fix(forecasting): pass pinned runtime quality checks`
- `319a90b` — `fix(api): bind explicit forecast date filter`
- `d303345` — `test(ml): exercise API to BROA V2.1 boundary`
- `91f6e67` — `fix(api): make V2 projection replay-safe`

The implementation preserves `SYNTHETIC_FORECAST_V1` historical rows and
requires the active V4 dataset version for default forecast reads. A missing
V4 run returns unavailable; it does not select V1 as a fallback.

## Reproducible checks

The focused integration entry point is:

```bash
bash tests/forecasting/v4-runtime-integration.sh
```

It provisions disposable PostgreSQL, migrates the schema, persists V1 and V4
bundles, checks idempotent replay, maps both versions through the API
repository, and passes the V4 API result through source-surplus evidence and
the V2.1 BROA simulation boundary. The script does not claim physical-device,
clinical, hospital-data, or production evidence.

Checks completed during this implementation turn:

- Drive metadata verification: passed.
- JSON schema parsing for the four new schemas: passed.
- Python bytecode compilation for the changed forecasting modules: passed.
- Bash syntax validation for the integration script: passed.
- Forecasting quality check: passed with Ruff formatting, Ruff lint, and
  strict mypy.
- Forecasting unit tests: 49 passed in the pinned Python 3.13 container.
- Coordination tests: 13 passed.
- API tests: 88 passed.
- Chaincode tests: 30 passed, including V2.1 CRYOPRECIPITATE policy
  acceptance and replay/error behavior.
- Disposable worker → PostgreSQL → API → source-surplus → BROA demonstration:
  passed, including V1 `INSERTED`/`EXISTING` idempotency and V4 nullable
  uncertainty mapping.
- Static forecasting, API, and coordination boundary checks: passed.
- Gitleaks history, index, and tracked/candidate-content scans: passed with
  no leaks found.
- `git diff --check`: passed.
- Frontend boundary: no files under `apps/web` or `apps/capture-pwa` changed.

The host WSL environment has no usable Linux Node or pytest binary, so the
Node/Python checks above were executed with the repository's pinned containers.
This is self-validation by JOPIA; it is not BUNO's research review or LAT's
browser UAT.

## LAT handoff

LAT receives the finalized backend fields through `GET
/api/v1/demand-forecasts?businessDate=YYYY-MM-DD`:

- `status`: `CURRENT`, `STALE`, or `UNAVAILABLE`;
- `datasetVersion` and `modelVersion`;
- `asOfDate` and `horizonDate`;
- `pointForecast`;
- nullable `lowerForecast` and `upperForecast`;
- `uncertaintyStatus` and `uncertaintyNote`;
- `classification: SIMULATION_ONLY`;
- `recommendationEligibility: DISABLED_UNAPPROVED_POLICY`.

LAT must display unavailable uncertainty as unavailable, preserve stale and
unavailable statuses, and must not infer zero demand or a V1 fallback. Frontend
implementation and browser UAT remain LAT’s work.

## JOPIA acceptance responsibilities

Before merge, JOPIA must review the migration and privacy diffs, confirm the
replay/idempotency and digest-mismatch evidence, disclose this self-validation,
obtain BUNO’s model-lineage and frozen-protocol review, and provide LAT the
OpenAPI/API handoff. JOPIA accepts only simulation-only claims; `RQ-07`,
clinical policy, operational safety, and production gates remain open.

JOPIA does not need to retrain the study, acquire additional hospital data,
resolve clinical policy, or implement frontend code.
