# Post-defense V5 forecasting research

SIMULATION_ONLY. No runtime/model/default or database writes. This comparison
addresses Franze #1's expanded-techniques request; actual-hospital validation is
still unavailable. See docs/research/POST-DEFENSE-FORECASTING-PROTOCOL.md and the
results/handoff. Keep workbook and per-row outputs under ignored `build/` or an
external private location. Never overwrite a run directory.

From repository root, use Python 3.13 in an isolated virtual environment and install
`python -m pip install -r scripts/forecasting-research/requirements.txt`. These are
research-only pins; the application dependency files are unchanged. Then run:

```bash
export PYTHONPATH=services/forecasting/src
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
python scripts/forecasting-research/audit_v5_references.py \
  --workbook "$V5_WORKBOOK" --output build/post-defense-private/source-audit.json
python -m bloodledger_forecasting.post_defense \
  --workbook "$V5_WORKBOOK" \
  --protocol docs/research/POST-DEFENSE-FORECASTING-PROTOCOL.md \
  --output build/post-defense-private/run-NEW
python -m pytest services/forecasting/tests/test_post_defense.py \
  services/forecasting/tests/test_v5_experiment.py -q
```

`V5_WORKBOOK` is a user-provided private XLSX path; no download/regeneration occurs.
The JSON evaluation contains all 22 candidates, fold metrics, component/series
metrics, lineage and a secondary confusion matrix. The selected configuration
contains frozen medians when series_median wins, in the original 20-series order;
it deliberately does not conform to the deployed V5 mean-model contract.
`selected-predictions.csv` is private per-row research output. A second run is
permitted only as an exact reproducibility check, not to tune against test results.
