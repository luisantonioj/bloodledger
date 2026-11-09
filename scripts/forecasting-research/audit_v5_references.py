"""Private aggregate audit of reference sheets; never a forecasting input loader."""

import argparse
import openpyxl
import json
import hashlib
import datetime
import collections

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--workbook", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
p = args.workbook
w = openpyxl.load_workbook(p, read_only=True, data_only=True)
result = {
    "workbook_sha256": hashlib.sha256(open(p, "rb").read()).hexdigest(),
    "cohort": "INPATIENT (user confirmed 2026-11-01)",
    "original_request_file_available": False,
    "sheets": {},
}
for name in [
    "Observed_Inpatient_Frozen",
    "Observed_Inpatient_Revised",
    "V4_Coverage",
    "Observed_Outpatient_Releases",
    "Observed_Stock_Snapshots",
    "V4_Census_Reference",
]:
    s = w[name]
    rows = s.iter_rows(values_only=True)
    head = next(rows)
    data = [dict(zip(head, r)) for r in rows]
    out = {"rows": len(data)}
    if name.startswith("Observed_Inpatient"):
        dates = sorted(
            {
                datetime.date.fromisoformat(str(r["date"])[:10])
                for r in data
                if r["date"]
            }
        )
        start, end = dates[0], dates[-1]
        missing = []
        current = start
        while current <= end:
            if current not in dates:
                missing.append(
                    str(current.date() if hasattr(current, "date") else current)
                )
            current += datetime.timedelta(days=1)
        out.update(
            first_date=str(start),
            last_date=str(end),
            recorded_dates=len(dates),
            unrecorded_dates=len(missing),
            missing_dates=missing,
            total_requested_units=sum(r["requested_units"] or 0 for r in data),
        )
    if name == "V4_Coverage":
        out["coverage_by_scope"] = {}
        for scope in sorted({r["analysis_scope"] for r in data}):
            subset = [r for r in data if r["analysis_scope"] == scope]
            out["coverage_by_scope"][scope] = {
                "states": dict(
                    collections.Counter(r["coverage_state"] for r in subset)
                ),
                "confirmed_zero_values": dict(
                    collections.Counter(str(r["confirmed_zero_demand"]) for r in subset)
                ),
            }
    if name == "Observed_Outpatient_Releases":
        out.update(
            confirmed_dates=sum(r["confirmed_release_date"] is not None for r in data),
            quantity_status=dict(
                collections.Counter(str(r["quantity_status"]) for r in data)
            ),
            care_setting=dict(
                collections.Counter(str(r["care_setting"]) for r in data)
            ),
        )
    if name == "Observed_Stock_Snapshots":
        out.update(
            date_status=dict(collections.Counter(str(r["date_status"]) for r in data)),
            rh_values=dict(collections.Counter(str(r["rh"]) for r in data)),
            availability_status=dict(
                collections.Counter(str(r["availability_status"]) for r in data)
            ),
        )
    result["sheets"][name] = out
with open(args.output, "x", encoding="utf-8") as output:
    output.write(json.dumps(result, indent=2, default=str) + "\n")
print("Private reference audit written; no record values printed.")
