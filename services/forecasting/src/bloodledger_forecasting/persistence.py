"""Atomic PostgreSQL persistence for simulation-only forecast bundles."""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from datetime import date
from typing import Any

import psycopg
from psycopg import Connection

from .constants import EVALUATION_CLASSIFICATION, RECOMMENDATION_ELIGIBILITY
from .errors import ForecastingError

RUN_FIELDS = frozenset(
    {
        "run_id",
        "run_key",
        "payload_sha256",
        "dataset_version",
        "generator_version",
        "dataset_sha256",
        "code_sha256",
        "config_sha256",
        "model_artifact_sha256",
        "model_version",
        "model_name",
        "target",
        "input_start_date",
        "input_end_date",
        "horizon_date",
        "generated_at",
        "classification",
        "run_status",
        "safe_error_code",
        "lineage",
        "selection_evidence",
    }
)
FORECAST_FIELDS = frozenset(
    {
        "forecast_id",
        "institution_id",
        "blood_type",
        "component",
        "horizon_date",
        "point_forecast",
        "lower_forecast",
        "upper_forecast",
        "uncertainty_note",
        "forecast_status",
        "stale_after",
        "classification",
        "recommendation_eligibility",
    }
)
EXPECTED_SERIES = frozenset(
    {
        ("A_POSITIVE", "RED_BLOOD_CELLS"),
        ("A_POSITIVE", "PLATELETS"),
        ("O_POSITIVE", "RED_BLOOD_CELLS"),
        ("O_POSITIVE", "PLATELETS"),
    }
)


@dataclass(frozen=True)
class AppDatabaseConfig:
    """Least-privileged runtime connection fields loaded without printing secrets."""

    host: str
    port: int
    database: str
    user: str
    password: str


def app_database_config_from_environment() -> AppDatabaseConfig:
    """Load the existing BloodLedger runtime-role environment contract."""

    values = {
        "database": os.environ.get("POSTGRES_DB"),
        "user": os.environ.get("POSTGRES_APP_USER"),
        "password": os.environ.get("POSTGRES_APP_PASSWORD"),
    }
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise ForecastingError(
            "DATABASE_CONFIGURATION_MISSING",
            "Required runtime database configuration is missing",
        )
    port_text = os.environ.get("POSTGRES_PORT", os.environ.get("POSTGRES_HOST_PORT", "5432"))
    try:
        port = int(port_text)
    except ValueError as error:
        raise ForecastingError(
            "DATABASE_CONFIGURATION_INVALID", "PostgreSQL port is invalid"
        ) from error
    if port < 1 or port > 65535:
        raise ForecastingError("DATABASE_CONFIGURATION_INVALID", "PostgreSQL port is invalid")
    return AppDatabaseConfig(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=port,
        database=str(values["database"]),
        user=str(values["user"]),
        password=str(values["password"]),
    )


def connect_as_runtime(config: AppDatabaseConfig) -> Connection[Any]:
    """Connect as `bloodledger_app`; callers own the returned connection."""

    if config.user != "bloodledger_app":
        raise ForecastingError(
            "DATABASE_ROLE_INVALID", "Forecast persistence requires bloodledger_app"
        )
    return psycopg.connect(
        host=config.host,
        port=config.port,
        dbname=config.database,
        user=config.user,
        password=config.password,
        connect_timeout=10,
    )


def _validate_run(run: dict[str, Any], expected_status: str) -> None:
    if set(run) != RUN_FIELDS:
        raise ForecastingError("FORECAST_BUNDLE_INVALID", "Run fields do not match the contract")
    if (
        run["classification"] != EVALUATION_CLASSIFICATION
        or run["target"] != "requested_units"
        or run["run_status"] != expected_status
    ):
        raise ForecastingError("FORECAST_BUNDLE_INVALID", "Run policy fields are invalid")
    if expected_status == "COMPLETED" and run["safe_error_code"] is not None:
        raise ForecastingError("FORECAST_BUNDLE_INVALID", "Completed run includes an error")
    if not isinstance(run["lineage"], dict) or not isinstance(run["selection_evidence"], dict):
        raise ForecastingError("FORECAST_BUNDLE_INVALID", "Run evidence must be JSON objects")


def _validate_forecasts(forecasts: list[dict[str, Any]], run: dict[str, Any]) -> None:
    if any(set(forecast) != FORECAST_FIELDS for forecast in forecasts):
        raise ForecastingError(
            "FORECAST_BUNDLE_INVALID", "Forecast fields do not match the contract"
        )
    series = {(forecast["blood_type"], forecast["component"]) for forecast in forecasts}
    if series != EXPECTED_SERIES:
        raise ForecastingError("FORECAST_BUNDLE_INVALID", "Forecast series are incomplete")
    for forecast in forecasts:
        values = (
            forecast["lower_forecast"],
            forecast["point_forecast"],
            forecast["upper_forecast"],
        )
        if any(
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(float(value))
            for value in values
        ):
            raise ForecastingError("FORECAST_BUNDLE_INVALID", "Forecast values are invalid")
        lower, point, upper = (float(value) for value in values)
        if lower < 0 or lower > point or point > upper:
            raise ForecastingError("FORECAST_BUNDLE_INVALID", "Forecast interval is invalid")
        try:
            stale_after = date.fromisoformat(str(forecast["stale_after"]))
            horizon = date.fromisoformat(str(forecast["horizon_date"]))
        except ValueError as error:
            raise ForecastingError(
                "FORECAST_BUNDLE_INVALID", "Forecast dates are invalid"
            ) from error
        if (
            forecast["institution_id"] != "INST_MEDIATRIX"
            or forecast["horizon_date"] != run["horizon_date"]
            or stale_after < horizon
            or forecast["forecast_status"] != "AVAILABLE"
            or forecast["classification"] != EVALUATION_CLASSIFICATION
            or forecast["recommendation_eligibility"] != RECOMMENDATION_ELIGIBILITY
        ):
            raise ForecastingError("FORECAST_BUNDLE_INVALID", "Forecast policy fields are invalid")


def persist_forecast_bundle(connection: Connection[Any], bundle: dict[str, Any]) -> str:
    """Atomically insert a completed run and four forecasts with conflict detection."""

    if bundle.get("schema_version") != "BLOODLEDGER_FORECAST_BUNDLE_V1":
        raise ForecastingError("FORECAST_BUNDLE_INVALID", "Unsupported forecast bundle")
    run = bundle.get("run")
    forecasts = bundle.get("forecasts")
    if not isinstance(run, dict) or not isinstance(forecasts, list) or len(forecasts) != 4:
        raise ForecastingError(
            "FORECAST_BUNDLE_INVALID", "A completed bundle must contain exactly four forecasts"
        )
    if not all(isinstance(forecast, dict) for forecast in forecasts):
        raise ForecastingError("FORECAST_BUNDLE_INVALID", "Forecast entries must be objects")
    _validate_run(run, "COMPLETED")
    _validate_forecasts(forecasts, run)

    try:
        with connection.transaction():
            inserted = connection.execute(
                """
                INSERT INTO app.forecast_runs (
                  run_id, run_key, payload_sha256, dataset_version,
                  generator_version, dataset_sha256, code_sha256, config_sha256,
                  model_artifact_sha256, model_version, model_name, target_name,
                  input_start_date, input_end_date, horizon_date, generated_at,
                  classification, run_status, safe_error_code, lineage,
                  selection_evidence
                ) VALUES (
                  %(run_id)s, %(run_key)s, %(payload_sha256)s, %(dataset_version)s,
                  %(generator_version)s, %(dataset_sha256)s, %(code_sha256)s,
                  %(config_sha256)s, %(model_artifact_sha256)s, %(model_version)s,
                  %(model_name)s, %(target)s, %(input_start_date)s,
                  %(input_end_date)s, %(horizon_date)s, %(generated_at)s,
                  %(classification)s, %(run_status)s, %(safe_error_code)s,
                  %(lineage)s::jsonb, %(selection_evidence)s::jsonb
                )
                ON CONFLICT (run_key) DO NOTHING
                RETURNING run_id
                """,
                {
                    **run,
                    "lineage": json.dumps(run["lineage"], sort_keys=True),
                    "selection_evidence": json.dumps(run["selection_evidence"], sort_keys=True),
                },
            ).fetchone()

            if inserted is None:
                existing = connection.execute(
                    "SELECT run_id, payload_sha256 FROM app.forecast_runs WHERE run_key = %s",
                    (run["run_key"],),
                ).fetchone()
                if existing is None or existing[1] != run["payload_sha256"]:
                    raise ForecastingError(
                        "FORECAST_RUN_CONFLICT", "Run key already has different content"
                    )
                return "EXISTING"

            with connection.cursor() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO app.demand_forecasts (
                      forecast_id, run_id, institution_id, blood_type, component,
                      horizon_date, point_forecast, lower_forecast, upper_forecast,
                      uncertainty_note, forecast_status, stale_after, classification,
                      recommendation_eligibility, generated_at
                    ) VALUES (
                      %(forecast_id)s, %(run_id)s, %(institution_id)s, %(blood_type)s,
                      %(component)s, %(horizon_date)s, %(point_forecast)s,
                      %(lower_forecast)s, %(upper_forecast)s, %(uncertainty_note)s,
                      %(forecast_status)s, %(stale_after)s, %(classification)s,
                      %(recommendation_eligibility)s, %(generated_at)s
                    )
                    """,
                    [
                        {
                            **forecast,
                            "run_id": run["run_id"],
                            "generated_at": run["generated_at"],
                        }
                        for forecast in forecasts
                    ],
                )
        return "INSERTED"
    except ForecastingError:
        raise
    except psycopg.Error as error:
        raise ForecastingError(
            "FORECAST_PERSISTENCE_FAILED", "Forecast transaction was not committed"
        ) from error


def persist_failed_run(
    connection: Connection[Any],
    *,
    run: dict[str, Any],
    safe_error_code: str,
) -> str:
    """Persist a lineage-aware failure without writing forecast rows."""

    if not safe_error_code or len(safe_error_code) > 64:
        raise ForecastingError("FORECAST_FAILURE_CODE_INVALID", "Safe error code is invalid")
    failed = dict(run)
    failed.update(
        {
            "run_status": "FAILED",
            "safe_error_code": safe_error_code,
            "classification": EVALUATION_CLASSIFICATION,
        }
    )
    _validate_run(failed, "FAILED")
    try:
        with connection.transaction():
            inserted = connection.execute(
                """
                INSERT INTO app.forecast_runs (
                  run_id, run_key, payload_sha256, dataset_version,
                  generator_version, dataset_sha256, code_sha256, config_sha256,
                  model_artifact_sha256, model_version, model_name, target_name,
                  input_start_date, input_end_date, horizon_date, generated_at,
                  classification, run_status, safe_error_code, lineage,
                  selection_evidence
                ) VALUES (
                  %(run_id)s, %(run_key)s, %(payload_sha256)s, %(dataset_version)s,
                  %(generator_version)s, %(dataset_sha256)s, %(code_sha256)s,
                  %(config_sha256)s, %(model_artifact_sha256)s, %(model_version)s,
                  %(model_name)s, %(target)s, %(input_start_date)s,
                  %(input_end_date)s, %(horizon_date)s, %(generated_at)s,
                  %(classification)s, %(run_status)s, %(safe_error_code)s,
                  %(lineage)s::jsonb, %(selection_evidence)s::jsonb
                ) ON CONFLICT (run_key) DO NOTHING RETURNING run_id
                """,
                {
                    **failed,
                    "lineage": json.dumps(failed["lineage"], sort_keys=True),
                    "selection_evidence": json.dumps(failed["selection_evidence"], sort_keys=True),
                },
            ).fetchone()
            if inserted is None:
                existing = connection.execute(
                    "SELECT payload_sha256 FROM app.forecast_runs WHERE run_key = %s",
                    (failed["run_key"],),
                ).fetchone()
                if existing is None or existing[0] != failed["payload_sha256"]:
                    raise ForecastingError(
                        "FORECAST_RUN_CONFLICT", "Run key already has different content"
                    )
                return "EXISTING"
        return "INSERTED"
    except ForecastingError:
        raise
    except psycopg.Error as error:
        raise ForecastingError(
            "FORECAST_PERSISTENCE_FAILED", "Failed-run evidence was not committed"
        ) from error
