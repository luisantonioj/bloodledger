# Sprint 3 ML Exploration

This package compares the accepted `SYNTHETIC_FORECAST_V1` control with one
per-series random-forest candidate and audits the external temporary workbook.
It is research-only and cannot change the default forecast, persist workbook
results, approve BROA output, or submit a transfer.

Run it in the pinned forecasting environment with the repository root on
`PYTHONPATH` and write all generated artifacts outside Git:

```bash
PYTHONPATH=services/forecasting/src:. python -m research.ml_exploration.cli \
  --repository-root "$PWD" \
  --workbook /path/to/BloodLedger_ML_Temporary_Dataset.xlsx \
  --notebook /path/to/BloodLedger_ML_Pipeline.ipynb \
  --manuscript /path/to/Revised-Manuscript-BloodLedger-Buno-Jopia-Lat.md \
  --output /tmp/bloodledger-ml-experiment/report.json
```

The JSON contains hashes, aggregate counts, metrics, gates, and limitations. It
contains no workbook rows. The issued-unit benchmark is intentionally separate
from requested-demand metrics and is never eligible as a BROA input.
