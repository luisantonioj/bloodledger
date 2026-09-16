from datetime import date, timedelta

import pandas as pd

from bloodledger_forecasting.runtime_v4 import (
    V4_BLOOD_TYPES,
    V4_COMPONENTS,
    V4_WEIGHT_DENOMINATOR,
    V4_WEIGHTS,
    create_v4_runtime_bundle,
)


def runtime_history(days: int = 7) -> pd.DataFrame:
    start = date(2026, 1, 1)
    rows: list[dict[str, object]] = []
    for day in range(days):
        for blood_index, blood_type in enumerate(V4_BLOOD_TYPES):
            for component_index, component in enumerate(V4_COMPONENTS):
                rows.append({
                    "business_date": start + timedelta(days=day),
                    "blood_type": blood_type,
                    "component": component,
                    "requested_units": day + blood_index + component_index,
                })
    return pd.DataFrame(rows)


def test_v4_weighted_average_and_all_twenty_series() -> None:
    bundle = create_v4_runtime_bundle(runtime_history(), generated_at="2026-01-08T00:00:00.000Z")
    assert bundle["run"]["runStatus"] == "COMPLETED"
    assert len(bundle["forecasts"]) == 20
    first = bundle["forecasts"][0]
    expected = sum(weight * (day + 0 + 0) for weight, day in zip(V4_WEIGHTS, range(7), strict=True)) / V4_WEIGHT_DENOMINATOR
    assert first["pointForecast"] == expected
    assert first["lowerForecast"] is None
    assert first["upperForecast"] is None
    assert first["uncertaintyStatus"] == "UNCERTAINTY_UNAVAILABLE"


def test_v4_missing_day_is_unavailable_and_not_zero_filled() -> None:
    data = runtime_history().query("business_date != '2026-01-04'")
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
