from __future__ import annotations

import pandas as pd

from bloodledger_forecasting.synthetic import generate_synthetic_data
from research.ml_exploration.experiment import (
    _build_generic_features,
    _contact_pattern_scan,
    _privacy_scan,
    candidate_gate,
    evaluate_per_series_candidate,
)


def test_shifted_features_do_not_use_current_target() -> None:
    data = pd.DataFrame(
        {
            "business_date": pd.date_range("2025-01-01", periods=20),
            "blood_type": ["A_POSITIVE"] * 20,
            "component": ["RED_BLOOD_CELLS"] * 20,
            "issued_units": list(range(20)),
        }
    )
    original = _build_generic_features(
        data, target="issued_units", series_columns=("blood_type", "component")
    )
    changed = data.copy()
    changed.loc[15, "issued_units"] = 9999
    rebuilt = _build_generic_features(
        changed, target="issued_units", series_columns=("blood_type", "component")
    )
    feature_columns = ["lag_1", "lag_7", "weighted_7", "mean_14"]
    assert original.loc[15, feature_columns].equals(rebuilt.loc[15, feature_columns])


def test_per_series_candidate_is_deterministic() -> None:
    data = generate_synthetic_data()
    first = evaluate_per_series_candidate(data)
    second = evaluate_per_series_candidate(data)
    assert first == second
    assert first["non_negative_predictions"] is True


def test_candidate_gate_requires_improvement_over_every_control() -> None:
    series = {"A|R": {"mae": 1.0, "wape": 10.0, "rmse": 1.0}}
    control = {
        name: {"pooled": {"mae": 1.0, "wape": 10.0, "rmse": 1.0}, "series": series}
        for name in ("seasonal_naive_7", "weighted_average_7", "random_forest_global")
    }
    candidate = {
        "metrics": {
            "pooled": {"mae": 0.96, "wape": 9.0, "rmse": 0.96},
            "series": series,
        },
        "non_negative_predictions": True,
    }
    assert candidate_gate(control, candidate)["passed"] is False


def test_privacy_scan_rejects_prohibited_structured_fields() -> None:
    frame = pd.DataFrame({"donor_name": ["SYNTHETIC PERSON"]})
    assert _privacy_scan(frame)["passed"] is False


def test_contact_scan_checks_documentation_sheets_without_schema_false_positive() -> None:
    guidance = pd.DataFrame({"Guidance": ["Do not include donor names"]})
    assert _contact_pattern_scan(guidance)["passed"] is True
    contact = pd.DataFrame({"Guidance": ["person@example.test"]})
    assert _contact_pattern_scan(contact)["passed"] is False
