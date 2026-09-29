"""V5 local research evaluation. Reads synthetic allowlisted sheets, never observed records."""

from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from datetime import date, timedelta
from pathlib import Path
from typing import Any, cast
from xml.etree import ElementTree as ET

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from .errors import ForecastingError

VERSION = "SYNTHETIC_FORECAST_V5_RESEARCH_V1"
SERIES = [(b, c) for b in ("A+", "B+", "O+", "AB+") for c in ("WB", "PRBC", "FFP", "PC", "CRYO")]
SHEETS = (
    "Synthetic_Daily_Requests",
    "Synthetic_Daily_Movements",
    "Synthetic_Daily_Stocks",
    "ML_Training_View",
)
KEYS = ["date", "blood_type", "component"]
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
MODEL_NAMES = (
    "last_day",
    "seasonal_7",
    "weighted_7",
    "mean_28",
    "series_mean",
    "ridge_1",
    "ridge_10",
    "ridge_100",
)


BASE_COLUMNS = ["dataset_version", "institution_id", "date", "blood_type", "component"]
COLUMNS = {
    SHEETS[0]: BASE_COLUMNS
    + [
        "inpatient_requested_units",
        "outpatient_requested_units",
        "total_requested_units",
        "classification",
    ],
    SHEETS[1]: BASE_COLUMNS
    + [
        "received_units",
        "inpatient_released_units",
        "outpatient_released_units",
        "total_released_units",
        "expired_units",
        "inpatient_unmet_units",
        "outpatient_unmet_units",
        "total_unmet_units",
        "classification",
    ],
    SHEETS[2]: BASE_COLUMNS
    + [
        "opening_units",
        "expired_units",
        "received_units",
        "reserved_close_units",
        "available_before_release_units",
        "released_units",
        "closing_units",
        "available_close_units",
        "expiring_within_7_days_units",
        "classification",
    ],
    SHEETS[3]: [
        "dataset_version",
        "institution_id",
        "origin_date",
        "target_date",
        "blood_type",
        "component",
        "target_weekday",
        "target_month",
        "lag1_requested",
        "lag7_requested",
        "lag14_requested",
        "weighted7_requested",
        "mean28_requested",
        "origin_inpatient_requested",
        "origin_outpatient_requested",
        "origin_available_close_units",
        "target_requested_units",
        "partition",
        "training_eligible",
        "eligibility_reason",
        "classification",
    ],
}


def digest(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, allow_nan=False, separators=(",", ":")).encode()
    ).hexdigest()


def require(condition: bool, code: str) -> None:
    if not condition:
        raise ForecastingError(code, "V5 research validation failed; no observed values emitted")


def read_synthetic(path: Path) -> dict[str, pd.DataFrame]:
    """Read only four named sheets; reject formulas, entities and oversized archives."""
    try:
        with zipfile.ZipFile(path) as archive:
            require(sum(i.file_size for i in archive.infolist()) < 256_000_000, "V5_SIZE")

            def xml(name: str) -> ET.Element:
                raw = archive.read(name)
                require(b"<!DOCTYPE" not in raw and b"<!ENTITY" not in raw, "V5_XML")
                return ET.fromstring(raw)  # noqa: S314 - size bounded; DTD/entities rejected

            rels = {r.attrib["Id"]: r.attrib["Target"] for r in xml("xl/_rels/workbook.xml.rels")}
            names = {}
            for node in xml("xl/workbook.xml").findall("m:sheets/m:sheet", NS):
                rid = node.attrib[
                    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
                ]
                target = rels[rid]
                names[node.attrib["name"]] = (
                    target.lstrip("/") if target.startswith("/") else "xl/" + target
                )
            # Generated V5 uses inline strings; do not load unrestricted shared strings.
            result = {}
            for name in SHEETS:
                rows = []
                for row in xml(names[name]).findall("m:sheetData/m:row", NS):
                    cells: dict[int, Any] = {}
                    for cell in row:
                        require(cell.find("m:f", NS) is None, "V5_FORMULA")
                        letters = "".join(x for x in cell.attrib["r"] if x.isalpha())
                        column = 0
                        for ch in letters:
                            column = column * 26 + ord(ch) - 64
                        kind = cell.attrib.get("t")
                        require(kind != "s", "V5_SHARED_STRINGS_UNSUPPORTED")
                        v = cell.find("m:v", NS)
                        if kind == "inlineStr":
                            value: Any = "".join(t.text or "" for t in cell.findall(".//m:t", NS))
                        elif v is None:
                            value = None
                        else:
                            value = float(v.text or "nan")
                        cells[column - 1] = value
                    rows.append([cells.get(i) for i in range(max(cells, default=-1) + 1)])
                header = rows[0]
                require(header == COLUMNS[name], "V5_SCHEMA")
                require(len(header) == len(set(header)), "V5_HEADER_DUPLICATE")
                frame = pd.DataFrame(rows[1:], columns=header)
                for col in ("date", "origin_date", "target_date"):
                    if col in frame:
                        frame[col] = pd.to_datetime(frame[col], unit="D", origin="1899-12-30")
                result[name] = frame
            return result
    except ForecastingError:
        raise
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as exc:
        raise ForecastingError("V5_WORKBOOK_INVALID", "Cannot read V5 synthetic sheets") from exc


def validate(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Reject unknowns, duplicates and unreconciled synthetic histories without imputation."""
    req, mov, stock, ml = [tables[n].copy() for n in SHEETS]
    expected = pd.MultiIndex.from_product(
        [
            pd.date_range("2023-01-01", "2026-12-31"),
            [s[0] for s in SERIES[::5]],
            [s[1] for s in SERIES[:5]],
        ],
        names=KEYS,
    )
    aligned = []
    for frame in (req, mov, stock):
        require(len(frame) == 29220 and not frame.duplicated(KEYS).any(), "V5_KEYS")
        require(set(frame["classification"]) == {"SYNTHETIC"}, "V5_CLASSIFICATION")
        require(set(frame["dataset_version"]) == {VERSION}, "V5_VERSION")
        require(set(frame["institution_id"]) == {"SIM_INSTITUTION_01"}, "V5_INSTITUTION")
        frame = frame.set_index(KEYS).sort_index()
        require(frame.index.equals(expected.sort_values()), "V5_COVERAGE")
        for col in frame.columns:
            if col.endswith("_units"):
                nums = pd.to_numeric(frame[col], errors="coerce").to_numpy(dtype=float)
                require(
                    bool(
                        np.isfinite(nums).all()
                        and (nums >= 0).all()
                        and (nums == np.floor(nums)).all()
                    ),
                    "V5_COUNTS",
                )
        aligned.append(frame)
    req, mov, stock = aligned
    require(
        bool(
            (
                req.total_requested_units
                == req.inpatient_requested_units + req.outpatient_requested_units
            ).all()
        ),
        "V5_REQUEST_BALANCE",
    )
    for setting in ("inpatient", "outpatient", "total"):
        require(
            bool(
                (
                    req[f"{setting}_requested_units"]
                    == mov[f"{setting}_released_units"] + mov[f"{setting}_unmet_units"]
                ).all()
            ),
            "V5_FULFILMENT",
        )
    require(
        bool(
            (
                mov.total_released_units
                == mov.inpatient_released_units + mov.outpatient_released_units
            ).all()
        ),
        "V5_RELEASE_BALANCE",
    )
    require(
        bool(
            (
                stock.opening_units
                + stock.received_units
                - stock.expired_units
                - stock.released_units
                == stock.closing_units
            ).all()
        ),
        "V5_STOCK_BALANCE",
    )
    require(
        bool(
            (stock.closing_units - stock.reserved_close_units == stock.available_close_units).all()
        ),
        "V5_AVAILABLE",
    )
    require(
        bool(
            (
                stock.available_before_release_units
                == stock.opening_units
                - stock.expired_units
                + stock.received_units
                - stock.reserved_close_units
            ).all()
        ),
        "V5_PRE_RELEASE",
    )
    require(
        bool((stock.released_units <= stock.available_before_release_units).all()),
        "V5_OVER_RELEASE",
    )
    require(bool((stock.expiring_within_7_days_units <= stock.closing_units).all()), "V5_EXPIRY")
    for a, b in (
        ("received_units", "received_units"),
        ("expired_units", "expired_units"),
        ("total_released_units", "released_units"),
    ):
        require(bool((mov[a] == stock[b]).all()), "V5_CROSS_SHEET")
    previous = stock.groupby(level=["blood_type", "component"]).closing_units.shift(1)
    require(
        bool((stock.opening_units[previous.notna()] == previous.dropna()).all()), "V5_CONTINUITY"
    )
    data = req.reset_index().merge(
        stock.reset_index()[KEYS + ["available_close_units"]], on=KEYS, validate="one_to_one"
    )
    built = features(data)
    require(
        len(ml) == 29220 and not ml.duplicated(["origin_date", "blood_type", "component"]).any(),
        "V5_ML_KEYS",
    )
    require(
        set(ml.classification) == {"SYNTHETIC"} and set(ml.dataset_version) == {VERSION},
        "V5_ML_PROVENANCE",
    )
    compare = ml.set_index(["origin_date", "blood_type", "component"]).sort_index()
    calculated = built.set_index(["origin_date", "blood_type", "component"]).sort_index()
    require(compare.index.equals(calculated.index), "V5_ML_COVERAGE")
    for col in (
        "lag1_requested",
        "lag7_requested",
        "lag14_requested",
        "weighted7_requested",
        "mean28_requested",
        "target_requested_units",
        "origin_inpatient_requested",
        "origin_outpatient_requested",
        "origin_available_close_units",
        "target_weekday",
        "target_month",
        "training_eligible",
    ):
        require(
            bool(
                np.allclose(
                    compare[col].to_numpy(dtype=float),
                    calculated[col].to_numpy(dtype=float),
                    equal_nan=True,
                )
            ),
            "V5_ML_RECOMPUTATION",
        )
    require(
        bool(
            (compare.target_date == calculated.target_date).all()
            and (compare.partition == calculated.partition).all()
        ),
        "V5_SPLITS",
    )
    return built


def features(data: pd.DataFrame) -> pd.DataFrame:
    blocks = []
    for bt, comp in SERIES:
        s = data[(data.blood_type == bt) & (data.component == comp)].sort_values("date").copy()
        y = s.total_requested_units
        s["origin_date"] = s.date
        s["target_date"] = s.date + pd.Timedelta(days=1)
        s["lag1_requested"] = y
        s["lag7_requested"] = y.shift(6)
        s["lag14_requested"] = y.shift(13)
        s["weighted7_requested"] = y.rolling(7).apply(
            lambda a: float(np.dot(a, np.arange(1, 8)) / 28), raw=True
        )
        s["mean28_requested"] = y.rolling(28).mean()
        s["target_requested_units"] = y.shift(-1)
        s["origin_inpatient_requested"] = s.inpatient_requested_units
        s["origin_outpatient_requested"] = s.outpatient_requested_units
        s["origin_available_close_units"] = s.available_close_units
        s["target_weekday"] = s.target_date.dt.weekday
        s["target_month"] = s.target_date.dt.month
        s["partition"] = np.select(
            [
                s.target_date <= "2024-12-31",
                s.target_date <= "2025-06-30",
                s.target_date <= "2025-12-31",
                s.target_date <= "2026-12-31",
            ],
            ["TRAIN", "VALIDATION", "TEST", "DEMO_EXTENSION"],
            default="OUTSIDE_COVERAGE",
        )
        s["training_eligible"] = s.mean28_requested.notna() & s.target_requested_units.notna()
        blocks.append(s)
    return pd.concat(blocks, ignore_index=True)


def design(frame: pd.DataFrame) -> np.ndarray:
    numeric = frame[
        [
            "lag1_requested",
            "lag7_requested",
            "lag14_requested",
            "weighted7_requested",
            "mean28_requested",
            "origin_inpatient_requested",
            "origin_outpatient_requested",
        ]
    ].to_numpy(dtype=float)
    categories = np.column_stack(
        [((frame.blood_type == b) & (frame.component == c)).astype(float) for b, c in SERIES]
    )
    weekdays = np.column_stack([(frame.target_weekday == d).astype(float) for d in range(7)])
    month = frame.target_month.to_numpy(dtype=float)
    return np.column_stack(
        [
            numeric,
            categories,
            weekdays,
            np.sin(2 * np.pi * month / 12),
            np.cos(2 * np.pi * month / 12),
        ]
    )


def fit(name: str, frame: pd.DataFrame) -> dict[str, Any]:
    model: dict[str, Any] = {
        "name": name,
        "version": "bloodledger-v5-" + name.replace("_", "-") + "-1.0.0",
    }
    if name == "series_mean":
        model["means"] = [
            float(
                frame.loc[
                    (frame.blood_type == b) & (frame.component == c), "target_requested_units"
                ].mean()
            )
            for b, c in SERIES
        ]
    elif name.startswith("ridge_"):
        x = design(frame)
        center, scale = x.mean(axis=0), x.std(axis=0)
        scale[scale == 0] = 1
        estimator = Ridge(alpha=float(name.split("_")[1])).fit(
            (x - center) / scale, frame.target_requested_units.to_numpy(dtype=float)
        )
        model.update(
            center=center.tolist(),
            scale=scale.tolist(),
            coefficients=estimator.coef_.tolist(),
            intercept=float(estimator.intercept_),
        )
    return model


def predict(model: dict[str, Any], frame: pd.DataFrame) -> np.ndarray:
    columns = {
        "last_day": "lag1_requested",
        "seasonal_7": "lag7_requested",
        "weighted_7": "weighted7_requested",
        "mean_28": "mean28_requested",
    }
    name = model["name"]
    if name in columns:
        values = frame[columns[name]].to_numpy(dtype=float)
    elif name == "series_mean":
        mapping = dict(zip(SERIES, model["means"], strict=True))
        values = np.array(
            [mapping[(b, c)] for b, c in zip(frame.blood_type, frame.component, strict=True)]
        )
    else:
        values = (
            (design(frame) - np.array(model["center"])) / np.array(model["scale"])
        ) @ np.array(model["coefficients"]) + model["intercept"]
    return cast(np.ndarray, np.maximum(0, values))


def metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, Any]:
    error = actual - predicted
    return {
        "n": len(actual),
        "mae": float(np.abs(error).mean()),
        "rmse": float(np.sqrt((error**2).mean())),
        "wape_percent": float(np.abs(error).sum() / actual.sum() * 100) if actual.sum() else None,
    }


def confusion(actual: np.ndarray, predicted: np.ndarray) -> dict[str, Any]:
    truth, decision = actual > 0, predicted >= 0.5
    tn, fp, fn, tp = [
        int(x.sum())
        for x in (~truth & ~decision, ~truth & decision, truth & ~decision, truth & decision)
    ]

    def ratio(a: float, b: float) -> float | None:
        return a / b if b else None

    recall, specificity = ratio(tp, tp + fn), ratio(tn, tn + fp)
    return {
        "definition": (
            "Actual any-demand >0 units; predicted any-demand >=0.5 units. "
            "Secondary classification, not numeric forecast accuracy."
        ),
        "matrix_actual_rows_predicted_columns": [[tn, fp], [fn, tp]],
        "labels": ["NO_DEMAND", "ANY_DEMAND"],
        "accuracy": ratio(tp + tn, len(actual)),
        "precision": ratio(tp, tp + fp),
        "recall": recall,
        "specificity": specificity,
        "f1": ratio(2 * tp, 2 * tp + fp + fn),
        "balanced_accuracy": (recall + specificity) / 2
        if recall is not None and specificity is not None
        else None,
        "positive_prevalence": float(truth.mean()),
        "majority_baseline_accuracy": float(max(truth.mean(), 1 - truth.mean())),
    }


def grouped(frame: pd.DataFrame, predicted: np.ndarray) -> dict[str, Any]:
    scored = frame.copy()
    scored["prediction"] = predicted
    return {
        "overall": metrics(scored.target_requested_units.to_numpy(), predicted),
        "components": {
            str(k): metrics(g.target_requested_units.to_numpy(), g.prediction.to_numpy())
            for k, g in scored.groupby("component")
        },
        "series": {
            str(k): metrics(g.target_requested_units.to_numpy(), g.prediction.to_numpy())
            for k, g in scored.groupby(["blood_type", "component"])
        },
    }


def runtime_bundle(
    frame: pd.DataFrame,
    model: dict[str, Any],
    lineage: dict[str, str],
    origin: str,
    institution: str = "SIM_INSTITUTION_01",
) -> dict[str, Any]:
    """Distinct research contract. Never sent through the V4 persistence function."""
    try:
        requested = date.fromisoformat(origin)
    except ValueError as exc:
        raise ForecastingError("V5_ORIGIN_INVALID", "Origin must be YYYY-MM-DD") from exc
    require(requested.isoformat() == origin, "V5_ORIGIN_INVALID")
    require(institution == "SIM_INSTITUTION_01", "V5_INSTITUTION")
    window = (
        frame[frame.origin_date == pd.Timestamp(origin)]
        .sort_values(["blood_type", "component"])
        .copy()
    )
    valid = len(window) == 20 and not window.duplicated(["blood_type", "component"]).any()
    valid = valid and set(zip(window.blood_type, window.component, strict=True)) == set(SERIES)
    needed = [
        "lag1_requested",
        "lag7_requested",
        "lag14_requested",
        "weighted7_requested",
        "mean28_requested",
        "origin_inpatient_requested",
        "origin_outpatient_requested",
        "origin_available_close_units",
    ]
    valid = valid and bool(np.isfinite(window[needed].to_numpy(dtype=float)).all())
    run: dict[str, Any] = {
        "institutionId": institution,
        "datasetVersion": VERSION,
        "modelVersion": model["version"],
        "originDate": origin,
        "horizonDate": (requested + timedelta(days=1)).isoformat(),
        "classification": "SIMULATION_ONLY",
        "recommendationEligibility": "DISABLED_UNAPPROVED_POLICY",
        "lineage": {**lineage, "modelSha256": digest(model)},
        "status": "AVAILABLE" if valid else "UNAVAILABLE",
        "unavailableReason": None if valid else "V5_HISTORY_UNAVAILABLE",
        "uncertaintyStatus": "UNCERTAINTY_UNAVAILABLE",
    }
    safe = (
        window[["blood_type", "component", *needed]]
        .astype(object)
        .where(pd.notna(window[["blood_type", "component", *needed]]), None)
        .to_dict(orient="records")
    )
    run["lineage"]["inputSha256"] = digest(safe)
    run["runId"] = "V5_" + digest(run)[:32]
    items = []
    if valid:
        for (_, row), value in zip(window.iterrows(), predict(model, window), strict=True):
            items.append(
                {
                    "forecastId": digest([run["runId"], row.blood_type, row.component]),
                    "bloodType": row.blood_type,
                    "component": row.component,
                    "pointForecast": float(value),
                    "lowerForecast": None,
                    "upperForecast": None,
                    "status": "AVAILABLE",
                    "syntheticAvailableStock": float(row.origin_available_close_units),
                    "stockAsOfDate": origin,
                    "stockClassification": "SYNTHETIC",
                    "stockIsLive": False,
                }
            )
    return {"schemaVersion": "BLOODLEDGER_V5_RESEARCH_PREVIEW_V1", "run": run, "forecasts": items}


def run(workbook: Path, output: Path, protocol: Path) -> dict[str, Any]:
    require(workbook.is_file() and protocol.is_file(), "V5_EVIDENCE_NOT_FOUND")
    output.mkdir(parents=True, exist_ok=True)
    tables = read_synthetic(workbook)
    full = validate(tables)
    eligible = full[full.training_eligible].copy()
    train = eligible[eligible.partition == "TRAIN"]
    validation = eligible[eligible.partition == "VALIDATION"]
    test = eligible[eligible.partition == "TEST"]
    candidates: list[dict[str, Any]] = []
    for name in MODEL_NAMES:
        m = fit(name, train)
        candidates.append(
            {
                "model": name,
                "train": metrics(train.target_requested_units.to_numpy(), predict(m, train)),
                "validation": metrics(
                    validation.target_requested_units.to_numpy(), predict(m, validation)
                ),
            }
        )
    selected = min(candidates, key=lambda r: (r["validation"]["mae"], r["model"]))["model"]
    model = fit(selected, pd.concat([train, validation]))
    predictions = predict(model, test)
    lineage = {
        "workbookSha256": hashlib.sha256(workbook.read_bytes()).hexdigest(),
        "codeSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "protocolSha256": hashlib.sha256(protocol.read_bytes()).hexdigest(),
    }
    sensitivity = []
    source = tables[SHEETS[0]].merge(
        tables[SHEETS[2]][KEYS + ["available_close_units"]], on=KEYS, validate="one_to_one"
    )
    for seed in (11, 29, 47):
        for factor in (0.5, 1.0, 1.5):
            rng = np.random.default_rng(seed)
            perturbed = source.copy()
            perturbed["inpatient_requested_units"] = rng.poisson(
                source.inpatient_requested_units.to_numpy()
            )
            perturbed["outpatient_requested_units"] = rng.poisson(
                source.outpatient_requested_units.to_numpy() * factor
            )
            perturbed["total_requested_units"] = (
                perturbed.inpatient_requested_units + perturbed.outpatient_requested_units
            )
            f = features(perturbed)
            f = f[f.training_eligible & (f.partition == "TEST")]
            sensitivity.append(
                {
                    "seed": seed,
                    "outpatient_multiplier": factor,
                    **metrics(f.target_requested_units.to_numpy(), predict(model, f)),
                }
            )
    report = {
        "datasetVersion": VERSION,
        "classification": "SIMULATION_ONLY",
        "lineage": lineage,
        "selected_model": selected,
        "model_sha256": digest(model),
        "source_rows": 29220,
        "eligible_rows": len(eligible),
        "partition_counts": {str(k): int(v) for k, v in eligible.partition.value_counts().items()},
        "candidates": candidates,
        "test": grouped(test, predictions),
        "v4_method_on_v5_test": grouped(test, predict(fit("weighted_7", train), test)),
        "confusion_matrix": confusion(test.target_requested_units.to_numpy(), predictions),
        "sensitivity": sensitivity,
        "availability_stress": [
            {
                "stock_multiplier": factor,
                "fraction_forecast_exceeds_scaled_origin_stock": float(
                    (predictions > test.origin_available_close_units.to_numpy() * factor).mean()
                ),
            }
            for factor in (0.5, 1.0, 1.5)
        ],
        "limitations": [
            "All training and evaluation data synthetic; no hospital accuracy established.",
            "Observed sheets never loaded into training; V4 only upstream provenance.",
            "Any-demand matrix is secondary, not count accuracy or clinical classification.",
            "No calibrated prediction intervals. 2026 excluded from reported test metrics.",
            "Sensitivity is perturbation testing, not fully regenerated inventory scenarios.",
            "V4 remains active; V5 research preview is not an application API response.",
        ],
    }
    bundle = runtime_bundle(full, model, lineage, "2026-09-28")
    for name, value in (
        ("evaluation.json", report),
        ("selected_model.json", model),
        ("preview_bundle.json", bundle),
    ):
        (output / name).write_text(
            json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8"
        )
    export = test[
        ["origin_date", "target_date", "blood_type", "component", "target_requested_units"]
    ].copy()
    export["prediction"] = predictions
    export.to_csv(output / "test_predictions.csv", index=False)
    (output / "preview.html").write_text(
        (
            "<!doctype html><meta charset='utf-8'><title>V5 simulation preview</title>"
            "<h1>V5 simulation-only forecast</h1><p>Not live inventory. "
            "No clinical or transfer approval. Origin 2026-09-28; target 2026-09-29. "
            "Uncertainty unavailable.</p>"
        )
        + pd.DataFrame(bundle["forecasts"])[
            ["bloodType", "component", "pointForecast", "syntheticAvailableStock", "stockAsOfDate"]
        ].to_html(index=False, float_format=lambda x: f"{x:.2f}"),
        encoding="utf-8",
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Local-only V5 simulation evaluation; never persists to application DB"
    )
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--protocol", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = run(args.workbook, args.output, args.protocol)
    except ForecastingError as exc:
        raise SystemExit(exc.code) from exc
    print(
        json.dumps({"selected_model": result["selected_model"], "test": result["test"]["overall"]})
    )


if __name__ == "__main__":
    main()
