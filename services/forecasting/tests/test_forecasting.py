from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.forecasting import bundle_is_stale, create_forecast_bundle
from bloodledger_forecasting.modeling import load_model_artifact


def _forecast(
    synthetic_data: pd.DataFrame,
    dataset_path: Path,
    trained_bundle: dict[str, Any],
    *,
    horizon_date: str = "2026-01-01",
    generated_at: str = "2026-01-01T00:00:00Z",
) -> dict[str, Any]:
    return create_forecast_bundle(
        synthetic_data,
        dataset_path=dataset_path,
        artifact=trained_bundle["artifact"],
        artifact_path=trained_bundle["artifact_path"],
        manifest=trained_bundle["manifest"],
        horizon_date=horizon_date,
        generated_at=generated_at,
    )


def test_forecast_contains_exactly_four_safe_next_day_rows(
    synthetic_data: pd.DataFrame,
    dataset_path: Path,
    trained_bundle: dict[str, Any],
) -> None:
    bundle = _forecast(synthetic_data, dataset_path, trained_bundle)
    assert bundle["run"]["target"] == "requested_units"
    assert bundle["run"]["horizon_date"] == "2026-01-01"
    assert bundle["run"]["classification"] == "SIMULATION_ONLY"
    assert len(bundle["forecasts"]) == 4
    assert len({row["forecast_id"] for row in bundle["forecasts"]}) == 4
    assert {(row["blood_type"], row["component"]) for row in bundle["forecasts"]} == {
        ("A_POSITIVE", "RED_BLOOD_CELLS"),
        ("A_POSITIVE", "PLATELETS"),
        ("O_POSITIVE", "RED_BLOOD_CELLS"),
        ("O_POSITIVE", "PLATELETS"),
    }
    for row in bundle["forecasts"]:
        assert 0 <= row["lower_forecast"] <= row["point_forecast"]
        assert row["upper_forecast"] >= row["point_forecast"]
        assert row["recommendation_eligibility"] == "DISABLED_UNAPPROVED_POLICY"


def test_forecast_replay_has_stable_run_key_and_payload(
    synthetic_data: pd.DataFrame,
    dataset_path: Path,
    trained_bundle: dict[str, Any],
) -> None:
    first = _forecast(synthetic_data, dataset_path, trained_bundle)
    second = _forecast(
        synthetic_data,
        dataset_path,
        trained_bundle,
        generated_at="2026-01-01T01:00:00+00:00",
    )
    assert first["run"]["run_key"] == second["run"]["run_key"]
    assert first["run"]["payload_sha256"] == second["run"]["payload_sha256"]


def test_forecast_rejects_non_next_day_horizon(
    synthetic_data: pd.DataFrame,
    dataset_path: Path,
    trained_bundle: dict[str, Any],
) -> None:
    with pytest.raises(ForecastingError) as captured:
        _forecast(
            synthetic_data,
            dataset_path,
            trained_bundle,
            horizon_date="2026-01-02",
        )
    assert captured.value.code == "FORECAST_HORIZON_INVALID"


def test_missing_model_and_stale_behavior(
    tmp_path: Path,
    synthetic_data: pd.DataFrame,
    dataset_path: Path,
    trained_bundle: dict[str, Any],
) -> None:
    with pytest.raises(ForecastingError) as captured:
        load_model_artifact(tmp_path / "missing.pkl")
    assert captured.value.code == "MODEL_ARTIFACT_NOT_FOUND"

    bundle = _forecast(synthetic_data, dataset_path, trained_bundle)
    assert bundle_is_stale(bundle, date(2026, 1, 1)) is False
    assert bundle_is_stale(bundle, date(2026, 1, 2)) is True


def test_lineage_tampering_is_rejected(
    synthetic_data: pd.DataFrame,
    dataset_path: Path,
    trained_bundle: dict[str, Any],
) -> None:
    manifest = dict(trained_bundle["manifest"])
    manifest["model_artifact_sha256"] = "0" * 64
    changed = {**trained_bundle, "manifest": manifest}
    with pytest.raises(ForecastingError) as captured:
        _forecast(synthetic_data, dataset_path, changed)
    assert captured.value.code == "MODEL_LINEAGE_MISMATCH"
