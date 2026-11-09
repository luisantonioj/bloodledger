"""Post-defense research: FR-14/RQ-07 causal evaluation, not operational accuracy."""

import numpy as np
import pandas as pd
import pytest

from bloodledger_forecasting import post_defense as pdx
from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.v5_experiment import features


def source():
    return pd.DataFrame(
        [
            dict(
                date=d,
                blood_type="A+",
                component="WB",
                total_requested_units=i % 5,
                inpatient_requested_units=i % 5,
                outpatient_requested_units=0,
                available_close_units=30,
            )
            for i, d in enumerate(pd.date_range("2024-01-01", periods=100))
        ]
    )


def test_future_observations_do_not_change_prior_features():
    a = source()
    first = pdx.extend(features(a))
    a.loc[a.date > "2024-03-01", "total_requested_units"] = 999
    second = pdx.extend(features(a))
    columns = [c for c in first if c.startswith(("ses_", "sba_", "tsb_", "seasonal_median_"))]
    np.testing.assert_allclose(
        first.loc[first.origin_date <= "2024-03-01", columns],
        second.loc[second.origin_date <= "2024-03-01", columns],
    )


@pytest.mark.parametrize("kind", ["ses", "sba", "tsb"])
def test_all_zero_and_reproducible_smoothing(kind):
    np.testing.assert_array_equal(pdx.smooth(np.zeros(20), kind, 0.1), np.zeros(20))
    x = np.array([0, 0, 3, 0, 2])
    np.testing.assert_array_equal(pdx.smooth(x, kind, 0.3), pdx.smooth(x, kind, 0.3))


def test_missing_counts_and_dates_fail():
    f = features(source())
    with pytest.raises(ForecastingError):
        pdx.extend(f.drop(index=5))
    f.loc[4, "total_requested_units"] = np.nan
    with pytest.raises(ForecastingError):
        pdx.extend(f)


def test_chronological_fit_rejects_overlap():
    f = features(source()).query("training_eligible")
    with pytest.raises(ForecastingError):
        pdx.fit_predict("series_median", f, f)


def test_metrics_and_zero_denominator():
    m = pdx.score(np.array([0, 2, 4]), np.array([1, 0, 3]))
    assert m["wape_percent"] == pytest.approx(100 * 4 / 6)
    assert m["bias_units_per_series_day"] == pytest.approx(-2 / 3)
    assert m["underprediction_rate"] == pytest.approx(2 / 3)
    assert m["underpredicted_units"] == 3
    assert m["zero_demand_mae"] == 1
    assert pdx.score(np.zeros(2), np.ones(2))["wape_percent"] is None
    with pytest.raises(ForecastingError):
        pdx.score(np.ones(2), np.array([np.nan, 1]))


def test_selection_ignores_test_and_ties_are_stable():
    rows = [
        {"model": "b", "validation": {"mae": 1}, "test": {"mae": 0}},
        {"model": "a", "validation": {"mae": 1}, "test": {"mae": 99}},
    ]
    assert pdx.select(rows) == "a"
    assert pdx.select(rows[::-1]) == "a"


def test_seasonal_median_targets_next_weekday():
    a = source()
    a.total_requested_units = np.arange(100)
    f = pdx.extend(features(a))
    assert f.iloc[27].seasonal_median_4 == np.median([21, 14, 7, 0])


def test_median_is_fit_on_training_only():
    f = pdx.extend(features(source())).query("training_eligible")
    train, val = f.iloc[:40], f.iloc[40:]
    a = pdx.fit_predict("series_median", train, val)
    altered = val.copy()
    altered.target_requested_units = 10000
    np.testing.assert_array_equal(a, pdx.fit_predict("series_median", train, altered))


def test_intermittent_updates_have_known_values():
    # First positive is on day 3; SBA initializes interval=3 and corrects by .95.
    np.testing.assert_allclose(pdx.smooth(np.array([0, 0, 6, 0]), "sba", 0.1), [0, 0, 1.9, 1.9])
    np.testing.assert_allclose(pdx.smooth(np.array([0, 0, 6, 0]), "tsb", 0.1), [0, 0, 0.6, 0.54])


def test_boosting_predictions_ignore_evaluation_targets_and_repeat():
    f = pdx.extend(features(source())).query("training_eligible")
    train, val = f.iloc[:40], f.iloc[40:]
    a = pdx.fit_predict("boost_poisson_7", train, val)
    altered = val.copy()
    altered.target_requested_units = 999
    np.testing.assert_array_equal(a, pdx.fit_predict("boost_poisson_7", train, altered))
