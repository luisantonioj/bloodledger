# ML V5 — Jopia backend validation and handoff

**Date:** 2026-09-30. **Owner:** Jopia (self-validation). **Scope:** FR-14 / BR-ALG-07, inactive `SIMULATION_ONLY` backend candidate. This is not Buno's calculation review, Lat's browser validation, human UAT, or an activation record.

## Source and configuration

The branch `codex/ml-v5-jopia-runtime` starts from planning commit `ebaaf2a`, stacked on PR #19's `codex/ml-v5-exploration` head `e2eccf4baf0dd632e5e1c18597bcfa08fa7c0316`. The delivered model file was read from the handoff ZIP outside Git. Its SHA-256 is `1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`; the canonical parameter hash is `ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86`. The runtime pins both. The test creates an isolated external binding for `SIM_INSTITUTION_01` and `INST_MEDIATRIX`; no enabled binding is committed. The [binding schema](../contracts/v5-institution-binding-v1.schema.json) is a candidate for explicit owner review.

The producer requires only the pinned model, approved binding, request ID, institution, origin date and generated-at instant. Its output is a distinct [V5 bundle](../contracts/forecast-bundle-v5-runtime-v1.schema.json), not a research preview or V4 bundle. The model has twenty series in Buno's A+, B+, O+, AB+ then WB, PRBC, FFP, PC, CRYO order. The isolated fixture and test dates are synthetic and have no operational meaning.

## Reproduction and results

The supported local check used Node 24.17.0, the pinned forecasting container, PostgreSQL 17.10 and the repository npm lockfile. With `BLOODLEDGER_V5_MODEL_TEST_PATH` set to an external copy of the delivered `results/selected_model.json`, run:

```bash
BLOODLEDGER_V5_MODEL_TEST_PATH=/absolute/path/to/selected_model.json bash tests/forecasting/v5-runtime-integration.sh
```

The script creates and removes its own PostgreSQL container and temporary binding. It applies 21 pre-V5 migrations, inserts and later verifies a V4 forecast record, then applies the two V5 migrations. It inserts synthetic inventory fixtures, persists two completed V5 runs and one unavailable attempt, and checks duplicate and conflicting request IDs, runtime privileges, authenticated API reads, institution scope, future/current/expired dates, trusted inventory surplus, immutable surplus replay and non-approving BROA. The coordination reader rejects a success superseded by the latest unavailable attempt. The duplicate assertion compares the entire original and replayed JSON files, including the saved generation timestamp. **Result: passed.**

The pinned forecasting image ran `ruff format --check --no-cache .`, `ruff check --no-cache .`, `mypy --config-file pyproject.toml src`, and `pytest -p no:cacheprovider tests` with the external release artifact: **117 tests passed**. The release test checks all twenty ordered output values against the frozen means and confirms the model file remains unchanged. `npm run check:api`, `npm run test:api`, `npm run check:coordination`, `npm run test:coordination`, `npm run check:database` and `npm run check:format` passed: **98 API tests and 19 coordination tests passed**. The isolated integration probe is additional to those unit suites. These checks validate software behavior and synthetic calculations only; they do not establish operational forecast accuracy.

The repository `scan:secrets` wrapper found 10 findings while scanning Git history and stopped before its candidate pass. A separate scan of tracked and candidate tree files with the same pinned Gitleaks 8.30.1 image found **no leaks**. Treat the wrapper as **not passed** until its history findings are triaged independently; this candidate-tree result does not clear Git history.

## API contract for Lat

Use authenticated `GET /api/v1/demand-forecasts?businessDate=YYYY-MM-DD&datasetVersion=SYNTHETIC_FORECAST_V5_RUNTIME_V1`. The institution comes from the session, not the query. Omitting `datasetVersion` still selects V4. The [OpenAPI contract](../services/api/openapi.json) is authoritative; the V5 response includes `status`, `datasetVersion`, `asOfDate`, `horizonDate`, `generatedAt`, `trainingCutoffDate`, `runId`, `lineage`, `unavailableReason`, and `forecasts`. Each forecast includes `forecastId`, `bloodType`, `component`, `pointForecast`, null uncertainty bounds, `uncertaintyStatus`, and `stale`.

For a target-day read, `CURRENT` means the requested Manila target window only. The frozen training cutoff remains 2025-06-30. For an unavailable latest attempt, show `UNAVAILABLE`, its reason and an empty forecast list; do not substitute V4 or an older success. For an expired target-day read, show `STALE`; do not present the quantity as current. Display inventory as independent, timestamped committed evidence. Missing or stale inventory must not look like verified zero stock. V5 surplus and BROA remain `SIMULATION_ONLY` and `DISABLED_UNAPPROVED_POLICY`; no button or copy should imply automatic approval.

Lat's frontend parser, presentation and browser tests are a separate owner deliverable. Buno's calculation and freshness review, an explicit synthetic binding decision, and a later Jopia activation record remain open. The V4 default cannot be switched to V5 by the current API configuration; rollback evidence is retaining explicit V4 reads and V5 rows during this inactive candidate phase.
