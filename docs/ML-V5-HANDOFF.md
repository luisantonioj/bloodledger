# V5 ML research handoff — 2026-09-29

## Delivery and readiness

Buno ML research implementation is complete for this protocol: validated workbook
reader, leakage checks, model comparison, held-out evaluation, sensitivity probes,
secondary confusion matrix and deterministic research preview. This is ready for
technical review as an isolated research addition. It is NOT ready to replace the
application's active V4 model or to merge as an application activation release.
## Publication status — updated 2026-09-29

The research implementation was committed and pushed at `82d9feb` on
`codex/ml-v5-exploration`. PR [#19](https://github.com/luisantonioj/bloodledger/pull/19)
is open against `main` for technical review. It has not been merged and does not
activate V5 in the application. Follow-up documentation commits may advance the
PR head; `82d9feb` identifies the original research implementation commit.
No human UAT or clinical acceptance is implied.

Branch: `codex/ml-v5-exploration`, created after fetching `origin/main` at `40b8c64`.
V4 source and application paths are unchanged. The external workbook is unchanged.
The active application still uses V4. The V5 HTML preview is a standalone simulation,
not the application's Analytics page. No database migration or API route was added.

## Files and code changes

| File | Change |
|---|---|
| `services/forecasting/src/bloodledger_forecasting/v5_experiment.py` | Four-sheet allowlisted XLSX reader; strict coverage/provenance/count/balance validation; recomputed causal features; eight candidates; chronological selection/refit/test; metrics, confusion matrix, sensitivity; distinct hashed V5 research bundle and HTML preview |
| `services/forecasting/tests/test_v5_experiment.py` | 22 v5 cases including missing paths, corrupted stock/targets, missing/duplicate/null/observed rows, full zero calendar, lag alignment, model outputs, replay and unavailable windows |
| `services/forecasting/pyproject.toml` | Optional `bloodledger-v5-research` CLI entry point; no dependency changes |
| `services/forecasting/README.md` | Reproduction command, outputs and application boundary |
| `docs/ML-V5-EXPLORATION.md` | Protocol written before evaluation: partitions, candidates, primary metric, secondary classifier and sensitivity |
| `docs/research/ML-V5-EVALUATION.json` | Actual synthetic aggregate results and evidence hashes; no source rows |
| `docs/ML-V5-HANDOFF.md` | This handoff, readiness and cross-owner activation work |

External deliverables: `BloodLedger_V5_Stakeholder_Explanation.docx`,
`BloodLedger_V5_Detailed_Thesis_Guide.docx`, selected-model JSON, evaluation JSON,
per-test-row predictions CSV, preview bundle and standalone HTML. Keep those source
workbooks and row-level artifacts outside Git. The documents explain every V5 sheet,
upstream V4 provenance, exact splits, algorithms, formulas, results and limitations.

## Results

Selected by validation MAE: `series_mean`. Initial learned models used 14,060 training
rows; validation used 3,620 rows. Selected means were refit on those 17,680 rows only.
Held-out test: 3,680 series-days, 2025-07-01 to 2025-12-31.
2026's 7,300 eligible rows are demonstration-only, excluded from reported accuracy.

| Method on V5 test | MAE units/series-day | RMSE | WAPE |
|---|---:|---:|---:|
| Selected series mean | 0.664509 | 1.265116 | 68.671480% |
| V4 weighted-seven method recomputed on V5 | 0.683502 | 1.354947 | 70.634252% |

This is a modest aggregate improvement, not universal superiority: the selected
method has worse MAE than weighted-seven for CRYO, FFP and WB in this test.
No operational performance threshold has been met or approved. Sparse-series WAPE
can exceed 100%; never report `100 - WAPE` as accuracy. The selected model is a
simple statistical forecasting baseline learned from synthetic data, not a deep
learning model or emergency predictor.

Secondary any-demand confusion matrix (actual rows; predicted columns):

| | Predicted no demand | Predicted any demand |
|---|---:|---:|
| Actual no demand | 2053 | 387 |
| Actual any demand | 155 | 1085 |

Actual positive means requested units > 0; predicted positive means point forecast
>= 0.5 units. Accuracy 85.271739%, precision 73.709239%, recall 87.5%, F1 80.014749%,
balanced accuracy 85.819672%. Majority-class baseline accuracy 66.304348%.
This is NOT 85.27% accuracy of predicted quantities. Frozen per-series means make
this classifier constant within each series; much of its performance reflects
between-series differences rather than prediction of daily surges.

Nine perturbation tests (seeds 11/29/47; outpatient multipliers .5/1/1.5) produce
MAE approximately .793-.855. They add resampling noise and do not prove robustness
on actual outpatient demand. Stock multipliers are only scenario diagnostics;
no alternate movement histories or actual shortages were inferred.

## Evidence and reproduction

Runtime: Python 3.13.11, NumPy 2.4.3, pandas 3.0.5, scikit-learn 1.9.0.
Verified local container image ID:
`sha256:d539c784667d763b48947971260fe88fb7c436d48eeea7c4eccf2c7369bf0c19`.
Use the source runner with the pinned environment and the command in the service README.
The workbook must remain external. No V4 workbook is opened by this runner.

Passed: Ruff lint and formatting (27 Python files); strict mypy (15 source files);
full forecasting suite (111 cases, including 22 new V5 cases); actual V5 workbook
coverage/balance/features/partition checks; complete research evaluation and preview
export. Windows Docker CLI was used because `/usr/bin/docker` returned I/O errors.
The external source snapshot used for testing matches repository implementation.

Not run/not claimed: V5 producer-to-database/API/browser integration, browser UAT,
real hospital accuracy, calibrated intervals or deployment. This deliverable has
no application V5 persistence or endpoint to validate.

Exact workbook, executable code and pre-evaluation protocol hashes are in
`docs/research/ML-V5-EVALUATION.json`. Do not overwrite that report after changing
code or protocol without rerunning the evaluation.

## Integration decisions — review status updated 2026-09-30

Status: The original proposals below are retained for history. The [Buno technical review](ML-V5-BUNO-REVIEW.md) records current point-by-point agreement, the API freshness change request, and deferred binding/activation decisions. PR #20 contains an inactive candidate; V4 remains default.
This addendum updates the handoff only. It does not change the frozen research
protocol, evaluation, selected parameters, or the current preview's 28-day gate.

1. **Freeze the evaluated model for the thesis demonstration.** Use the supplied
   `selected_model.json` and its verified parameter hash. Do not schedule automatic
   retraining, rolling updates to its averages, or silent refitting. Any later refit
   must produce a new model version, fresh evaluation evidence and an explicit
   activation decision; retain the evaluated artifact for reproduction.
2. **Do not require 28 recent days merely to run the selected saved-mean model.**
   Its prediction uses the saved mean for the requested supported series. The
   28-day feature requirement belongs to the research comparison pipeline and is
   still enforced by the existing research preview. Propose a separate application
   inference path that validates the artifact, parameter hash, supported series,
   institution scope and requested origin/horizon without imposing unused lag
   features. Keep historical data requirements for training and evaluation intact.
   Missing/invalid model parameters must yield unavailable, never a zero fallback.
3. **Keep inventory and freshness checks independent.** Removing unused lag inputs
   does not establish live inventory, current forecast status or authorization to
   release blood. Validate inventory provenance, timestamps and eligible stock
   separately; preserve unknown/stale/unavailable stock rather than setting it to
   zero. Explicitly agree forecast freshness/expiry semantics for the frozen model;
   loading the same parameters again must not disguise old evidence as current.
   Unavailable inventory must prevent stock-dependent conclusions even when the
   model can calculate a numeric demand forecast.

**Original proposed sequence (superseded by the review status above):** send this handoff now. Buno and Jopia should record agreement or an
alternative before implementing the application inference/refit behavior. Jopia
then implements the agreed contract; Lat reflects its independent forecast and
inventory states; Buno reviews calculations and wording after integration.

**Acceptance checks for that later work:** prove saved-mean inference does not
require unused 28-day features; missing or corrupt parameters remain unavailable;
unknown stock remains unknown; dates, institution and immutable lineage are
preserved; no automatic refit occurs; and stale/unavailable behavior follows the
agreed contract. These tests and application changes are not completed by this
handoff update.

## Developer review and next application activation handoff

Jopia and Lat: read this handoff and review PR #19. The ZIP package includes
this same handoff, explanatory documents, selected model, evaluation outputs and
standalone preview. The PR contains code and aggregate research evidence, not
the institutional source workbook. Buno will clarify the proposed decisions and
review integrated calculations and frontend wording after implementation.


1. Jopia: approve an additive V5 runtime contract. Preserve institution scope,
   immutable dataset/code/config/model/input/payload lineage, original requested
   origin/horizon, unavailable attempts and null uncertainty. The current research
   alias `SIM_INSTITUTION_01` is not an authorized operational institution mapping.
2. Jopia: add version-aware persistence and API support, using new migrations as
   needed; preserve V4 records and active-version behavior until V5 tests pass.
   Never pass the research bundle into `persist_v4_runtime_bundle` or relabel it V4.
3. Jopia/Lat: current forecast selection is explicitly V4 in API configuration,
   API reads, web forecast service, source-surplus evidence and coordination paths.
   Review these together; changing only a frontend label or model name is insufficient.
4. Lat: display next-day requested demand and separately timestamped, provenance-
   labelled inventory. Never present workbook stock as live inventory. Preserve
   CURRENT/STALE/UNAVAILABLE envelope and AVAILABLE/STALE/UNAVAILABLE item behavior
   under the approved application contract, without automatic release decisions.
5. Buno/Jopia: resolve and record the proposed integration decisions above before
   implementation. Retain the evaluated artifact and hash; propose no automatic
   refitting and no unused 28-day lag requirement for saved-mean inference. The
   current research preview gate remains unchanged until separate implementation.
6. Together: run institution-isolation, invalid-evidence, replay, null/missing input,
   stale/unavailable, producer-database-API and browser tests; then open a reviewed
   activation PR. Keep RQ-07 and clinical/production gates explicit.

These steps are remaining implementation work, not accomplished work. The research
branch can be reviewed independently; it must not be described as full V5 deployment.
