"""Produce an external fabricated zero-stock XLSX for the CLI preview smoke test."""
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile
import sys

import pandas as pd
from test_v5_experiment import complete_tables


def column(index: int) -> str:
    letters = ""
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def write_fixture(path: Path) -> None:
    tables = complete_tables.__wrapped__()
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    relationships = "http://schemas.openxmlformats.org/package/2006/relationships"
    workbook = '<workbook xmlns="' + ns + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
    rels = '<Relationships xmlns="' + relationships + '">'
    with ZipFile(path, "w", ZIP_DEFLATED) as archive:
        for i, (name, frame) in enumerate(tables.items(), 1):
            workbook += f'<sheet name="{name}" sheetId="{i}" r:id="rId{i}"/>'
            rels += f'<Relationship Id="rId{i}" Target="worksheets/sheet{i}.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>'
            rows = [f'<worksheet xmlns="{ns}"><sheetData>']
            values = [list(frame.columns), *frame.itertuples(index=False, name=None)]
            for j, row in enumerate(values, 1):
                cells = []
                for k, value in enumerate(row, 1):
                    reference = f"{column(k)}{j}"
                    if pd.isna(value):
                        cells.append(f'<c r="{reference}"/>')
                    elif isinstance(value, str):
                        cells.append(f'<c r="{reference}" t="inlineStr"><is><t>{escape(value)}</t></is></c>')
                    else:
                        if isinstance(value, pd.Timestamp):
                            value = (value - pd.Timestamp("1899-12-30")).days
                        cells.append(f'<c r="{reference}"><v>{int(value) if isinstance(value, bool) else value}</v></c>')
                rows.append(f'<row r="{j}">' + "".join(cells) + "</row>")
            rows.append('</sheetData></worksheet>')
            archive.writestr(f"xl/worksheets/sheet{i}.xml", "".join(rows))
        archive.writestr("xl/workbook.xml", workbook + "</sheets></workbook>")
        archive.writestr("xl/_rels/workbook.xml.rels", rels + "</Relationships>")


if __name__ == "__main__":
    write_fixture(Path(sys.argv[1]))
