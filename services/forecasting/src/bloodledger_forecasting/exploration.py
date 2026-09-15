"""Reproducible offline thesis experiment, isolated from the accepted runtime."""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
from html import escape
from importlib.metadata import version
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from .errors import ForecastingError
from .modeling import hash_source_tree, select_model, write_model_artifact
from .research_audit import COMPONENTS, TYPES, audit_workbook
from .validation import sha256_file

PROTOCOL = "THESIS_EXPLORATION_V1"
SEEDS = (11, 29, 47, 83, 101)
SCENARIOS = {"ordinary": 1.0, "sparse": 0.5, "shift": 1.5}
FEATURES = [
    "blood_type",
    "component",
    "weekday",
    "month",
    "lag1",
    "lag7",
    "lag14",
    "weighted7",
    "mean28",
]
NUMERIC = FEATURES[2:]
NEUTRAL_RATES = {"PRBC": 2.0, "PC": 0.8, "FFP": 0.4, "CRYO": 0.1, "WB": 0.05}


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8"
    )


def chart(values: list[float], title: str, path: Path) -> None:
    """Small deterministic SVG overview; figure never contains source free text."""
    maximum = max(values, default=0) or 1
    points = " ".join(
        f"{60 + i * 680 / max(1, len(values) - 1):.2f},{250 - v / maximum * 180:.2f}"
        for i, v in enumerate(values)
    )
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="0 0 800 320">'
        '<rect width="800" height="320" fill="white"/>'
        f'<text x="60" y="30" font-size="17">{escape(title)}</text>'
        '<path d="M60 65V250H750" stroke="#222" fill="none"/>'
        f'<polyline points="{points}" stroke="#147d92" stroke-width="2" fill="none"/>'
        f'<text x="5" y="72">{maximum:.0f}</text><text x="30" y="250">0</text>'
        '<text x="60" y="285">Chronological order; y = recorded/generated requested units</text>'
        "</svg>",
        encoding="utf-8",
    )


def generate(seed: int, scenario: str, rates: dict[str, float] | None = None) -> pd.DataFrame:
    """Invented calendar scenario; no measurements of hospital demand implied."""
    if seed not in SEEDS or scenario not in SCENARIOS:
        raise ForecastingError("PROTOCOL_INVALID", "Seed/scenario is not in the frozen protocol")
    if rates is not None and (
        set(rates) != {f"{b}|{c}" for b in TYPES for c in COMPONENTS}
        or any(not np.isfinite(v) or v < 0 for v in rates.values())
    ):
        raise ForecastingError("RATES_INVALID", "Expected finite nonnegative rates for 20 series")
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2023-01-01", "2025-12-31")
    rows = []
    for b in TYPES:
        for c in COMPONENTS:
            rate = rates[f"{b}|{c}"] if rates is not None else NEUTRAL_RATES[c]
            for index, day in enumerate(dates):
                scale = SCENARIOS[scenario]
                if scenario == "shift" and day >= pd.Timestamp("2025-07-01"):
                    scale *= 1.5
                mean = rate * scale * (0.85 if day.weekday() >= 5 else 1.06)
                mean *= 1 + 0.12 * np.sin(2 * np.pi * index / 365.25)
                mean *= rng.gamma(4, 0.25) * (2.5 if rng.random() < 0.025 else 1)
                rows.append((day, b, c, int(rng.poisson(mean)), "SYNTHETIC"))
    return pd.DataFrame(
        rows, columns=["date", "blood_type", "component", "requested_units", "classification"]
    )


def features(data: pd.DataFrame) -> pd.DataFrame:
    """Derive features only after checking full daily continuity for each series."""
    required = {"date", "blood_type", "component", "requested_units", "classification"}
    if set(data.columns) != required or data.empty:
        raise ForecastingError("DATA_INVALID", "Unexpected experiment schema")
    f = data.sort_values(["blood_type", "component", "date"]).copy()
    values = f.requested_units.to_numpy(dtype=float)
    if (
        (f.classification != "SYNTHETIC").any()
        or not np.isfinite(values).all()
        or ((values < 0) | (values != np.floor(values))).any()
        or f.duplicated(["date", "blood_type", "component"]).any()
    ):
        raise ForecastingError("DATA_INVALID", "Invalid simulation counts or classification")
    if set(zip(f.blood_type, f.component, strict=True)) != {
        (b, c) for b in TYPES for c in COMPONENTS
    }:
        raise ForecastingError("DATA_INVALID", "Missing or unexpected series")
    for _, g in f.groupby(["blood_type", "component"]):
        if list(g.date) != list(pd.date_range("2023-01-01", "2025-12-31")):
            raise ForecastingError("DATA_INVALID", "Incomplete daily scenario")
    grouped = f.groupby(["blood_type", "component"]).requested_units
    for lag in (1, 7, 14):
        f[f"lag{lag}"] = grouped.shift(lag)
    f["weighted7"] = grouped.transform(
        lambda s: s.shift(1).rolling(7).apply(lambda a: np.dot(a, np.arange(1, 8)) / 28, raw=True)
    )
    f["mean28"] = grouped.transform(lambda s: s.shift(1).rolling(28).mean())
    f["weekday"] = f.date.dt.weekday
    f["month"] = f.date.dt.month
    return f.dropna(subset=NUMERIC)


def metric(actual: Any, predicted: Any) -> dict[str, float | None]:
    a, p = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    if a.shape != p.shape or a.size == 0 or not np.isfinite(a).all() or not np.isfinite(p).all():
        raise ForecastingError("METRIC_INVALID", "Expected nonempty aligned finite arrays")
    e = a - p
    denominator = float(np.abs(a).sum())
    return {
        "mae": float(np.abs(e).mean()),
        "rmse": float(np.sqrt(np.square(e).mean())),
        "wape": float(np.abs(e).sum() / denominator * 100) if denominator else None,
    }


def summarize(frame: pd.DataFrame, prediction: Any) -> dict[str, Any]:
    scored = frame.assign(prediction=np.asarray(prediction))
    return {
        "pooled": metric(scored.requested_units, scored.prediction),
        "series": {
            f"{b}|{c}": metric(g.requested_units, g.prediction)
            for (b, c), g in scored.groupby(["blood_type", "component"])
        },
    }


def forest() -> Pipeline:
    return Pipeline(
        [
            (
                "columns",
                ColumnTransformer(
                    [
                        (
                            "categories",
                            OneHotEncoder(handle_unknown="error", sparse_output=False),
                            FEATURES[:2],
                        ),
                        ("numeric", "passthrough", NUMERIC),
                    ]
                ),
            ),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=300, max_depth=5, min_samples_leaf=3, random_state=42, n_jobs=1
                ),
            ),
        ]
    )


def experiment(data: pd.DataFrame, output: Path) -> dict[str, Any]:
    """Freeze selection on validation before computing held-out selected-model scores."""
    f = features(data)
    train = f.loc[f.date < "2025-01-01"]
    val = f.loc[(f.date >= "2025-01-01") & (f.date < "2025-07-01")]
    test = f.loc[f.date >= "2025-07-01"]
    model = forest().fit(train[FEATURES], train.requested_units)
    predictions = {
        "seasonal_naive_7": val.lag7.to_numpy(),
        "weighted_average_7": val.weighted7.to_numpy(),
        "random_forest_global": model.predict(val[FEATURES]),
    }
    metrics = {name: summarize(val, p) for name, p in predictions.items()}
    selected, selection = select_model(metrics)
    # Keep the trained model fixed: no test-dependent fitting or tuning.
    test_p = (
        model.predict(test[FEATURES])
        if selected == "random_forest_global"
        else test.lag7.to_numpy()
        if selected == "seasonal_naive_7"
        else test.weighted7.to_numpy()
    )
    result = {
        "selected_model": selected,
        "selection": selection,
        "validation": metrics,
        "test_selected": summarize(test, test_p),
        "classification": "SIMULATION_ONLY",
        "recommendation_eligibility": "DISABLED_UNAPPROVED_POLICY",
        "rows": {"train": len(train), "validation": len(val), "test": len(test)},
        "uncertainty": "NOT_CALIBRATED; seed variability is not a prediction interval",
    }
    chart(
        data.groupby("date").requested_units.sum().tolist(),
        "SYNTHETIC daily total | 2023-01-01 to 2025-12-31",
        output / "demand.svg",
    )
    data.to_csv(output / "synthetic.csv", index=False, date_format="%Y-%m-%d")
    for name, p in predictions.items():
        val[["date", "blood_type", "component", "requested_units"]].assign(prediction=p).to_csv(
            output / f"validation-{name}.csv", index=False
        )
    test[["date", "blood_type", "component", "requested_units"]].assign(prediction=test_p).to_csv(
        output / "test-selected.csv", index=False
    )
    artifact = {
        "artifact_format": PROTOCOL,
        "selected_model": selected,
        "fitted_model": model if selected == "random_forest_global" else None,
        "features": FEATURES,
        "classification": "SIMULATION_ONLY",
    }
    result["artifact_sha256"] = write_model_artifact(artifact, output / "model.pkl")
    result["dataset_sha256"] = sha256_file(output / "synthetic.csv")
    # Demonstration at a known scored cutoff, not an operational future forecast.
    demo = test.loc[test.date == test.date.max(), ["date", "blood_type", "component"]].copy()
    demo["predicted_requested_units"] = np.asarray(test_p)[
        (test.date == test.date.max()).to_numpy()
    ]
    demo["generation_time"] = demo.date.dt.strftime("%Y-%m-%dT00:00:00+08:00")
    demo["horizon_days"] = 1
    demo["model_version"] = PROTOCOL
    demo["classification"] = "SIMULATION_ONLY"
    demo["recommendation_eligibility"] = "DISABLED_UNAPPROVED_POLICY"
    demo["uncertainty"] = "UNAVAILABLE"
    demo.to_csv(output / "demo-forecast.csv", index=False)
    write_json(output / "result.json", result)
    return result


def describe(audit: dict[str, Any], output: Path) -> dict[str, float]:
    df = pd.DataFrame(audit["daily"])
    if df.empty:
        raise ForecastingError("NO_ACCEPTED_ROWS", "No valid request aggregates")
    df.to_csv(output / "observed-daily.csv", index=False)
    rates = {}
    for b in TYPES:
        for c in COMPONENTS:
            n = df.loc[
                (df.blood_type == b) & (df.component == c) & (df.date <= "2026-06-30"),
                "requested_units",
            ].sum()
            rates[f"{b}|{c}"] = float(n) / 181
    df["month"] = df.date.str[:7]
    for name in ("month", "blood_type", "component"):
        df.groupby(name)["requested_units"].sum().to_csv(output / f"observed-by-{name}.csv")
    chart(
        df.groupby("month").requested_units.sum().tolist(),
        "OBSERVED partial monthly requests | Jan-Sep 2026",
        output / "observed-monthly.svg",
    )
    dates = pd.to_datetime(df.date).drop_duplicates().sort_values()
    coverage = {
        "first": str(dates.min().date()),
        "last": str(dates.max().date()),
        "distinct_dates": len(dates),
        "aggregate_rows": len(df),
        "recorded_units": int(df.requested_units.sum()),
        "missing_dates_unknown": [
            str(d.date())
            for d in pd.date_range(dates.min(), dates.max()).difference(pd.DatetimeIndex(dates))
        ],
        "real_accuracy": "UNAVAILABLE_UNKNOWN_COVERAGE",
        "rates_note": "Partial Jan-Jun totals / 181; scenario scale, not true demand rate",
    }
    write_json(output / "coverage.json", coverage)
    write_json(output / "rates.json", rates)
    return rates


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--workbook", type=Path)
    parser.add_argument("--use-sample-scale", action="store_true")
    parser.add_argument("--audit-only", action="store_true")
    args = parser.parse_args(argv)
    try:
        if (args.use_sample_scale or args.audit_only) and not args.workbook:
            raise ForecastingError("SOURCE_REQUIRED", "This mode requires a workbook")
        output = args.output.resolve()
        repository = next(
            (p for p in Path(__file__).resolve().parents if (p / ".git").exists()),
            Path(__file__).resolve().parents[2],
        )
        if output.is_relative_to(repository) and not output.is_relative_to(
            repository / "services/forecasting/artifacts"
        ):
            raise ForecastingError("OUTPUT_UNSAFE", "Use external or ignored artifacts output")
        if output.exists():
            raise ForecastingError("OUTPUT_EXISTS", "Choose a new output directory; no overwrite")
        audit = audit_workbook(args.workbook) if args.workbook else None
        output.mkdir(parents=True)
        rates = None
        if audit is not None:
            write_json(output / "source-audit.json", audit)
            sample_rates = describe(audit, output)
            if args.use_sample_scale:
                rates = sample_rates
        config = {
            "protocol": PROTOCOL,
            "seeds": SEEDS,
            "scenarios": SCENARIOS,
            "features": FEATURES,
            "forest": {"trees": 300, "depth": 5, "leaf": 3, "seed": 42, "jobs": 1},
            "split": {
                "train_end": "2024-12-31",
                "validation_end": "2025-06-30",
                "test_end": "2025-12-31",
            },
            "rates": rates if rates is not None else NEUTRAL_RATES,
            "scale": "PARTIAL_SAMPLE" if rates else "NEUTRAL",
            "source_sha256": audit.get("source_sha256") if audit else None,
            "optional_14day": "NOT_SELECTED",
            "real_evaluation": "UNAVAILABLE_UNKNOWN_COVERAGE",
            "python": platform.python_version(),
            "packages": {p: version(p) for p in ("numpy", "pandas", "scikit-learn")},
            "code_sha256": hash_source_tree(Path(__file__).parent),
        }
        write_json(output / "protocol.json", config)
        results = []
        if not args.audit_only:
            for scenario in SCENARIOS:
                for seed in SEEDS:
                    folder = output / f"{scenario}-{seed}"
                    folder.mkdir()
                    result = experiment(generate(seed, scenario, rates), folder)
                    results.append({"scenario": scenario, "seed": seed, **result})
        write_json(output / "results.json", results)
        lines = [
            "# BloodLedger thesis experiment",
            "",
            "Classification: SIMULATION_ONLY.",
            "Real sample: descriptive only; coverage unverified. No new data required.",
            "14-day extension not selected. Runtime and operational gates unchanged.",
            "",
            "| Scenario | Seed | Selected | Test MAE | Test RMSE |",
            "|---|---:|---|---:|---:|",
        ]
        for r in results:
            m = r["test_selected"]["pooled"]
            lines.append(
                f"| {r['scenario']} | {r['seed']} | {r['selected_model']} | "
                f"{m['mae']:.4f} | {m['rmse']:.4f} |"
            )
        lines += [
            "",
            "Rates, weekly patterns, shocks and shifts are scenario assumptions.",
            "Synthetic dates do not establish real historical coverage.",
            "Test inputs use past simulated demand: rolling next-day evaluation.",
            "No calibrated intervals, clinical validation or real wastage reduction established.",
        ]
        (output / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        manifest = {
            p.relative_to(output).as_posix(): sha256_file(p)
            for p in sorted(output.rglob("*"))
            if p.is_file()
        }
        write_json(output / "artifact-manifest.json", manifest)
        print(
            json.dumps(
                {
                    "status": "COMPLETE",
                    "runs": len(results),
                    "protocol": PROTOCOL,
                    "manifest_sha256": hashlib.sha256(
                        json.dumps(manifest, sort_keys=True).encode()
                    ).hexdigest(),
                }
            )
        )
        return 0
    except ForecastingError as exc:
        print(json.dumps({"status": "FAILED", "code": exc.code}), file=sys.stderr)
        return 2
    except (OSError, ValueError, TypeError):
        print(json.dumps({"status": "FAILED", "code": "EXPLORATION_FAILED"}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
