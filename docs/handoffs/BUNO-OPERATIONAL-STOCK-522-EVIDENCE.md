# Buno — operational stock scenario evidence (2026-10-08)

**Prepared and technically validated; proposed for Jopia review, not population
authorization. SIMULATION_ONLY.** Responds to PR26 at
`a37d9c032c684563b9a399a1a8cb46f183ed98b8`; coordinates PR27 at
`8b432c086970138f4a7612d65f02ced839265615`. Both remain open.
No approval, merge, activation or target mutation was performed.

## Exact lineage

- Branch: `codex/buno-operational-stock-scenario-v1`.
- Baseline: `954f170b840fce1a346bb3bd393748a731be1913` (retained institution integration).
- Generator/verifier/tests commit: `7e29fd98f7dcd7d7f137c7a9721827b05b66aa74`.
- Scenario: `SYNTHETIC_OPERATIONAL_STOCK_522_V1`; schema `OPERATIONAL_SCENARIO_V1`.
- Generator file SHA-256: `1cdf0f63c493c2809da7691fa72b25186490cc17944efddaa2610f70b261b7c1`.
- Private `scenario.json` file SHA-256: `4ad33820481b1e331e71ac03bbf37ed719096a3fc33c6321829a73d7e3b5fe70`.
- Canonical scenario SHA-256: `311395e58126cc7af9e72ad8ecc5cf7708e868531eadb0c1924743901e8f8fc8`.
- Source XLSX SHA-256: `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`.
- Ordered source-count digest: `fcf62756d3e0b449e7a294b51e8108106f20e5735746c193b4dce0529e7a9daf`.
- Fixed generation batch timestamp: `2026-10-08T06:46:27Z`, distinct from T0.
- Frozen model file SHA-256 verified unchanged:
  `1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`.
- Frozen model canonical SHA-256 verified unchanged:
  `ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86`.

No workbook/model file was modified. No historical snapshot mutation command
was run. Historical manifest hash
`7b8c831d37667b1459c2b16707c5bf37cf72fe6cc12b2f24bf17a6ab2449af04`
is a handoff reference, **not fresh live-ledger verification on this host**.

## Distribution

Twenty source rows, 522 new units, 522 singleton donation groups, 24 linked
reservation scenarios: 18 TRANSFER and 18 LOCAL_RELEASE units. No donor
identities or Donation No. material. All dates, groups and purposes are new
technical assumptions; the source contributes counts only.

| Blood | Component | AVAILABLE | RESERVED | Total |
|---|---|---:|---:|---:|
| A+ | WB | 4 | 0 | 4 |
| A+ | PRBC | 37 | 1 | 38 |
| A+ | FFP | 56 | 3 | 59 |
| A+ | PC | 11 | 1 | 12 |
| A+ | CRYO | 21 | 1 | 22 |
| B+ | WB | 5 | 0 | 5 |
| B+ | PRBC | 38 | 6 | 44 |
| B+ | FFP | 58 | 4 | 62 |
| B+ | PC | 25 | 2 | 27 |
| B+ | CRYO | 19 | 2 | 21 |
| O+ | WB | 7 | 0 | 7 |
| O+ | PRBC | 16 | 1 | 17 |
| O+ | FFP | 58 | 5 | 63 |
| O+ | PC | 16 | 2 | 18 |
| O+ | CRYO | 22 | 2 | 24 |
| AB+ | WB | 8 | 0 | 8 |
| AB+ | PRBC | 26 | 2 | 28 |
| AB+ | FFP | 36 | 4 | 40 |
| AB+ | PC | 0 | 0 | 0 |
| AB+ | CRYO | 23 | 0 | 23 |
| **Total** | | **486** | **36** | **522** |

AB+ PC's zero row is retained. Twenty negative-Rh combinations remain unknown,
not provided, not fabricated zero source stock.

## Proposed contract and blockers for PR27

The complete record contract and population sequence are in
[scenario README](../../scripts/operational-scenario/README.md).

- Proposed scenario-only binding `SIM_INSTITUTION_01 -> INST_MEDIATRIX`;
  separately specified issuer/custodian both `INST_MEDIATRIX`. Transfer
  destination `INST_SYNTH_MEDIX`; local-release destination null. No forecast
  binding, source ownership claim, or alias binding to Medix/NLVilla is implied.
- Proposed T0: **Oct9 08:00 Manila** (`2026-10-09T00:00:00Z`). Population starts
  no earlier than Oct8 16:00 Manila and finishes before T0; verify until Oct9
  16:00 Manila, exclusive. Jopia must review this window. A missed window needs
  a new scenario version, dates, hashes and review, never silent renewal.
- Collection T0−24h; reserved transfer expiry T0+48h; local release T0+49h;
  AVAILABLE WB/PRBC/FFP/PC/CRYO expiry T0+120/144/168/96/192h. These are explicit
  **nonclinical technical offsets**, not recommended shelf lives.
- Jopia must review binding/date policy/window/target, establish ADR-035-compliant
  population or an explicitly reviewed alternative, resolve primary-account
  operator tooling, and perform collision/idempotency and target checks.
- Register via accepted intake. Reserve TRANSFER before LOCAL_RELEASE per
  series, using actual global FEFO and backend-ID tie ordering. If old stock
  displaces intended members, stop for reviewed replanning/isolation; do not
  skip old stock, change its dates or weaken global rules. Link actual requests
  and reservations; keep ACTIVE at T0, with no dispatch/completion.
- Preserve original accounts/requests/commands, nine operational units, and
  separate historical snapshot. Conditional combined result is 531:
  492 AVAILABLE,37 RESERVED,1 IN_TRANSIT,1 EXPIRED, **only if the nine remain
  unchanged**. This is an expectation, not an observed result.
- Private transfer and Jopia acceptance remain pending. Lat performs real
  API/browser checks after accepted population. Near-expiry remains disabled;
  V4 remains default; V5 activation/binding, research, UAT and deployment gates
  remain separate. No model refit or inference change.

## Reproducible commands and results

Buno's technical self-validation on Python 3.12.3; not human UAT. Run from repo
root with WORKBOOK pointing to the original external XLSX and OUT to the new
external directory. Generator refuses existing output files and checkout paths.

```bash
python3 -m unittest discover -s scripts/operational-scenario -v
# PASS 31 tests: success, duplicates, cross-institution, grouping, overlap,
# balance, unknown values, date boundaries, hash tamper and exact replay.
GENERATOR_COMMIT=7e29fd98f7dcd7d7f137c7a9721827b05b66aa74
python3 scripts/operational-scenario/scenario.py \
  --workbook "$WORKBOOK" --revision "$GENERATOR_COMMIT" \
  --generated-at 2026-10-08T06:46:27Z --output "$OUT/scenario.json"
# Repeat with --output "$OUT/replay.json": byte-identical PASS.
python3 scripts/operational-scenario/verify.py \
  --workbook "$WORKBOOK" --manifest "$OUT/scenario.json" \
  --sha256 4ad33820481b1e331e71ac03bbf37ed719096a3fc33c6321829a73d7e3b5fe70
# PASS: 522 units, 486 available, 36 reserved, 522 donations, 24 reservations.
git diff --check
# PASS.
```

Independent cross-check used the unchanged forecasting extractor at the
baseline with full synthetic-sheet balance/coverage validation:

```bash
python -m bloodledger_forecasting.historical_snapshot \
  --workbook /evidence/ml-v5/BloodLedger_ML_Research_Dataset_v5.xlsx \
  --sha256 5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb \
  --business-date 2026-10-07
```

PASS: all twenty counts equal the new extraction by series key. Source mounted
read-only via PYTHONPATH in Buno's existing image
`sha256:d539c784667d763b48947971260fe88fb7c436d48eeea7c4eccf2c7369bf0c19`;
no replacement model or image is being supplied to runtime.

In the same image, `python -m ruff check --no-cache /src` passed; formatting
completed with `python -m ruff format --no-cache /src`. Initial formatting hit a
read-only cache path; the cache-disabled retry succeeded.
Gitleaks `ghcr.io/gitleaks/gitleaks:v8.30.1 dir --config /config/gitleaks.toml
--redact --no-banner /scan` passed on new candidate source. This is not a
full-history pass and does not resolve prior Git secret-scan findings.

**NOT_RUN:** live target/fingerprint revalidation, database/ledger population,
global FEFO against retained stock, actual API/census/browser/UAT. No application
code changed; existing application/model suites were not unnecessarily rerun.

## Private transfer instructions

Local external package:
`operational-stock-522-v1/buno-operational-stock-522-v1.zip` under Buno's existing
private artifact root. Contains only `scenario.json`, `SHA256SUMS`,
`validation-summary.json` and `TRANSFER-AND-EVIDENCE.md` (this document).
Do not commit or attach perunit JSON, XLSX or synthetic label material to GitHub.

Mikayla sends this ZIP to Jopia through the team's access-controlled private
file channel. Jopia extracts outside Git, compares `scenario.json` against the
**published file hash above** with `sha256sum` or PowerShell `Get-FileHash`, then
runs the verifier with the already-held original XLSX and recorded generator
revision. Bundled checksums alone are not an independent trust anchor. No
model/image resend is needed. Transfer is prepared, not claimed delivered.

Jopia should reply on PR27 with manifest hash acceptance, binding/window
review, accepted population path, target preflight and eventual real receipts.
Lat's API/browser verification follows accepted population.
