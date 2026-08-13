"""Explicitly non-operational predicted distributable surplus scenario."""

from __future__ import annotations

from .errors import ForecastingError


def evaluate_surplus_scenario(
    *,
    current_stock: float,
    point_forecast: float,
    safety_stock: float,
    reserve: float,
    scenario_mode: bool,
) -> float:
    """Calculate a clamped surplus only when the caller opts into simulation."""

    if scenario_mode is not True:
        raise ForecastingError(
            "SCENARIO_MODE_REQUIRED", "Surplus evaluation requires scenario_mode=true"
        )
    values = (current_stock, point_forecast, safety_stock, reserve)
    if any(value < 0 for value in values):
        raise ForecastingError("SCENARIO_INPUT_INVALID", "Scenario quantities cannot be negative")
    return max(0.0, current_stock - point_forecast - safety_stock - reserve)
