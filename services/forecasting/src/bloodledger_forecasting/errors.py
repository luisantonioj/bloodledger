"""Stable, safe forecasting errors."""

from __future__ import annotations


class ForecastingError(Exception):
    """An expected trust-boundary or workflow failure with a stable code."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    def __str__(self) -> str:
        return f"{self.code}: {self.message}"
