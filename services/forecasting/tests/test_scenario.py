from __future__ import annotations

import pytest

from bloodledger_forecasting.cli import main
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


def test_scenario_cli_writes_a_disabled_simulation_artifact(tmp_path) -> None:
    output = tmp_path / "surplus-scenario.json"
    assert (
        main(
            [
                "evaluate-surplus-scenario",
                "--current-stock",
                "20",
                "--point-forecast",
                "5",
                "--safety-stock",
                "2",
                "--reserve",
                "10",
                "--scenario-mode",
                "--output",
                str(output),
            ]
        )
        == 0
    )
    artifact = output.read_text(encoding="utf-8")
    assert '"schema_version": "BLOODLEDGER_SURPLUS_SCENARIO_V1"' in artifact
    assert '"predicted_surplus": 3.0' in artifact
    assert '"persisted": false' in artifact
    assert '"recommendation_eligibility": "DISABLED_UNAPPROVED_POLICY"' in artifact
