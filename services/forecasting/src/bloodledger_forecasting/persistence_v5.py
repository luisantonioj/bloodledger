"""Strict, append-only PostgreSQL persistence of frozen V5 runtime bundles."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import psycopg
from psycopg import Connection

from .errors import ForecastingError
from .runtime_v5 import CONFIGURATION, create_v5_runtime_bundle


def persist_v5_runtime_bundle(
    connection: Connection[Any],
    bundle: dict[str, Any],
    model_path: Path,
    binding_path: Path,
    approved_binding_sha256: str,
) -> str:
    """Recreate the bundle from trusted inputs before inserting any caller data."""
    try:
        run = bundle["run"]
        expected = create_v5_runtime_bundle(
            model_path=model_path,
            binding_path=binding_path,
            request_id=run["requestId"],
            origin_date=run["originDate"],
            generated_at=run["generatedAt"],
            institution_id=run["institutionId"],
            approved_binding_sha256=approved_binding_sha256,
        )
    except (KeyError, TypeError) as error:
        raise ForecastingError("V5_BUNDLE_INVALID", "V5 bundle shape is invalid") from error
    if expected != bundle:
        raise ForecastingError("V5_BUNDLE_INVALID", "V5 bundle does not verify")
    lineage = run["lineage"]
    db_run = {
        "run_id": run["runId"],
        "institution_id": run["institutionId"],
        "run_key": run["runKey"],
        "payload_sha256": lineage["payloadSha256"],
        "dataset_version": run["datasetVersion"],
        "generator_version": "runtime_v5",
        "dataset_sha256": lineage["datasetSha256"],
        "code_sha256": lineage["runtimeCodeSha256"],
        "config_sha256": lineage["configurationSha256"],
        "model_artifact_sha256": lineage["modelFileSha256"],
        "model_version": run["modelVersion"],
        "model_name": run["modelName"],
        "target": run["target"],
        "input_start_date": run["originDate"],
        "input_end_date": run["originDate"],
        "horizon_date": run["horizonDate"],
        "generated_at": run["generatedAt"],
        "classification": run["classification"],
        "run_status": run["runStatus"],
        "safe_error_code": run["unavailableReason"],
        "lineage": json.dumps(lineage, sort_keys=True),
        "selection_evidence": json.dumps(CONFIGURATION, sort_keys=True),
    }
    try:
        with connection.transaction():
            inserted = connection.execute(
                """
                INSERT INTO app.forecast_runs (
                  run_id, institution_id, run_key, payload_sha256, dataset_version,
                  generator_version, dataset_sha256, code_sha256, config_sha256,
                  model_artifact_sha256, model_version, model_name, target_name,
                  input_start_date, input_end_date, horizon_date, generated_at,
                  classification, run_status, safe_error_code, lineage, selection_evidence
                ) VALUES (
                  %(run_id)s, %(institution_id)s, %(run_key)s, %(payload_sha256)s,
                  %(dataset_version)s, %(generator_version)s, %(dataset_sha256)s,
                  %(code_sha256)s, %(config_sha256)s, %(model_artifact_sha256)s,
                  %(model_version)s, %(model_name)s, %(target)s,
                  %(input_start_date)s, %(input_end_date)s, %(horizon_date)s,
                  %(generated_at)s, %(classification)s, %(run_status)s,
                  %(safe_error_code)s, %(lineage)s::jsonb, %(selection_evidence)s::jsonb
                ) ON CONFLICT (run_key) DO NOTHING RETURNING run_id
                """,
                db_run,
            ).fetchone()
            if inserted is None:
                existing = connection.execute(
                    "SELECT run_id, institution_id, payload_sha256 "
                    "FROM app.forecast_runs WHERE run_key=%s",
                    (run["runKey"],),
                ).fetchone()
                if existing != (run["runId"], run["institutionId"], lineage["payloadSha256"]):
                    raise ForecastingError(
                        "FORECAST_RUN_CONFLICT", "V5 run key has different content"
                    )
                return "EXISTING"
            if run["runStatus"] == "COMPLETED":
                with connection.cursor() as cursor:
                    cursor.executemany(
                        """
                        INSERT INTO app.demand_forecasts (
                          forecast_id, run_id, institution_id, blood_type, component,
                          horizon_date, point_forecast, lower_forecast, upper_forecast,
                          uncertainty_note, uncertainty_status, forecast_status,
                          stale_after, classification, recommendation_eligibility, generated_at
                        ) VALUES (
                          %(forecastId)s, %(run_id)s, %(institutionId)s, %(bloodType)s,
                          %(component)s, %(horizonDate)s, %(pointForecast)s,
                          %(lowerForecast)s, %(upperForecast)s, %(uncertaintyNote)s,
                          %(uncertaintyStatus)s, %(forecastStatus)s, %(staleAfter)s,
                          %(classification)s, %(recommendationEligibility)s, %(generated_at)s
                        )
                        """,
                        [
                            {**forecast, "run_id": run["runId"], "generated_at": run["generatedAt"]}
                            for forecast in bundle["forecasts"]
                        ],
                    )
        return "INSERTED"
    except ForecastingError:
        raise
    except psycopg.Error as error:
        raise ForecastingError(
            "FORECAST_PERSISTENCE_FAILED", "V5 forecast transaction was not committed"
        ) from error
