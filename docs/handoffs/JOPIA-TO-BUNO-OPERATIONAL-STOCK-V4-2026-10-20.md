# Jopia → Buno: operational stock scenario V4 for the defense host

Status: **Proposed request, SIMULATION_ONLY.** Jopia asks Buno to publish
`SYNTHETIC_OPERATIONAL_STOCK_522_V4`. This note does not accept V4, approve a
target, or authorize population; Jopia reviews Buno's published hashes first.

## Why

The defense on **Wed 2026-10-21 at about 13:00 Manila** runs on Jopia's laptop.
All V1 stock there is past its label expiry: the evaluator moved 492 units to
`EXPIRED`, and only 7 recent demo intakes are AVAILABLE. Units are never
re-dated, so fresh stock needs a new scenario version, as with V2 → V3.
V3 is unchanged and stays historical evidence for Lat's host.

The runner now accepts a successor baseline on this host (TP-JOP-D19,
[PR #97](https://github.com/luisantonioj/bloodledger/pull/97)). Generate V4 on a
branch from `main` that includes #97.

## Requested change

Only the version identity and the frozen window change. Keep the source
workbook, twenty-series distribution, 522 units, 24 reservations (18 TRANSFER
/ 18 LOCAL_RELEASE members), issuer/custodian `INST_MEDIATRIX`, destination
`INST_SYNTH_MEDIX`, and every relative date offset from
`SYNTHETIC_522_DATES_V3`.

| Constant in `scripts/operational-scenario/scenario.py` | V4 value |
|---|---|
| `VERSION` | `SYNTHETIC_OPERATIONAL_STOCK_522_V4` |
| `DATE_POLICY` | `SYNTHETIC_522_DATES_V4` (same offsets as V3) |
| `BASELINE` | the `main` commit that contains PR #97 |
| `POPULATION_NOT_BEFORE` | `2026-10-20T06:00:00Z` (Tue 14:00 Manila) |
| `T0` | `2026-10-20T22:00:00Z` (Wed 06:00 Manila) |
| `VERIFICATION_END` | `2026-10-21T03:00:00Z` (Wed 11:00 Manila) |

`generatedAt` must be earlier than `POPULATION_NOT_BEFORE`. With these
offsets, units are collected Tue 06:00 Manila, reserved units expire Fri
2026-10-23, and available units expire 2026-10-26 to 2026-10-29 Manila. Nothing
expires during the defense. T0 falls on the defense's Manila business date, so
the verify-time census reads `CURRENT` (TP-JOP-D18 rule).

## What to publish (PR, by Tue 2026-10-20 13:00 Manila)

1. Generator and README updates for V4. Run
   `python3 -m unittest discover -s scripts/operational-scenario -v`.
2. `docs/handoffs/BUNO-OPERATIONAL-STOCK-522-V4-EVIDENCE.md`, following the V3
   evidence: generator commit, `scenario.py`/`verify.py` SHA-256, scenario
   file and canonical SHA-256, ZIP SHA-256, source workbook and counts hashes
   (unchanged), window, and the V3 → V4 supersession reason.
3. Send the ZIP and `scenario.json` privately to Jopia. Never commit the
   workbook, manifest or ZIP.

Jopia then reviews the hashes and window, inspects the live target, posts
`ACCEPTED` on Buno's PR, and seals the review JSON from that link.

## Execution after acceptance (Jopia, for reference)

| Manila time | Step |
|---|---|
| Tue ≤ 14:00 | Stop the worker and expiry evaluator; recover the peer; `stock inspect`; backup + `validate-stock-backup.sh`; `labelSequenceStart=2000` (V1 used `MM26-10-1000…1521`) |
| Tue 14:00 | `stock preview` → review → `confirm` → `apply` (about 5 h with 35 s pacing); `resume` if stopped |
| Tue 18:00 | Cutoff: if apply is not running, stop and use the small OCR demo set instead |
| Wed 06:00–11:00 | `stock verify` at T0, stop/start re-verify, V5 forecast on the CURRENT census, start the worker, UI smoke check |

## If the window is missed

Do not edit V4 dates. Publish a new version or fall back to a few fresh units
registered live through OCR. Everything remains SIMULATION_ONLY with no
clinical, accuracy or production claim; Jopia's self-validation on this host
is disclosed.
