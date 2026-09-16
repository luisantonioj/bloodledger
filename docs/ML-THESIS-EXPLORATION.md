# ML thesis exploration — existing-data completion

Status: Implementation authorized by the user on 2026-09-15.
Branch: `codex/sprint-03-ml-exploration`.
Requirements: FR-14, BR-ALG-07; research preparation for BL-ML-01/02 and
TP-G05. This does not close their operational gates or RQ-07.

## Scope and authority

The external Final ML Thesis Plan is the research input. This specification is
its implementation home. No more institutional data are available. Complete
with an audited descriptive sample and separately classified simulations;
retrospective real-demand accuracy remains unavailable if coverage is unknown.
Do not infer missing days as zero or use synthetic test scores as hospital
accuracy. No deployment, transfer, API/schema expansion, or accepted runtime
model replacement is authorized by this experiment.

## Frozen protocol — THESIS_EXPLORATION_V1

- The safe workbook reader selects only date, category, quantity and priority
  cells. Real data, detailed audit outputs and source calibration stay outside
  Git. Date inheritance and year 2026 correction were confirmed by the user
  on September 14. Malformed explicit dates block inheritance. No ambiguous
  quantity or product conversion, no deduplication on anonymous fields.
- Demand is provisionally recorded requested units, not transfusions or issues.
  Completeness, cancellations and category semantics remain unverified.
- Four positive Rh types crossed with PRBC, PC, FFP, CRYO and WB: 20 series,
  January 2023–December 2025 (1,096 scenario days). Other components remain in
  descriptive data only. All demand-generation settings are invented scenarios.
- Fixed seeds: 11, 29, 47, 83, 101. Fixed scenarios: ordinary (scale 1), sparse
  (scale .5), shift (scale 1.5 with a July 2025 step). A neutral configuration is
  the default; optional external Jan–Jun aggregate rates are scenario scaling
  only and must carry source hashes. No claim of validated rate estimation.
- Features: category, calendar, lag1/7/14, trailing weighted7 and mean28. Only
  days before the target contribute. One-day primary target; the optional
  14-day study is not selected for this implementation, avoiding unreviewed
  multi-day runtime/schema changes.
- Train 2023–2024; select on Jan–Jun 2025; test July–December 2025 once per
  frozen run. The trained model stays fixed during testing; earlier actual
  observations update lags (rolling next-day protocol). No shuffled split.
- Compare seasonal naive7, weighted average7, global RF (300 trees, depth5,
  leaf3, one job, seed42). Use the accepted 5% pooled improvement / 10% maximum
  per-series regression rule, with zero-error guards. Weighted baseline wins
  ties. Model selection uses validation only; score selected model on test.
- MAE, RMSE and WAPE by series and pooled; WAPE is null for zero actual total.
  Report seed/scenario variability, not a prediction interval. Provide explicit
  uncertainty-unavailable notes. Inventory/expiry scenarios in the temporary
  workbook are not used to validate bag safety, FEFO or operational wastage.

## Outputs and acceptance

The audit emits safe daily aggregates, correction/exclusion reasons, source
hashes, date coverage, rates with caveats, and descriptive monthly/type/product
summaries. The runner emits generated data, validation/test predictions, metrics,
selection evidence, trusted local model artifacts, safe demo forecasts, hashes,
environment versions and a Markdown model report. Output directories must be
new, outside Git or beneath ignored artifacts/data paths. No overwrite.

Tests must verify date correction/inheritance, ambiguity handling, allowlisting,
aggregate reconciliation, unknown coverage, full synthetic series, deterministic
seeds, past-only features, zero-demand metrics, selection guards and safe errors.
Run existing forecasting regression, static/lint/type checks and security scans.
Record real limitations and execution evidence; no fabricated paper results.

The source-code deliverable is reviewable on the exploration branch. Accountable
review and merge are separate from a technical pass; no automatic push to main.

## Execution evidence — 2026-09-15

- `git pull --ff-only origin main` completed before implementation; main was
  already current at `a0ea2f7`. The exploration branch preserved its previous
  merge `f25e9e0`, already containing main. Its formerly attached clean checkout
  was detached; this worktree now owns the requested branch.
- The pinned Python 3.13.11 image with hash-locked dependencies reproduced all
  32 accepted tests before the changes. Final static boundaries, Ruff format,
  Ruff lint, strict mypy and all 41 tests passed. The experiment test verifies
  real output writing and selected-model scoring in addition to unit guards.
- The final source audit accepts 2,107 records, excludes 187 candidates and
  identifies nine structurally empty rows represented in the source XML. It
  produces 955 daily aggregates and 3,984 recorded requested units across
  229 dates, January 1–September 7, 2026. Unrepresented XML rows are not requests.
- Compared with temporary workbook v3, a cached formula blood-type cell is
  deliberately excluded (one unit). A whitespace-only source row is structural,
  not an excluded request. The new release owns this reconciliation rather
  than silently changing v3. Detailed source-row evidence remains external.
- All 15 frozen sample-scaled scenario runs completed. Weighted average 7 was
  selected in every run using validation only; no global forest qualified for
  promotion. These results do not justify replacing the accepted runtime with
  an expanded operational model. Mean test MAE across seeds is recorded in the
  external thesis report; metrics are synthetic only.
- The final external directory is `ml-thesis/final-v1` in this task's research
  artifacts. It contains a manifest for all data, figures, predictions, models
  and reports. Manifest-content hash reported by the runner:
  `b0bee9666c6f04515be13b4900ec372f5656061c384f39ef1453a57181724a5a`.
- Real forecasting accuracy is `UNAVAILABLE_UNKNOWN_COVERAGE`; the optional
  14-day extension is `NOT_SELECTED`. No further-data dependency is created.
  Paper integration, accountable-owner acceptance and merge remain review work.

### Reproduction used for the final run

Use the image built by the repository's existing quality script, then mount
this repository read-only at `/repo`, the external supplied workbook read-only
at `/source.xlsx`, and a writable external artifact parent at `/outputs`.
Run from `/repo/services/forecasting` with `PYTHONPATH=src`:

```bash
python -m bloodledger_forecasting.exploration \
  --workbook /source.xlsx --use-sample-scale --output /outputs/final-v1
```

The output folder must not already exist. Without the private workbook, omit
both source arguments to reproduce a neutral-rate simulation instead; its
metrics are a different experiment and must not be substituted for this run.

### Security scan disposition

The full-history and candidate scans report two pre-existing `generic-api-key`
findings in `chaincode/test/interview-core-contract.test.ts` (introduced by
`544760e`). This exploration does not change that file or rewrite history.
The repository-wide scan is therefore not reported as passed; the findings
need separate triage before a clean full-repository scan can be claimed.
The scoped staged-diff scan is recorded separately below.

The scoped staged-diff Gitleaks scan passed on 2026-09-15 with no findings.
The inherited full-repository findings remain unresolved; no scan suppression
or unrelated security change was introduced.

## Workbook v4 handoff — 2026-09-16

The user authorized the revised v4 plan. The frozen protocol above is unchanged.
`thesis_release.py` verifies the exact v4 workbook and every original final-v1
artifact against the frozen manifest before assembling external manuscript tables,
a model card and a historical scored replay. It never loads a pickle or refits.
Observed_Revised is descriptive only; its three-unit recovery does not replace
Observed_Frozen calibration. Missing dates remain unknown.

Interface audit decision: retain the accepted application runtime. The existing
`SYNTHETIC_FORECAST_V1` schema requires four category pairs and residual bounds;
the 20-series exploration has a different schema and no calibrated intervals.
Only A+/O+ with PRBC/PC share category meanings. The handoff flags these four
pairs for explanation but explicitly forbids runtime import of the replay.
No dataset relabeling, invented bounds, migration or replacement is needed for
this bounded thesis demonstration. All 20 study series remain offline.
Application checks validate the existing runtime separately from v4 study scores.
This disposition follows section 5 of the revised plan and preserves PA-ML-01.

Run the handoff in the pinned forecasting image with the workbook and final-v1
mounted read-only and an external writable output directory:

```bash
PYTHONPATH=src python -m bloodledger_forecasting.thesis_release \
  --workbook /source.xlsx --release /final-v1 --output /outputs/v4-handoff
```

The workbook is the mixed research package, not input to `exploration --workbook`
(which expects the original request export). Do not rerun experiments merely to
export the existing results. The original source-tree hash stays attached to
frozen scores; the handoff code is a subsequent integration/documentation change.
Actual manuscript insertion and accountable review require their respective
artifacts/owners; this command produces insertion-ready evidence, not acceptance.

### V4 verification evidence

- Exact v4 bytes and all 146 original artifacts verified; 15 frozen runs and
  1,260 metric rows exported without fitting. `v4-final-handoff` is external
  beside final-v1 and has its own output manifest. Original scores/hashes remain.
- 46 forecasting tests, Ruff formatting/lint and strict mypy passed. The added
  runtime feature check verifies the same oldest-to-newest 1–7 weight direction.
- The isolated PostgreSQL 17.10 replay applied all 10 current migrations. It
  verified INSERTED then EXISTING, conflicting payload rejection, exactly one
  run/four rows, and API repository current/stale/unavailable mapping.
- This integration check exposed an inherited DATE serialization defect:
  JavaScript display strings were sliced as ISO dates, incorrectly marking
  current forecasts stale. The query now emits explicit ISO calendar dates.
- API compilation also required the already-forwarded enabled issuer setting
  in the buildApp parameter type. No issuer policy or runtime model changed.
- The accepted runtime replay selected random_forest_global under its original
  four-series synthetic protocol. The v4 study selected weighted_average_7 under
  its distinct 20-series protocol. These are separate datasets and results.
- API regression: 88 tests passed; web regression: 28 tests passed. These are
  automated checks, not physical-browser UAT or clinical validation.
- Full-history, index and candidate Gitleaks scans passed with the pinned image.
  The two inherited findings were exact synthetic reconciliation idempotency IDs,
  not credentials. `.gitleaks.toml` scopes its exception to those two values AND
  the single test-file path; default rules remain enabled. A negative control
  proved the same value still triggers detection in another file. No history
  rewrite or blanket path suppression was used. This supersedes the unresolved
  September 15 disposition above.
- Locked npm installation reported four inherited dependency advisories (three
  moderate, one high); dependencies were not changed by this ML follow-up. A
  passing secret scan is not a clean dependency-audit claim.

### Review and manuscript handoff

`thesis-results-model-card.md`, metric CSVs, original observed summaries and
figures are insertion-ready external research artifacts. Actual manuscript
insertion is pending because the thesis manuscript was not supplied in this task.
The model card describes intended use, no calibrated intervals, unknown real
coverage and the difference between offline study and runtime demonstration.
Accountable review, branch publication/PR and main merge remain pending; no
review acceptance is recorded by these automated checks. No further hospital
data are required for this bounded research endpoint.
