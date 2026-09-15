"""Local-only, allowlisted request-workbook audit; no source free text is emitted."""

from __future__ import annotations

import re
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

from .errors import ForecastingError
from .validation import sha256_file

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
TYPES = ("O+", "A+", "B+", "AB+")
COMPONENTS = ("PRBC", "PC", "FFP", "CRYO", "WB")
PRODUCTS = (*COMPONENTS, "APC", "IRRADIATED PRBC", "PRBC ALIQ")


def selected_cells(path: Path) -> list[tuple[int, dict[str, Any]]]:
    """Read only designated cells from sheet1 with bounded XML input."""
    try:
        with zipfile.ZipFile(path) as archive:
            if sum(i.file_size for i in archive.infolist()) > 50_000_000:
                raise ValueError("size")

            def xml(name: str) -> ET.Element:
                raw = archive.read(name)
                if b"<!DOCTYPE" in raw or b"<!ENTITY" in raw:
                    raise ValueError("entities")
                return ET.fromstring(raw)  # noqa: S314 - bounded input, DTD/entities rejected

            strings = []
            if "xl/sharedStrings.xml" in archive.namelist():
                strings = [
                    "".join(t.text or "" for t in si.findall(".//m:t", NS))
                    for si in xml("xl/sharedStrings.xml").findall("m:si", NS)
                ]
            result = []
            for row in xml("xl/worksheets/sheet1.xml").findall(".//m:row", NS):
                number = int(row.attrib["r"])
                if number < 5:
                    continue
                cells: dict[str, Any] = {}
                for cell in row.findall("m:c", NS):
                    column = re.sub(r"\d", "", cell.attrib["r"])
                    if column not in ("A", "F", "G", "H", "I", "J"):
                        continue
                    value = cell.find("m:v", NS)
                    if cell.find("m:f", NS) is not None:
                        cells[column] = "UNSUPPORTED_FORMULA"
                    elif cell.attrib.get("t") == "s" and value is not None:
                        cells[column] = strings[int(value.text or "-1")]
                    elif cell.attrib.get("t") == "inlineStr":
                        cells[column] = "".join(t.text or "" for t in cell.findall(".//m:t", NS))
                    elif value is not None:
                        cells[column] = float(value.text or "nan")
                result.append((number, cells))
            return result
    except (OSError, zipfile.BadZipFile, KeyError, ValueError, IndexError, ET.ParseError) as exc:
        raise ForecastingError("WORKBOOK_INVALID", "Workbook structure is unsupported") from exc


def audit_rows(rows: list[tuple[int, dict[str, Any]]]) -> dict[str, Any]:
    """Reconcile every source row without copying unrestricted cell contents."""
    last: date | None = None
    anchor: int | None = None
    daily: dict[tuple[str, str, str], list[int]] = defaultdict(lambda: [0, 0, 0, 0, 0])
    decisions = []
    counts: Counter[str] = Counter()
    for number, cells in rows:
        if all(v is None or str(v).strip() == "" for v in cells.values()):
            counts["structural_empty"] += 1
            continue
        raw = cells.get("A")
        dt: date | None = None
        correction = []
        if raw is None or str(raw).strip() == "":
            dt = last
            if dt:
                correction.append("DATE_INHERITED")
        else:
            try:
                if isinstance(raw, (int, float)):
                    dt = (datetime(1899, 12, 30) + timedelta(days=raw)).date()
                elif isinstance(raw, datetime):
                    dt = raw.date()
                elif isinstance(raw, date):
                    dt = raw
                elif re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", str(raw).strip()):
                    dt = datetime.strptime(str(raw).strip(), "%m/%d/%Y").date()
                if dt and dt.year != 2026:
                    dt = dt.replace(year=2026)
                    correction.append("YEAR_CORRECTED_2026")
            except (ValueError, OverflowError):
                dt = None
            last, anchor = dt, number if dt else None
        reasons = []
        if "UNSUPPORTED_FORMULA" in cells.values():
            reasons.append("FORMULA_REQUIRES_REVIEW")
        if dt is None or not date(2026, 1, 1) <= dt <= date(2026, 9, 13):
            reasons.append("DATE_UNRESOLVED")
        blood = re.sub(r"[\s()]", "", str(cells.get("F", ""))).upper()
        if not re.fullmatch(r"(?:A|B|AB|O)[+-]", blood):
            reasons.append("TYPE_UNRESOLVED")
        component = str(cells.get("G", "")).strip().upper()
        if component not in PRODUCTS:
            reasons.append("COMPONENT_UNRESOLVED")
        quantity = cells.get("H")
        if (
            not isinstance(quantity, (int, float))
            or isinstance(quantity, bool)
            or not 0 < quantity <= 10000
            or int(quantity) != quantity
        ):
            reasons.append("QUANTITY_UNRESOLVED")
        status = "excluded" if reasons else "accepted"
        counts[status] += 1
        decisions.append(
            {
                "row": number,
                "status": status,
                "reasons": reasons,
                "corrections": correction,
                "anchor_row": anchor,
                "date": dt.isoformat() if dt else None,
            }
        )
        if not reasons and dt is not None and isinstance(quantity, (int, float)):
            value = daily[(dt.isoformat(), blood, component)]
            n = int(quantity)
            routine = str(cells.get("I", "")).strip() in ("/", "\\", "I")
            stat = str(cells.get("J", "")).strip() in ("/", "\\", "I")
            value[0] += n
            value[1] += 1
            value[2 if routine and not stat else 3 if stat and not routine else 4] += n
    records = [
        dict(
            zip(
                (
                    "date",
                    "blood_type",
                    "component",
                    "requested_units",
                    "record_count",
                    "routine_units",
                    "stat_units",
                    "unknown_priority_units",
                ),
                (*k, *v),
                strict=True,
            )
        )
        for k, v in sorted(daily.items())
    ]
    return {
        "classification": "OBSERVED_SAMPLE_AGGREGATE",
        "coverage": "UNVERIFIED_PARTIAL",
        "real_accuracy": "UNAVAILABLE_UNKNOWN_COVERAGE",
        "counts": dict(counts),
        "daily": records,
        "decisions": decisions,
    }


def audit_workbook(path: Path) -> dict[str, Any]:
    result = audit_rows(selected_cells(path))
    result["source_sha256"] = sha256_file(path)
    return result
