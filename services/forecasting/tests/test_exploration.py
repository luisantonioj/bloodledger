"""FR-14 / THESIS_EXPLORATION_V1: audit, leakage and frozen evaluation guards."""

import zipfile
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.exploration import features, generate, main, metric
from bloodledger_forecasting.modeling import select_model
from bloodledger_forecasting.research_audit import audit_rows, selected_cells


def cell(day: object, **extra: object) -> dict[str, object]:
    return {"A": day, "F": "O (+)", "G": "PRBC", "H": 2, "I": "/", **extra}


def test_confirmed_date_rules_and_no_deduplication() -> None:
    result = audit_rows(
        [
            (5, cell(datetime(2016, 2, 16))),
            (6, cell(None)),
            (7, cell(datetime(2206, 5, 10))),
            (8, cell(None)),
        ]
    )
    assert result["counts"] == {"accepted": 4}
    assert [r["date"] for r in result["daily"]] == ["2026-02-16", "2026-05-10"]
    assert [r["requested_units"] for r in result["daily"]] == [4, 4]
    assert result["decisions"][1]["anchor_row"] == 5
    assert result["coverage"] == "UNVERIFIED_PARTIAL"


def test_malformed_date_breaks_inheritance_and_free_text_excluded() -> None:
    r = audit_rows(
        [
            (5, cell("01/01/2026")),
            (6, cell("01/08//2026")),
            (7, cell(None)),
            (8, cell("01/09/2026", G="PRIVATE_VALUE")),
            (9, cell(None, H="2 plus annotation")),
            (10, {}),
        ]
    )
    assert r["counts"] == {"accepted": 1, "excluded": 4, "structural_empty": 1}
    assert "PRIVATE_VALUE" not in str(r)
    assert "annotation" not in str(r)
    assert len(r["daily"]) == 1


def test_priority_ambiguity_and_invalid_quantity() -> None:
    r = audit_rows(
        [
            (5, cell("01/01/2026", J="/")),
            (6, cell(None, H=-1)),
            (7, cell(None, H=1.5)),
            (8, cell(None, F="A")),
        ]
    )
    assert r["daily"][0]["unknown_priority_units"] == 2
    assert r["counts"]["excluded"] == 3


def test_xlsx_allowlist_and_entity_rejection(tmp_path: Path) -> None:
    path = tmp_path / "sample.xlsx"
    xml = (
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetData><row r="5"><c r="A5"><v>46023</v></c>'
        '<c r="B5" t="inlineStr"><is><t>EXCLUDED_TEXT</t></is></c>'
        '<c r="H5"><v>2</v></c></row></sheetData></worksheet>'
    )
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/worksheets/sheet1.xml", xml)
    assert selected_cells(path) == [(5, {"A": 46023.0, "H": 2.0})]
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/worksheets/sheet1.xml", '<!DOCTYPE test [<!ENTITY a "b">]><test/>')
    with pytest.raises(ForecastingError):
        selected_cells(path)


@pytest.fixture(scope="module")
def generated() -> pd.DataFrame:
    return generate(11, "ordinary")


def test_generation_replay_and_scope(generated: pd.DataFrame) -> None:
    pd.testing.assert_frame_equal(generated, generate(11, "ordinary"))
    assert len(generated) == 21920
    assert generated.requested_units.ge(0).all()
    assert not generated.equals(generate(29, "ordinary"))
    with pytest.raises(ForecastingError):
        generate(12, "ordinary")


def test_features_are_past_only_and_correct(generated: pd.DataFrame) -> None:
    f = features(generated)
    assert len(f) == 21360
    row = f.iloc[0]
    original = generated[
        (generated.blood_type == row.blood_type) & (generated.component == row.component)
    ].reset_index(drop=True)
    assert row.lag1 == original.iloc[27].requested_units
    assert row.lag7 == original.iloc[21].requested_units
    assert row.lag14 == original.iloc[14].requested_units
    assert row.mean28 == original.iloc[:28].requested_units.mean()
    assert row.weighted7 == np.dot(original.iloc[21:28].requested_units, np.arange(1, 8)) / 28
    changed = generated.copy()
    changed.loc[changed.date >= row.date, "requested_units"] += 100
    pd.testing.assert_frame_equal(
        f.loc[f.date <= row.date].drop(columns="requested_units"),
        features(changed).loc[lambda x: x.date <= row.date].drop(columns="requested_units"),
    )
    with pytest.raises(ForecastingError):
        features(generated.iloc[1:])


def test_metrics_zero_and_selection_guard() -> None:
    assert metric([0, 0], [1, 0]) == {"mae": 0.5, "rmse": np.sqrt(0.5), "wape": None}
    with pytest.raises(ForecastingError):
        metric([], [])

    def m(pooled: float, series: float) -> dict[str, object]:
        return {"pooled": {"mae": pooled}, "series": {"A": {"mae": series}}}

    metrics = {
        "seasonal_naive_7": m(2, 0),
        "weighted_average_7": m(2, 0),
        "random_forest_global": m(1, 0.1),
    }
    assert select_model(metrics)[0] == "weighted_average_7"
    metrics["random_forest_global"] = m(1, 0)
    assert select_model(metrics)[0] == "random_forest_global"


def test_cli_refuses_overwrite_and_requires_source(tmp_path: Path) -> None:
    assert main(["--output", str(tmp_path)]) == 2
    assert main(["--output", str(tmp_path / "new"), "--use-sample-scale"]) == 2
    assert not (tmp_path / "new").exists()


def test_experiment_outputs_only_selected_test_model(
    generated: pd.DataFrame, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from bloodledger_forecasting import exploration

    original = exploration.forest
    monkeypatch.setattr(exploration, "forest", lambda: original().set_params(model__n_estimators=2))
    result = exploration.experiment(generated, tmp_path)
    assert result["rows"] == {"train": 14060, "validation": 3620, "test": 3680}
    assert len(list(tmp_path.glob("test-*.csv"))) == 1
    assert len(list(tmp_path.glob("validation-*.csv"))) == 3
    demo = pd.read_csv(tmp_path / "demo-forecast.csv")
    assert len(demo) == 20
    assert set(demo.classification) == {"SIMULATION_ONLY"}
    assert set(demo.recommendation_eligibility) == {"DISABLED_UNAPPROVED_POLICY"}
    assert result["selected_model"] == select_model(result["validation"])[0]
