# Jopia → Buno: operational stock scenario V6 (V5 stock has expired)

Status: **Proposed request, SIMULATION_ONLY.** The owner decided on 2026-11-07 that the panel-revision figures
need fresh, dated synthetic stock. Jopia asks Buno to publish `SYNTHETIC_OPERATIONAL_STOCK_522_V6`. This note
does not accept V6 or authorize population; Jopia reviews Buno's published hashes first, then runs the successor
population on the Jopia host.

## Why V5 must be followed by V6

V5 was populated on 2026-10-21 (559/559 VALID). By 2026-11-07, Mary Mediatrix had 10 label-current units left;
the scheduled expiry evaluator (PA-TC-03) had marked the rest EXPIRED or was doing so. Medix and N.L. Villa hold
no usable stock. Panel evidence for Dean Cherrie #1 (expired units shown separately) and #3 (exact counts per
blood type and component) needs current stock, or every figure shows expired units.

V5 is not edited or removed. The new units are added as a **successor baseline** (supported since TP-JOP-D19);
nothing is reset, and the expired V5 history stays on the ledger.

## Requested change

Same workbook, twenty series, 522 units, 24 reservations, issuer, destination and `SYNTHETIC_522_DATES_V5`
offsets as V5. Only the version identity, label range and frozen window change.

| Constant in `scripts/operational-scenario/scenario.py` | V6 value |
|---|---|
| `VERSION` | `SYNTHETIC_OPERATIONAL_STOCK_522_V6` |
| `DATE_POLICY` | `SYNTHETIC_522_DATES_V6` (same offsets as V5) |
| `BASELINE` | current `codex/panel-revisions-integration` (`b19c6f0` or later), successor of V5 |
| Donation No. range | `MM26-11-2000` to `MM26-11-2521` (no overlap with V5's `MM26-10-…`) |
| Collection time | `2026-11-08T00:00:00Z` (Sun 08:00 Manila). Midnight UTC, which passed the OCR gate for V5 |
| `POPULATION_NOT_BEFORE` | Buno's choice: the next whole half hour after generation, no later than `2026-11-08T10:00:00Z` |
| `T0` | **`2026-11-09T00:00:00Z` (Mon 08:00 Manila)** |
| `VERIFICATION_END` | `2026-11-09T03:00:00Z` (Mon 11:00 Manila) |

With V5's offsets, transfer-reserved units expire Tue Nov 10 08:00 Manila and the last component Sun Nov 15
08:00 Manila. **Panel screenshots and the walkthrough must be captured between Nov 9 and Nov 14.** If Buno
prefers a longer window, longer component offsets are acceptable as a separate, documented date policy; say so in
the PR.

## What to publish

1. Generator, tests and README for V6:
   `python3 -m unittest discover -s scripts/operational-scenario -v`, with the earliest-expiry test updated.
2. `docs/handoffs/BUNO-OPERATIONAL-STOCK-522-V6-EVIDENCE.md`, with the same hash table as V5 and the V5 → V6
   reason (expiry over time, not a defect).
3. The ZIP and `scenario.json` uploaded to the same private Drive folder.
4. A PR into `codex/panel-revisions-integration`, plus a message to Jopia with the chosen `POPULATION_NOT_BEFORE`.

## Jopia's side

- **Host:** runs integration `b19c6f0`, all 43 migrations applied, worker running, peer healthy, local-mode API
  at `http://127.0.0.1:3000`.
- **Before population:** a fresh private backup, the successor-baseline review of Buno's hashes, and an OCR preview.
- **Population:** writes about 559 transactions to the ledger, then the same exact reconciliation as V5.

Afterwards Lat and Jopia capture Dean Cherrie #1/#3, Franze Q2/Q3 and item d figures within the expiry window.
