"""Minimal read-only XLSX reader for the external synthetic research workbook.

The accepted forecasting environment intentionally has no Excel authoring
dependency. This reader uses only the Python standard library, consumes cached
formula values, and never modifies the source workbook.
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree

import pandas as pd

MAIN_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PACKAGE_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"


@dataclass(frozen=True)
class ParsedSheet:
    """A rectangular worksheet plus formula metadata."""

    name: str
    rows: list[list[object | None]]
    formulas: dict[str, str]

    def as_frame(self) -> pd.DataFrame:
        if not self.rows:
            return pd.DataFrame()
        headers = [str(value).strip() if value is not None else "" for value in self.rows[0]]
        return pd.DataFrame(self.rows[1:], columns=headers)


def _column_index(reference: str) -> int:
    match = re.match(r"[A-Z]+", reference)
    if match is None:
        raise ValueError(f"Invalid XLSX cell reference: {reference}")
    value = 0
    for character in match.group(0):
        value = value * 26 + ord(character) - 64
    return value - 1


class ReadOnlyXlsx:
    """Read cached worksheet values and formulas without executing workbook code."""

    def __init__(self, path: Path) -> None:
        self.path = path
        if not path.is_file():
            raise FileNotFoundError(path)
        self._archive = zipfile.ZipFile(path)
        self._shared_strings = self._load_shared_strings()
        self._date_styles = self._load_date_styles()
        self._sheet_targets = self._load_sheet_targets()

    def __enter__(self) -> ReadOnlyXlsx:
        return self

    def __exit__(self, *_: object) -> None:
        self._archive.close()

    @property
    def sheet_names(self) -> list[str]:
        return list(self._sheet_targets)

    def _load_shared_strings(self) -> list[str]:
        if "xl/sharedStrings.xml" not in self._archive.namelist():
            return []
        root = ElementTree.fromstring(self._archive.read("xl/sharedStrings.xml"))
        return [
            "".join(node.text or "" for node in item.iter(MAIN_NS + "t"))
            for item in root.findall(MAIN_NS + "si")
        ]

    def _load_date_styles(self) -> set[int]:
        if "xl/styles.xml" not in self._archive.namelist():
            return set()
        root = ElementTree.fromstring(self._archive.read("xl/styles.xml"))
        custom_formats = {
            int(item.attrib["numFmtId"]): item.attrib.get("formatCode", "")
            for item in root.findall(".//" + MAIN_NS + "numFmt")
        }
        builtin_date_formats = set(range(14, 23)) | set(range(45, 48))
        result: set[int] = set()
        cell_formats = root.find(MAIN_NS + "cellXfs")
        if cell_formats is None:
            return result
        for index, item in enumerate(cell_formats):
            number_format = int(item.attrib.get("numFmtId", "0"))
            custom = custom_formats.get(number_format, "").lower()
            if number_format in builtin_date_formats or re.search(
                r"(^|[^\\])[ymdhis]", custom
            ):
                result.add(index)
        return result

    def _load_sheet_targets(self) -> dict[str, str]:
        workbook = ElementTree.fromstring(self._archive.read("xl/workbook.xml"))
        relations = ElementTree.fromstring(
            self._archive.read("xl/_rels/workbook.xml.rels")
        )
        relation_targets = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in relations.findall(PACKAGE_NS + "Relationship")
        }
        sheets = workbook.find(MAIN_NS + "sheets")
        if sheets is None:
            return {}
        result: dict[str, str] = {}
        for sheet in sheets:
            target = relation_targets[sheet.attrib[REL_NS + "id"]]
            if target.startswith("/"):
                target = target.lstrip("/")
            elif not target.startswith("xl/"):
                target = "xl/" + target
            result[sheet.attrib["name"]] = target
        return result

    def _cell_value(self, cell: ElementTree.Element) -> object | None:
        cell_type = cell.attrib.get("t")
        value_node = cell.find(MAIN_NS + "v")
        value: object | None = None if value_node is None else value_node.text
        if cell_type == "s" and value is not None:
            return self._shared_strings[int(str(value))]
        if cell_type == "inlineStr":
            return "".join(node.text or "" for node in cell.iter(MAIN_NS + "t"))
        if cell_type == "b" and value is not None:
            return value == "1"
        if value is None:
            return None
        try:
            number = float(str(value))
        except ValueError:
            return value
        style = int(cell.attrib.get("s", "0"))
        if style in self._date_styles:
            return datetime(1899, 12, 30) + timedelta(days=number)
        return int(number) if number.is_integer() else number

    def read_sheet(self, name: str) -> ParsedSheet:
        try:
            target = self._sheet_targets[name]
        except KeyError as error:
            raise ValueError(f"Workbook does not contain required sheet: {name}") from error
        root = ElementTree.fromstring(self._archive.read(target))
        sparse_rows: list[dict[int, object | None]] = []
        formulas: dict[str, str] = {}
        maximum_column = -1
        for row in root.findall(".//" + MAIN_NS + "row"):
            values: dict[int, object | None] = {}
            for cell in row.findall(MAIN_NS + "c"):
                reference = cell.attrib["r"]
                index = _column_index(reference)
                maximum_column = max(maximum_column, index)
                values[index] = self._cell_value(cell)
                formula = cell.find(MAIN_NS + "f")
                if formula is not None and formula.text is not None:
                    formulas[reference] = formula.text
            sparse_rows.append(values)
        rows = [
            [values.get(index) for index in range(maximum_column + 1)]
            for values in sparse_rows
        ]
        return ParsedSheet(name=name, rows=rows, formulas=formulas)
