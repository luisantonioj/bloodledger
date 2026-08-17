from __future__ import annotations

from contextlib import nullcontext
from copy import deepcopy
from typing import Any

import pytest

from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.persistence import persist_failed_run, persist_forecast_bundle


class FakeResult:
    def __init__(self, row: tuple[str, ...] | None) -> None:
        self.row = row

    def fetchone(self) -> tuple[str, ...] | None:
        return self.row


class FakeConnection:
    def __init__(self) -> None:
        self.run: dict[str, Any] | None = None
        self.forecasts: list[dict[str, Any]] = []
        self.transaction_count = 0

    def transaction(self) -> Any:
        self.transaction_count += 1
        return nullcontext()

    def execute(self, query: str, parameters: Any) -> FakeResult:
        if "INSERT INTO app.forecast_runs" in query:
            if self.run is None:
                self.run = dict(parameters)
                return FakeResult((str(parameters["run_id"]),))
            return FakeResult(None)
        if "SELECT run_id, payload_sha256" in query:
            assert self.run is not None
            return FakeResult((str(self.run["run_id"]), str(self.run["payload_sha256"])))
        raise AssertionError(f"Unexpected SQL: {query}")

    def cursor(self) -> Any:
        return nullcontext(self)

    def executemany(self, query: str, parameters: list[dict[str, Any]]) -> None:
        assert "INSERT INTO app.demand_forecasts" in query
        self.forecasts.extend(deepcopy(parameters))


def _bundle() -> dict[str, Any]:
    run = {
        "run_id": "FRUN_" + "A" * 32,
        "run_key": "a" * 64,
        "payload_sha256": "b" * 64,
        "dataset_version": "SYNTHETIC_FORECAST_V1",
        "generator_version": "bloodledger-synthetic-demand-1.0.0",
        "dataset_sha256": "c" * 64,
        "code_sha256": "d" * 64,
        "config_sha256": "e" * 64,
        "model_artifact_sha256": "f" * 64,
        "model_version": "bloodledger-demand-forecast-1.0.0",
        "model_name": "weighted_average_7",
        "target": "requested_units",
        "input_start_date": "2025-01-01",
        "input_end_date": "2025-12-31",
        "horizon_date": "2026-01-01",
        "generated_at": "2026-01-01T00:00:00Z",
        "classification": "SIMULATION_ONLY",
        "run_status": "COMPLETED",
        "safe_error_code": None,
        "lineage": {},
        "selection_evidence": {},
    }
    series = [
        ("A_POSITIVE", "RED_BLOOD_CELLS"),
        ("A_POSITIVE", "PLATELETS"),
        ("O_POSITIVE", "RED_BLOOD_CELLS"),
        ("O_POSITIVE", "PLATELETS"),
    ]
    forecasts = [
        {
            "forecast_id": "FCST_" + f"{number:032X}",
            "institution_id": "INST_MEDIATRIX",
            "blood_type": blood_type,
            "component": component,
            "horizon_date": "2026-01-01",
            "point_forecast": 3.0,
            "lower_forecast": 1.0,
            "upper_forecast": 5.0,
            "uncertainty_note": "SERIES_ABSOLUTE_RESIDUAL_95TH_PERCENTILE",
            "forecast_status": "AVAILABLE",
            "stale_after": "2026-01-01",
            "classification": "SIMULATION_ONLY",
            "recommendation_eligibility": "DISABLED_UNAPPROVED_POLICY",
        }
        for number, (blood_type, component) in enumerate(series)
    ]
    return {
        "schema_version": "BLOODLEDGER_FORECAST_BUNDLE_V1",
        "run": run,
        "forecasts": forecasts,
    }


def test_atomic_insert_and_identical_replay() -> None:
    connection = FakeConnection()
    bundle = _bundle()
    assert persist_forecast_bundle(connection, bundle) == "INSERTED"  # type: ignore[arg-type]
    assert len(connection.forecasts) == 4
    assert connection.transaction_count == 1
    assert persist_forecast_bundle(connection, bundle) == "EXISTING"  # type: ignore[arg-type]
    assert len(connection.forecasts) == 4


def test_changed_payload_with_same_key_conflicts() -> None:
    connection = FakeConnection()
    bundle = _bundle()
    assert persist_forecast_bundle(connection, bundle) == "INSERTED"  # type: ignore[arg-type]
    changed = deepcopy(bundle)
    changed["run"]["payload_sha256"] = "c" * 64
    with pytest.raises(ForecastingError) as captured:
        persist_forecast_bundle(connection, changed)  # type: ignore[arg-type]
    assert captured.value.code == "FORECAST_RUN_CONFLICT"


def test_bundle_cannot_enable_operational_recommendation() -> None:
    bundle = _bundle()
    bundle["forecasts"][0]["recommendation_eligibility"] = "ELIGIBLE"
    with pytest.raises(ForecastingError) as captured:
        persist_forecast_bundle(FakeConnection(), bundle)  # type: ignore[arg-type]
    assert captured.value.code == "FORECAST_BUNDLE_INVALID"


def test_failed_run_writes_no_forecast_rows() -> None:
    connection = FakeConnection()
    run = _bundle()["run"]
    assert (
        persist_failed_run(  # type: ignore[arg-type]
            connection,
            run=run,
            safe_error_code="MODEL_ARTIFACT_NOT_FOUND",
        )
        == "INSERTED"
    )
    assert connection.run is not None
    assert connection.run["run_status"] == "FAILED"
    assert connection.run["safe_error_code"] == "MODEL_ARTIFACT_NOT_FOUND"
    assert connection.forecasts == []
