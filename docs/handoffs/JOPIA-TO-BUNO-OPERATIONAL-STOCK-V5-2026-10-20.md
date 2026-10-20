# Jopia → Buno: operational stock scenario V5 (V4 cannot pass OCR)

Status: **Proposed request, SIMULATION_ONLY.** Jopia asks Buno to publish
`SYNTHETIC_OPERATIONAL_STOCK_522_V5`. This note does not accept V5, approve a
target, or authorize population; Jopia reviews Buno's published hashes first.

## Why V4 must be superseded

Jopia accepted V4 ([#98 comment](https://github.com/luisantonioj/bloodledger/pull/98#issuecomment-6282624926)),
sealed the review, validated the backup and ran preview on the defense host.
Preview fixed two runner/API defects (TP-JOP-D20, D21 in
[PR #100](https://github.com/luisantonioj/bloodledger/pull/100)), then stopped
before any write with `SEED_OCR_FIELD_REJECTED:collectedAt` (TP-JOP-D22).

The runner reads every printed field with Tesseract and requires an exact
match at ≥90% confidence. V4's times end in `T22:00:00.000Z`. In all 15 fonts,
`T22` reads as `T722` or scores 73–87, and every V4 unit shares the same
collection string. V3's `15:30Z` and V1's `00:00Z` passed. The 90% gate is a
reviewed safety rule and is not being lowered.

Midnight-UTC strings pass in 6–13 fonts each (tested on the same tools image):
`2026-10-20T00:00:00.000Z`, `2026-10-23T00:00`, `2026-10-23T01:00`, and
`2026-10-25` to `2026-10-29T00:00`, plus Donation No. `MM26-10-2000` to
`MM26-10-2521`.

V4 itself is not edited. It stays as historical, unused evidence; please note
in its PR that it is superseded by V5 and was never populated.

## Requested change

Only the version identity and the frozen window change from V4. Everything
else stays the same: workbook, twenty series, 522 units, 24 reservations,
issuer, destination and all `SYNTHETIC_522_DATES_V3` offsets.

| Constant in `scripts/operational-scenario/scenario.py` | V5 value |
|---|---|
| `VERSION` | `SYNTHETIC_OPERATIONAL_STOCK_522_V5` |
| `DATE_POLICY` | `SYNTHETIC_522_DATES_V5` (same offsets) |
| `BASELINE` | current `main` (`a632ef3` or later) |
| `POPULATION_NOT_BEFORE` | Buno's choice: the next whole half hour after generation, no later than `2026-10-20T10:00:00Z` (Tue 18:00 Manila) |
| `T0` | **`2026-10-21T00:00:00Z` (Wed 08:00 Manila)** |
| `VERIFICATION_END` | `2026-10-21T03:00:00Z` (Wed 11:00 Manila, unchanged) |

Resulting dates: collection Tue Oct 20 08:00 Manila (`T00:00Z`); TRANSFER
expiry Fri Oct 23 08:00 (+48h); LOCAL_RELEASE Fri 09:00 (+49h, `T01:00Z`); PC
Oct 25, WB Oct 26, PRBC Oct 27, FFP Oct 28, CRYO Oct 29, all 08:00 Manila.
Nothing expires during the defense, and T0 falls on its Manila business date.

## What to publish (as early as possible)

1. Generator, tests and README for V5. Run
   `python3 -m unittest discover -s scripts/operational-scenario -v`. Update the
   earliest-expiry test to `2026-10-23T00:00:00Z`.
2. `docs/handoffs/BUNO-OPERATIONAL-STOCK-522-V5-EVIDENCE.md` with the same hash
   table as V4 and the V4 → V5 supersession reason (TP-JOP-D22).
3. Upload the ZIP and `scenario.json` to the same private Drive folder.
4. Message Jopia the moment the PR is up, with the chosen
   `POPULATION_NOT_BEFORE`.

## What is already ready on Jopia's side

The live target was inspected (target `ee1fcef5…`, policy `ad7012c6…`), and
the backup and runner fixes are in place. After V5 arrives, Jopia re-verifies
the hashes and the byte-identical replay, posts ACCEPTED on the V5 PR, then
runs preview → confirm → apply (about 5 h). Verification runs Wed 08:00–11:00
Manila. Everything stays SIMULATION_ONLY with Jopia's self-validation disclosed.
