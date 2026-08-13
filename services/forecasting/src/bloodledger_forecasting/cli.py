"""Command-line boundary for the Sprint 3 forecasting experiment."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .constants import (
    CLASSIFICATION,
    DATA_COLUMNS,
    DATASET_VERSION,
    DEFAULT_HORIZON_DATE,
    EVALUATION_CLASSIFICATION,
    GENERATOR_VERSION,
)
from .errors import ForecastingError
from .forecasting import create_forecast_bundle
from .modeling import load_model_artifact, train_model, write_model_artifact
from .persistence import (
    app_database_config_from_environment,
    connect_as_runtime,
    persist_forecast_bundle,
)
from .scenario import evaluate_surplus_scenario
from .synthetic import SyntheticConfig, generate_synthetic_data, write_synthetic_csv
from .validation import load_and_validate_csv, sha256_file, validate_dataset


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, sort_keys=True, ensure_ascii=True, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ForecastingError("MANIFEST_NOT_FOUND", "Required manifest does not exist")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ForecastingError("MANIFEST_INVALID", "Manifest is not valid JSON") from error
    if not isinstance(value, dict):
        raise ForecastingError("MANIFEST_INVALID", "Manifest root must be an object")
    return value


def _utc_timestamp(value: str | None) -> str:
    if value is None:
        parsed = datetime.now(UTC)
    else:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise ForecastingError(
                "TRAINING_GENERATION_TIME_INVALID", "generated_at must be ISO-8601"
            ) from error
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ForecastingError(
                "TRAINING_GENERATION_TIME_INVALID", "generated_at must include an offset"
            )
        parsed = parsed.astimezone(UTC)
    return parsed.isoformat().replace("+00:00", "Z")


def _generate(args: argparse.Namespace) -> dict[str, Any]:
    output = Path(args.output)
    config = SyntheticConfig()
    data = generate_synthetic_data(config)
    validated = validate_dataset(data)
    write_synthetic_csv(validated, output)
    metadata = {
        "schema_version": "BLOODLEDGER_SYNTHETIC_DATASET_MANIFEST_V1",
        "classification": CLASSIFICATION,
        "dataset_version": DATASET_VERSION,
        "generator_version": GENERATOR_VERSION,
        "seed": config.seed,
        "start_date": validated["business_date"].min().date().isoformat(),
        "end_date": validated["business_date"].max().date().isoformat(),
        "row_count": len(validated),
        "series_count": 4,
        "target": "requested_units",
        "columns": list(DATA_COLUMNS),
        "generation_parameters": {
            "weekday_factor": 1.15,
            "weekend_factor": 0.85,
            "annual_seasonal_amplitude": 0.15,
            "replenishment_target_days": 5,
            "missed_replenishment_probability": 0.12,
            "expiry_event_probability": 0.025,
            "adjustment_units": 0,
        },
        "csv_sha256": sha256_file(output),
        "limitations": [
            "Synthetic research data; not observed Mediatrix demand.",
            "Contains no patient, donor, employee, diagnosis, or treatment data.",
        ],
    }
    manifest_path = (
        Path(args.manifest)
        if args.manifest
        else output.with_suffix(output.suffix + ".manifest.json")
    )
    _write_json(manifest_path, metadata)
    return {"output": str(output), "manifest": str(manifest_path), **metadata}


def _validate(args: argparse.Namespace) -> dict[str, Any]:
    path = Path(args.data)
    data = load_and_validate_csv(path)
    return {
        "status": "VALID",
        "classification": CLASSIFICATION,
        "dataset_version": DATASET_VERSION,
        "rows": len(data),
        "series": 4,
        "start_date": data["business_date"].min().date().isoformat(),
        "end_date": data["business_date"].max().date().isoformat(),
        "sha256": sha256_file(path),
    }


def _train(args: argparse.Namespace) -> dict[str, Any]:
    data_path = Path(args.data)
    artifact_path = Path(args.artifact)
    manifest_path = Path(args.manifest)
    data = load_and_validate_csv(data_path)
    source_root = Path(__file__).resolve().parent
    artifact, manifest = train_model(data, dataset_path=data_path, source_root=source_root)
    artifact_sha256 = write_model_artifact(artifact, artifact_path)
    manifest["model_artifact"] = artifact_path.name
    manifest["model_artifact_sha256"] = artifact_sha256
    manifest["training_generated_at"] = _utc_timestamp(args.generated_at)
    _write_json(manifest_path, manifest)
    return {
        "status": "TRAINED",
        "classification": EVALUATION_CLASSIFICATION,
        "selected_model": manifest["selected_model"],
        "artifact": str(artifact_path),
        "artifact_sha256": artifact_sha256,
        "manifest": str(manifest_path),
    }


def _forecast(args: argparse.Namespace) -> dict[str, Any]:
    data_path = Path(args.data)
    artifact_path = Path(args.artifact)
    manifest_path = Path(args.manifest)
    data = load_and_validate_csv(data_path)
    artifact = load_model_artifact(artifact_path)
    manifest = _read_json(manifest_path)
    bundle = create_forecast_bundle(
        data,
        dataset_path=data_path,
        artifact=artifact,
        artifact_path=artifact_path,
        manifest=manifest,
        horizon_date=args.horizon_date,
        generated_at=args.generated_at,
    )
    output_path = Path(args.output)
    _write_json(output_path, bundle)
    persistence_status = "NOT_REQUESTED"
    if args.persist:
        connection = connect_as_runtime(app_database_config_from_environment())
        try:
            persistence_status = persist_forecast_bundle(connection, bundle)
        finally:
            connection.close()
    return {
        "status": "FORECASTED",
        "classification": EVALUATION_CLASSIFICATION,
        "output": str(output_path),
        "run_id": bundle["run"]["run_id"],
        "forecast_count": len(bundle["forecasts"]),
        "persistence": persistence_status,
        "recommendation_eligibility": "DISABLED_UNAPPROVED_POLICY",
    }


def _scenario(args: argparse.Namespace) -> dict[str, Any]:
    surplus = evaluate_surplus_scenario(
        current_stock=args.current_stock,
        point_forecast=args.point_forecast,
        safety_stock=args.safety_stock,
        reserve=args.reserve,
        scenario_mode=args.scenario_mode,
    )
    return {
        "classification": EVALUATION_CLASSIFICATION,
        "scenario_mode": True,
        "predicted_surplus": surplus,
        "persisted": False,
        "recommendation_eligibility": "DISABLED_UNAPPROVED_POLICY",
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bloodledger-forecasting",
        description="BloodLedger Sprint 3 simulation-only forecasting worker",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    generate = subparsers.add_parser("generate-synthetic")
    generate.add_argument("--output", required=True)
    generate.add_argument("--manifest")
    generate.set_defaults(handler=_generate)

    validate = subparsers.add_parser("validate-data")
    validate.add_argument("--data", required=True)
    validate.set_defaults(handler=_validate)

    train = subparsers.add_parser("train")
    train.add_argument("--data", required=True)
    train.add_argument("--artifact", required=True)
    train.add_argument("--manifest", required=True)
    train.add_argument("--generated-at")
    train.set_defaults(handler=_train)

    forecast = subparsers.add_parser("forecast")
    forecast.add_argument("--data", required=True)
    forecast.add_argument("--artifact", required=True)
    forecast.add_argument("--manifest", required=True)
    forecast.add_argument("--output", required=True)
    forecast.add_argument("--horizon-date", default=DEFAULT_HORIZON_DATE)
    forecast.add_argument("--generated-at")
    forecast.add_argument("--persist", action="store_true")
    forecast.set_defaults(handler=_forecast)

    scenario = subparsers.add_parser("evaluate-surplus-scenario")
    scenario.add_argument("--current-stock", type=float, required=True)
    scenario.add_argument("--point-forecast", type=float, required=True)
    scenario.add_argument("--safety-stock", type=float, required=True)
    scenario.add_argument("--reserve", type=float, required=True)
    scenario.add_argument("--scenario-mode", action="store_true")
    scenario.set_defaults(handler=_scenario)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = args.handler(args)
    except ForecastingError as error:
        print(json.dumps({"status": "FAILED", "error_code": error.code}), file=sys.stderr)
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
