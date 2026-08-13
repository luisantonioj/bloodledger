from __future__ import annotations

import pytest

from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.scenario import evaluate_surplus_scenario


@pytest.mark.parametrize(
    ("current_stock", "expected"),
    [(20, 3), (17, 0), (10, 0)],
)
def test_scenario_examples(current_stock: float, expected: float) -> None:
    assert (
        evaluate_surplus_scenario(
            current_stock=current_stock,
            point_forecast=5,
            safety_stock=2,
            reserve=10,
            scenario_mode=True,
        )
        == expected
    )


def test_scenario_requires_explicit_mode() -> None:
    with pytest.raises(ForecastingError) as captured:
        evaluate_surplus_scenario(
            current_stock=20,
            point_forecast=5,
            safety_stock=2,
            reserve=10,
            scenario_mode=False,
        )
    assert captured.value.code == "SCENARIO_MODE_REQUIRED"


def test_scenario_rejects_negative_input() -> None:
    with pytest.raises(ForecastingError) as captured:
        evaluate_surplus_scenario(
            current_stock=-1,
            point_forecast=5,
            safety_stock=2,
            reserve=10,
            scenario_mode=True,
        )
    assert captured.value.code == "SCENARIO_INPUT_INVALID"
