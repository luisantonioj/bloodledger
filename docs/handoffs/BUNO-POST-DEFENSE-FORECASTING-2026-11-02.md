# Buno post-defense forecasting handoff — 2026-11-02

Status: implemented research comparison; self-validation, not independent review.
SIMULATION_ONLY. Franze #1: comparison expanded; actual-demand validation still unmet.
Branch: `codex/buno-post-defense-forecasting`, based on main
`5a624d9deae056a892c0d5bb5af556530756cec5`. No application activation or main merge.
Tooling/protocol commit: `b00445d83f7cd44516b230587c15287c7fcababe`.

## Changes and result

- `services/forecasting/src/bloodledger_forecasting/post_defense.py`: separate
  research CLI, 22 frozen candidates, three expanding validation folds, causal
  smoothing/seasonal features, no test-based selection, per-component/series
  errors, bias, underprediction and occurrence confusion, hashed research artifact.
- `services/forecasting/tests/test_post_defense.py`: chronology, future-value
  isolation, missing-data rejection, deterministic methods, metric boundaries,
  selection ties and intermittent-demand recurrences.
- `scripts/forecasting-research/`: private reference audit, pinned research
  environment and reproduction commands. No observed sheet enters model fitting.
- `docs/research/POST-DEFENSE-*`: unchanged-data audit, frozen protocol, complete
  aggregate JSON and readable results. Existing V5 source/results stay unchanged.

The per-series median wins pooled validation MAE. Reanalysis WAPE is **60.85%**
versus the original mean's **68.67%**, MAE **0.5889** versus **0.6645**. However,
RMSE rises to **1.2924** from **1.2651**, underpredicted units increase **29.23%**,
and 14 of 20 series have zero medians (including every WB, FFP and CRYO series).
This is not evidence to replace the deployed mean model or to release more stock.
Occurrence accuracy **88.04%** is not quantity forecast accuracy; occurrence recall
falls to **76.77%** from the original **87.50%**.

The workbook hash matches the original evaluation. Its observed references have
229 partial recorded dates and 21 unknown dates, not 250 complete request days.
Outpatient/external sample rows are releases with unconfirmed dates/quantities.
The original request extract is inpatient, confirmed by the user. No raw source
file was independently re-audited; see the data-audit document for the limits.

## Exact validation commands and results

From the research checkout, in an isolated Python **3.13.18** environment using
`scripts/forecasting-research/requirements.txt`:

```bash
export PYTHONPATH=services/forecasting/src
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
python -m pytest services/forecasting/tests/test_post_defense.py \
  services/forecasting/tests/test_v5_experiment.py -q
ruff check services/forecasting/src/bloodledger_forecasting/post_defense.py \
  services/forecasting/tests/test_post_defense.py \
  scripts/forecasting-research/audit_v5_references.py
ruff format --check services/forecasting/src/bloodledger_forecasting/post_defense.py \
  services/forecasting/tests/test_post_defense.py \
  scripts/forecasting-research/audit_v5_references.py
mypy --config-file services/forecasting/pyproject.toml --follow-imports=silent \
  services/forecasting/src/bloodledger_forecasting/post_defense.py
git diff --check
python -m bloodledger_forecasting.post_defense --workbook "$V5_WORKBOOK" \
  --protocol docs/research/POST-DEFENSE-FORECASTING-PROTOCOL.md \
  --output build/post-defense-private/run-04-verified
python -m bloodledger_forecasting.post_defense --workbook "$V5_WORKBOOK" \
  --protocol docs/research/POST-DEFENSE-FORECASTING-PROTOCOL.md \
  --output build/post-defense-private/run-05-replay
```

Results: **34 focused tests passed**; lint, formatting and scoped strict typing
passed. Final/replay evaluation, selected predictions and selected artifact are
byte-identical. Original frozen-mean WAPE is reproduced within 1e-10 and the source
workbook SHA-256 matches the original V5 record. The artifact has exactly twenty
unique mapped series. No runtime/backend/browser integration was run or changed.

Final evaluation SHA-256:
`a38005c2ae8828a85baaceac9dfc54a571f60f7924acfcd321c27c3a8194cc55`.
Private research median artifact SHA-256:
`43f7ae7509377b176c55822d37500626c455c4a6f03ab85efcc037de9dae161a`.
Private prediction CSV SHA-256:
`0765b1cbcedea56e7d97435bfeeec38f97d470783ab77b1219a1839299b7c4f1`.
Further source/code/protocol hashes are in the results document and JSON.

### Secret-scan environment limitation

`npm run scan:secrets` could not run through Windows npm from this WSL UNC path;
invoking `bash scripts/scan-secrets.sh` directly then failed because `/usr/bin/docker`
returned an input/output error. This required Docker invocation is **not passed**.
As a disclosed fallback, the published archive checksum for standalone Gitleaks
**8.30.1** was verified. The same `.gitleaks.toml` was used for a directory snapshot
of all tracked/candidate files and `gitleaks git --log-opts=--all --redact` against
repository history. Both completed with exit 0 and zero findings; reports remain
private. Rerun the standard Docker-based command on a supported host before merge.

## Next steps and boundaries

- Buno: report this branch/code/GitHub stage first. The Google Docs manuscript
  remains unchanged at this checkpoint. Later edits must identify exact sections,
  retain the original V5 results, label the new evaluation post-defense reanalysis,
  and state the bias/underprediction tradeoff and unmet actual-data validation.
- Jopia/Lat: no implementation is requested by this branch. Review if desired;
  keep V4 default and existing V5 model/preview gates. Do not load the median
  artifact through the existing mean-model loader or change surplus calculations.
- Any replacement model needs a separate integration and approval decision,
  institutional data and shortage-oriented acceptance criteria. RQ-07 remains open.
- No workbook, observed rows, private model artifact, per-row predictions, credentials
  or runtime evidence is included in Git. Original dirty Testing-phase work is
  preserved in the user's original checkout. Private runs stay under ignored build/.
