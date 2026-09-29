"""FR forecasting simulation gates: chronology, provenance, errors and replay."""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.v5_experiment import (
    SERIES,
    confusion,
    features,
    fit,
    metrics,
    predict,
    read_synthetic,
    run,
    runtime_bundle,
)


def history() -> pd.DataFrame:
    rows = []
    for b, c in SERIES:
        for i, day in enumerate(pd.date_range("2025-01-01", periods=40)):
            rows.append(
                {
                    "date": day,
                    "blood_type": b,
                    "component": c,
                    "total_requested_units": i,
                    "inpatient_requested_units": i,
                    "outpatient_requested_units": 0,
                    "available_close_units": 100,
                }
            )
    return features(pd.DataFrame(rows))


def test_features_use_origin_not_future() -> None:
    f = history()
    row = f.iloc[27]
    assert row.lag1_requested == 27
    assert row.lag7_requested == 21
    assert row.lag14_requested == 14
    assert row.mean28_requested == 13.5
    assert row.target_requested_units == 28
    assert not f.iloc[26].training_eligible
    assert not f.iloc[39].training_eligible


def test_zero_demand_wape_is_undefined() -> None:
    assert metrics(np.array([0.0, 0.0]), np.array([1.0, 0.0]))["wape_percent"] is None


def test_confusion_matrix_definition() -> None:
    result = confusion(np.array([0.0, 0.0, 1.0, 5.0]), np.array([0.0, 1.0, 0.0, 2.0]))
    assert result["matrix_actual_rows_predicted_columns"] == [[1, 1], [1, 1]]
    assert result["accuracy"] == 0.5
    assert result["balanced_accuracy"] == 0.5


def test_confusion_undefined_positive_metrics() -> None:
    result = confusion(np.zeros(2), np.zeros(2))
    assert result["recall"] is None
    assert result["precision"] is None
    assert result["balanced_accuracy"] is None


@pytest.mark.parametrize(
    "name", ["last_day", "seasonal_7", "weighted_7", "mean_28", "series_mean", "ridge_1"]
)
def test_model_roundtrip_nonnegative(name: str) -> None:
    data = history()
    data = data[data.training_eligible]
    model = fit(name, data)
    values = predict(model, data)
    assert len(values) == len(data)
    assert np.isfinite(values).all()
    assert (values >= 0).all()


def test_runtime_replay_and_lineage() -> None:
    data = history()
    model = fit("weighted_7", data[data.training_eligible])
    a = runtime_bundle(data, model, {"workbookSha256": "a"}, "2025-02-01")
    b = runtime_bundle(data, model, {"workbookSha256": "a"}, "2025-02-01")
    c = runtime_bundle(data, model, {"workbookSha256": "b"}, "2025-02-01")
    assert a == b
    assert a["run"]["runId"] != c["run"]["runId"]
    assert len(a["forecasts"]) == 20
    assert a["forecasts"][0]["lowerForecast"] is None
    assert not a["forecasts"][0]["stockIsLive"]


def test_null_history_keeps_requested_window() -> None:
    data = history()
    data.loc[data.origin_date == "2025-02-01", "lag1_requested"] = np.nan
    result = runtime_bundle(data, fit("weighted_7", data), {}, "2025-02-01")
    assert result["run"]["status"] == "UNAVAILABLE"
    assert result["run"]["originDate"] == "2025-02-01"
    assert result["run"]["horizonDate"] == "2025-02-02"
    assert result["forecasts"] == []


def test_absent_origin_is_not_imputed() -> None:
    data = history()
    result = runtime_bundle(data, fit("weighted_7", data), {}, "2026-01-01")
    assert result["run"]["status"] == "UNAVAILABLE"
    assert result["run"]["horizonDate"] == "2026-01-02"


def test_non_synthetic_institution_rejected() -> None:
    data = history()
    with pytest.raises(ForecastingError, match="V5"):
        runtime_bundle(data, fit("weighted_7", data), {}, "2025-02-01", "INST_OTHER")


def test_missing_workbook_fails(tmp_path: Path) -> None:
    with pytest.raises(ForecastingError):
        read_synthetic(tmp_path / "missing.xlsx")
    with pytest.raises(ForecastingError):
        run(tmp_path / "missing.xlsx", tmp_path, tmp_path / "missing.md")


@pytest.fixture(scope="module")
def complete_tables() -> dict[str, pd.DataFrame]:
    from bloodledger_forecasting.v5_experiment import COLUMNS, SHEETS, VERSION

    index = pd.MultiIndex.from_product(
        [
            pd.date_range("2023-01-01", "2026-12-31"),
            ["A+", "B+", "O+", "AB+"],
            ["WB", "PRBC", "FFP", "PC", "CRYO"],
        ],
        names=["date", "blood_type", "component"],
    )
    base = index.to_frame(index=False)
    base["dataset_version"] = VERSION
    base["institution_id"] = "SIM_INSTITUTION_01"
    base["classification"] = "SYNTHETIC"
    tables = {}
    for name in SHEETS[:3]:
        f = base.copy()
        for col in COLUMNS[name]:
            if col.endswith("_units"):
                f[col] = 0
        tables[name] = f[COLUMNS[name]]
    inputs = tables[SHEETS[0]].copy()
    inputs["available_close_units"] = 0
    ml = features(inputs)
    ml["eligibility_reason"] = np.where(ml.training_eligible, "ELIGIBLE", "INSUFFICIENT_HISTORY")
    tables[SHEETS[3]] = ml[COLUMNS[SHEETS[3]]]
    return tables


def test_full_zero_history_is_observed_simulated_zero(
    complete_tables: dict[str, pd.DataFrame],
) -> None:
    from bloodledger_forecasting.v5_experiment import validate

    result = validate(complete_tables)
    assert len(result) == 29220
    assert int(result.training_eligible.sum()) == 28660


@pytest.mark.parametrize(
    "mutation", ["missing", "duplicate", "null", "observed", "stock", "target"]
)
def test_invalid_workbook_history_rejected(
    complete_tables: dict[str, pd.DataFrame], mutation: str
) -> None:
    from bloodledger_forecasting.v5_experiment import SHEETS, validate

    tables = {name: data.copy() for name, data in complete_tables.items()}
    if mutation == "missing":
        tables[SHEETS[0]] = tables[SHEETS[0]].iloc[1:]
    elif mutation == "duplicate":
        tables[SHEETS[0]].iloc[1] = tables[SHEETS[0]].iloc[0]
    elif mutation == "null":
        tables[SHEETS[0]]["total_requested_units"] = tables[SHEETS[0]][
            "total_requested_units"
        ].astype(float)
        tables[SHEETS[0]].loc[0, "total_requested_units"] = np.nan
    elif mutation == "observed":
        tables[SHEETS[0]].loc[0, "classification"] = "OBSERVED"
    elif mutation == "stock":
        tables[SHEETS[2]].loc[0, "closing_units"] = 1
    else:
        tables[SHEETS[3]].loc[30, "target_requested_units"] = 9
    with pytest.raises(ForecastingError):
        validate(tables)
