from datetime import date, timedelta
from copy import deepcopy

import pandas as pd
import pytest

from bloodledger_forecasting.runtime_v4 import (
    V4_BLOOD_TYPES,
    V4_COMPONENTS,
    V4_WEIGHT_DENOMINATOR,
    V4_WEIGHTS,
    create_v4_runtime_bundle,
    payload_sha256,
)
from bloodledger_forecasting.errors import ForecastingError


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
            expected = sum(
                weight * (day + blood_index + component_index)
                for weight, day in zip(V4_WEIGHTS, range(7), strict=True)
            ) / V4_WEIGHT_DENOMINATOR
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
