from copy import deepcopy
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import pytest

from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.runtime_v4 import (
    V4_BLOOD_TYPES,
    V4_COMPONENTS,
    V4_WEIGHT_DENOMINATOR,
    V4_WEIGHTS,
    create_v4_runtime_bundle,
    payload_sha256,
)


def runtime_history(days: int = 7) -> pd.DataFrame:
    start = date(2026, 1, 1)
    rows: list[dict[str, object]] = []
    for day in range(days):
        for blood_index, blood_type in enumerate(V4_BLOOD_TYPES):
            for component_index, component in enumerate(V4_COMPONENTS):
                rows.append(
                    {
                        "business_date": start + timedelta(days=day),
                        "blood_type": blood_type,
                        "component": component,
                        "requested_units": day + blood_index + component_index,
                    }
                )
    return pd.DataFrame(rows)


def test_v4_weighted_average_and_all_twenty_series() -> None:
    bundle = create_v4_runtime_bundle(runtime_history(), generated_at="2026-01-08T00:00:00.000Z")
    assert bundle["run"]["runStatus"] == "COMPLETED"
    assert len(bundle["forecasts"]) == 20
    for blood_index, blood_type in enumerate(V4_BLOOD_TYPES):
        for component_index, component in enumerate(V4_COMPONENTS):
            row = next(
                item
                for item in bundle["forecasts"]
                if item["bloodType"] == blood_type and item["component"] == component
            )
            expected = (
                sum(
                    weight * (day + blood_index + component_index)
                    for weight, day in zip(V4_WEIGHTS, range(7), strict=True)
                )
                / V4_WEIGHT_DENOMINATOR
            )
            assert row["pointForecast"] == expected
            assert row["asOfDate"] == "2026-01-07"
            assert row["lowerForecast"] is None
            assert row["upperForecast"] is None
            assert row["uncertaintyStatus"] == "UNCERTAINTY_UNAVAILABLE"


def test_v4_missing_day_is_unavailable_and_not_zero_filled() -> None:
    data = runtime_history()
    data = data[data["business_date"] != date(2026, 1, 4)]
    bundle = create_v4_runtime_bundle(data, generated_at="2026-01-08T00:00:00.000Z")
    assert bundle["run"]["runStatus"] == "UNAVAILABLE"
    assert bundle["run"]["unavailableReason"] == "V4_HISTORY_UNAVAILABLE"
    assert bundle["forecasts"] == []


def test_v4_explicit_component_aliases_and_unsupported_type() -> None:
    data = runtime_history().replace({"PACKED_RED_BLOOD_CELLS": "PRBC", "CRYOPRECIPITATE": "CRYO"})
    bundle = create_v4_runtime_bundle(data, generated_at="2026-01-08T00:00:00.000Z")
    assert len(bundle["forecasts"]) == 20
    unsupported = runtime_history().assign(blood_type="A_NEGATIVE")
    unavailable = create_v4_runtime_bundle(unsupported, generated_at="2026-01-08T00:00:00.000Z")
    assert unavailable["run"]["runStatus"] == "UNAVAILABLE"


def test_v4_rejects_unexpected_fields_and_future_observations() -> None:
    with pytest.raises(ForecastingError, match="Unexpected V4 input fields"):
        create_v4_runtime_bundle(
            runtime_history().assign(patient_id="PROHIBITED"),
            generated_at="2026-01-08T00:00:00.000Z",
        )
    future = runtime_history().assign(business_date=lambda frame: frame["business_date"])
    future.loc[future.index[-1], "business_date"] = date(2026, 1, 8)
    unavailable = create_v4_runtime_bundle(future, generated_at="2026-01-08T00:00:00.000Z")
    assert unavailable["run"]["unavailableReason"] == "V4_HISTORY_FUTURE_OBSERVATION"


def test_v4_semantic_payload_hash_excludes_execution_timestamp() -> None:
    first = create_v4_runtime_bundle(runtime_history(), generated_at="2026-01-08T00:00:00.000Z")
    second = create_v4_runtime_bundle(runtime_history(), generated_at="2026-01-08T04:00:00.000Z")
    assert first["run"]["runKey"] == second["run"]["runKey"]
    assert payload_sha256(first) == payload_sha256(second)
    changed = deepcopy(second)
    changed["forecasts"][0]["pointForecast"] += 1
    assert payload_sha256(changed) != payload_sha256(first)


def test_v4_uses_manila_business_date_for_future_history_validation() -> None:
    bundle = create_v4_runtime_bundle(
        runtime_history(),
        generated_at="2026-01-07T16:30:00.000Z",
        institution_id="INST_SYNTHETIC_DESTINATION",
    )
    assert bundle["run"]["runStatus"] == "COMPLETED"
    assert bundle["run"]["institutionId"] == "INST_SYNTHETIC_DESTINATION"


# Issue #9 / FR-14: immutable producer lineage and unavailable-attempt fidelity.
def test_v4_forecast_ids_are_institution_scoped() -> None:
    first = create_v4_runtime_bundle(runtime_history(), generated_at="2026-01-08T00:00:00Z")
    other = create_v4_runtime_bundle(
        runtime_history(),
        generated_at="2026-01-08T00:00:00Z",
        institution_id="INST_SYNTHETIC_DESTINATION",
    )
    assert first["run"]["runKey"] != other["run"]["runKey"]
    assert {f["forecastId"] for f in first["forecasts"]}.isdisjoint(
        f["forecastId"] for f in other["forecasts"]
    )


def test_v4_in_memory_dataset_hash_tracks_data() -> None:
    first = create_v4_runtime_bundle(runtime_history(), generated_at="2026-01-08T00:00:00Z")
    changed = runtime_history()
    changed.loc[0, "requested_units"] += 1
    other = create_v4_runtime_bundle(changed, generated_at="2026-01-08T00:00:00Z")
    assert first["run"]["lineage"]["datasetSha256"] != other["run"]["lineage"]["datasetSha256"]


def test_v4_null_is_unavailable_with_requested_dates() -> None:
    data = runtime_history().astype({"requested_units": "Float64"})
    data.loc[0, "requested_units"] = pd.NA
    bundle = create_v4_runtime_bundle(
        data,
        generated_at="2026-01-10T00:00:00Z",
        origin_date="2026-01-09",
        horizon_date="2026-01-10",
    )
    assert bundle["run"]["runStatus"] == "UNAVAILABLE"
    assert bundle["run"]["originDate"] == "2026-01-09"
    assert bundle["run"]["horizonDate"] == "2026-01-10"
    assert bundle["forecasts"] == []


def test_v4_short_history_preserves_requested_window() -> None:
    bundle = create_v4_runtime_bundle(
        runtime_history(3),
        generated_at="2026-01-08T00:00:00Z",
        origin_date="2026-01-07",
        horizon_date="2026-01-08",
    )
    assert bundle["run"]["originDate"] == "2026-01-07"
    assert bundle["run"]["horizonDate"] == "2026-01-08"


@pytest.mark.parametrize("field", ["V4_CODE_SHA256", "V4_CONFIGURATION_SHA256", "V4_MODEL_SHA256"])
def test_v4_all_immutable_lineage_changes_identity(
    field: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    import bloodledger_forecasting.runtime_v4 as runtime

    first = create_v4_runtime_bundle(runtime_history(), generated_at="2026-01-08T00:00:00Z")
    monkeypatch.setattr(runtime, field, "f" * 64)
    second = create_v4_runtime_bundle(runtime_history(), generated_at="2026-01-08T00:00:00Z")
    assert first["run"]["runKey"] != second["run"]["runKey"]
    assert {f["forecastId"] for f in first["forecasts"]}.isdisjoint(
        f["forecastId"] for f in second["forecasts"]
    )


def test_v4_hashes_file_bytes_and_rejects_nonexistent_path(tmp_path: Path) -> None:
    import hashlib

    path = tmp_path / "history.csv"
    data = runtime_history()
    with pytest.raises(ForecastingError, match="V4_DATASET_READ_FAILED"):
        create_v4_runtime_bundle(data, dataset_path=path, generated_at="2026-01-08T00:00:00Z")
    with pytest.raises(ForecastingError, match="V4_DATASET_READ_FAILED"):
        create_v4_runtime_bundle(data, dataset_path=tmp_path, generated_at="2026-01-08T00:00:00Z")
    data.to_csv(path, index=False)
    first = create_v4_runtime_bundle(data, dataset_path=path, generated_at="2026-01-08T00:00:00Z")
    assert first["run"]["lineage"]["datasetSha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    path.write_bytes(path.read_bytes().replace(b"\n", b"\r\n"))
    second = create_v4_runtime_bundle(data, dataset_path=path, generated_at="2026-01-08T00:00:00Z")
    assert first["run"]["lineage"]["inputSha256"] == second["run"]["lineage"]["inputSha256"]
    assert first["run"]["runKey"] != second["run"]["runKey"]
    assert first["forecasts"][0]["forecastId"] != second["forecasts"][0]["forecastId"]


@pytest.mark.parametrize("missing", [None, float("nan"), pd.NA])
def test_v4_null_evidence_is_json_safe_stable_and_different_from_zero(missing: object) -> None:
    import json

    data = runtime_history().astype({"requested_units": "object"})
    data.loc[0, "requested_units"] = missing
    first = create_v4_runtime_bundle(data, generated_at="2026-01-08T00:00:00Z")
    replay = create_v4_runtime_bundle(
        data.sample(frac=1, random_state=42), generated_at="2026-01-08T03:00:00Z"
    )
    assert first["run"]["runStatus"] == "UNAVAILABLE"
    assert first["forecasts"] == []
    assert first["run"]["runKey"] == replay["run"]["runKey"]
    assert payload_sha256(first) == payload_sha256(replay)
    json.dumps(first, allow_nan=False)
    zero = create_v4_runtime_bundle(runtime_history(), generated_at="2026-01-08T00:00:00Z")
    assert zero["run"]["runStatus"] == "COMPLETED"
    assert first["run"]["lineage"]["inputSha256"] != zero["run"]["lineage"]["inputSha256"]


@pytest.mark.parametrize(
    "kind", ["empty", "short", "unsupported", "missing_series", "future", "null"]
)
@pytest.mark.parametrize(
    "dates",
    [
        {"origin_date": "2026-01-07", "horizon_date": "2026-01-08"},
        {"origin_date": "2026-01-07"},
        {"horizon_date": "2026-01-08"},
    ],
)
def test_v4_all_unavailable_paths_preserve_requested_dates(
    kind: str, dates: dict[str, str]
) -> None:
    data = runtime_history()
    if kind == "empty":
        data = data.iloc[:0]
    elif kind == "short":
        data = runtime_history(3)
    elif kind == "unsupported":
        data = data.assign(blood_type="A_NEGATIVE")
    elif kind == "missing_series":
        data = data.iloc[1:]
    elif kind == "future":
        data.loc[0, "business_date"] = date(2026, 1, 8)
    else:
        data = data.astype({"requested_units": "object"})
        data.loc[0, "requested_units"] = None
    bundle = create_v4_runtime_bundle(data, generated_at="2026-01-08T00:00:00Z", **dates)
    assert bundle["run"]["runStatus"] == "UNAVAILABLE"
    assert bundle["run"]["inputStartDate"] == "2026-01-01"
    assert bundle["run"]["inputEndDate"] == bundle["run"]["originDate"] == "2026-01-07"
    assert bundle["run"]["horizonDate"] == "2026-01-08"


@pytest.mark.parametrize(
    "dates",
    [
        {"origin_date": "bad"},
        {"horizon_date": "2026-02-30"},
        {"origin_date": "2026-01-07", "horizon_date": "2026-01-09"},
        {"horizon_date": "20260108"},
    ],
)
def test_v4_invalid_requested_dates_rejected_even_without_history(dates: dict[str, str]) -> None:
    with pytest.raises(ForecastingError):
        create_v4_runtime_bundle(
            runtime_history(0).reindex(columns=runtime_history().columns),
            generated_at="2026-01-08T00:00:00Z",
            **dates,
        )


def test_v4_empty_default_uses_previous_manila_day() -> None:
    bundle = create_v4_runtime_bundle(
        runtime_history().iloc[:0], generated_at="2026-01-07T16:30:00Z"
    )
    assert bundle["run"]["originDate"] == "2026-01-07"
    assert bundle["run"]["horizonDate"] == "2026-01-08"


@pytest.mark.parametrize("quantity", ["not-numeric", float("inf"), -1])
def test_v4_invalid_quantities_are_not_missing_values(quantity: object) -> None:
    data = runtime_history().astype({"requested_units": "object"})
    data.loc[0, "requested_units"] = quantity
    with pytest.raises(ForecastingError, match="V4_QUANTITY_INVALID"):
        create_v4_runtime_bundle(data, generated_at="2026-01-08T00:00:00Z")
