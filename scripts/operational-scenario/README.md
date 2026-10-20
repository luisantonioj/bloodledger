# Synthetic operational scenario 522 V4 — defense-host proposal

Status: **Proposed, SIMULATION_ONLY; no acceptance, target approval or population authorization.**
V4 replaces expired V1 stock only through a new reviewed population on Jopia's host.
V3 stays immutable historical evidence for Lat's host. Replay old versions at their
recorded revisions, not with the V4 verifier.

Baseline: main `a632ef329a16556cccd38238daa4c0bdaab7bb74`, containing PR97/TP-JOP-D19.
Source workbook, twenty-series count distribution and every relative date offset
are unchanged from [V3 evidence](../../docs/handoffs/BUNO-OPERATIONAL-STOCK-522-V3-EVIDENCE.md).
522 singleton donations/units: 486 AVAILABLE, 36 RESERVED in 24 reservations
(18 TRANSFER members and 18 LOCAL_RELEASE members). Issuer/custodian INST_MEDIATRIX;
transfer destination INST_SYNTH_MEDIX. Source alias SIM_INSTITUTION_01 is a fixture
mapping only. Historical stock is separate; negative Rh source coverage stays unknown.

## Frozen V4 dates

- Population not before: **2026-10-20T01:30:00Z** (Tue 09:30 Manila), the next
  whole half hour after generation. generatedAt must be strictly earlier.
- T0 / population end exclusive: **2026-10-20T22:00:00Z** (Wed 06:00 Manila).
- Verification end exclusive: **2026-10-21T03:00:00Z** (Wed 11:00 Manila).
- Jopia's apply-start cutoff: Tue 18:00 Manila. If missed, stop and use the reviewed
  fallback or a new scenario version; never renew V4 dates.

SYNTHETIC_522_DATES_V4 keeps V3 offsets: collection T0−24h; reserved TRANSFER
expiry +48h, LOCAL_RELEASE +49h; available WB +120h, PRBC +144h, FFP +168h,
PC +96h, CRYO +192h. These are technical fixtures, not clinical shelf lives.
All units remain unexpired during the defense. No existing units are re-dated.

## Generate and verify (Python standard library)

```bash
python3 -m unittest discover -s scripts/operational-scenario -v
python3 scripts/operational-scenario/scenario.py --workbook "$WORKBOOK" --revision "$GENERATOR_COMMIT" --generated-at "$GENERATED_AT" --output "$OUT/scenario.json"
python3 scripts/operational-scenario/verify.py --workbook "$WORKBOOK" --manifest "$OUT/scenario.json" --sha256 "$REVIEWED_FILE_SHA"
```

Keep workbook/JSON/ZIP private, outside Git. No-overwrite and pinned source checks
apply. Canonical SHA uses sorted keys, ASCII escaping, compact separators, no newline;
file SHA includes the newline. Use the published generator revision for replay.

Jopia must review published hashes/window, inspect the live target and post ACCEPTED
before sealing the review and executing backup/preview/confirmation/apply. Preserve
accounts, credentials, identities, volumes, prior units, historical records and frontend
work. Live global FEFO may block membership; never bypass it or change old stock.
Verify API/Fabric/workflow/census and restart independently. Report real combined counts
from the live target, not V3's historical nine-unit assumptions. Buno does not populate.
V4 forecasting stays default; V5 approval remains separate. No model changes.
