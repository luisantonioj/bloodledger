# Buno operational stock 522 V5 evidence

2026-10-20 · Proposed · SIMULATION_ONLY · No acceptance, target approval or population authorization.

## Supersession: TP-JOP-D22

Jopia reports V4 was accepted and previewed but never populated: Tesseract rejected
collectedAt at the unchanged 90% exact-match gate. V4 files remain immutable unused
historical evidence. V5 changes identity/window to midnight UTC, retaining all V3
relative date offsets, source/count distribution, mappings and reservation relationships.
Jopia's font tests are disclosed external self-validation, not Buno OCR results.

Baseline current main `5a624d9deae056a892c0d5bb5af556530756cec5` includes PR97 and PR100.
Generator commit `affda0f84b8999365a273ea6cbb173133e01d25b`. Generated `2026-10-20T04:05:51Z`.

## Frozen window

Population not before **2026-10-20T04:30:00Z (Tue 12:30 Manila)**, the next whole
half hour after generation at 12:05:51. generatedAt is strictly earlier.
Apply-start cutoff remains Tue 18:00 Manila. T0 **2026-10-21T00:00:00Z
(Wed 08:00 Manila)**. Verification end exclusive **2026-10-21T03:00:00Z
(Wed 11:00 Manila)**. Never renew V5 dates; missed window requires a new reviewed
version or reviewed fallback.

Collection Oct20 08:00 Manila (T0−24h); reserved TRANSFER expires Oct23 08:00
(+48h), LOCAL_RELEASE Oct23 09:00 (+49h); available PC Oct25, WB Oct26,
PRBC Oct27, FFP Oct28, CRYO Oct29 at 08:00 Manila (+96/120/144/168/192h).
These are synthetic technical offsets, not clinical shelf lives.

522 units/singleton donations: 486 AVAILABLE, 36 RESERVED; 24 reservations,
18 TRANSFER members and 18 LOCAL_RELEASE members; 20 positive ABO/component series.
Issuer/custodian INST_MEDIATRIX, transfer destination INST_SYNTH_MEDIX, local null.
Exact original V5 workbook, Synthetic_Daily_Stocks, SIM_INSTITUTION_01, Oct7 counts
only. Historical records are separate; negative Rh source coverage remains unknown.

## SHA-256

| Artifact | SHA-256 |
|---|---|
| Workbook unchanged | `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb` |
| Counts unchanged | `fcf62756d3e0b449e7a294b51e8108106f20e5735746c193b4dce0529e7a9daf` |
| scenario.py | `9384f6421aa04d1d92650ea6f3b51ae73775df8ac08fbd6f4085eda8ac6ca47f` |
| verify.py unchanged | `b3d8b8ca85a2018504f4b1cd7b843d3c4ccfae5858f0e9f3f0d14d14925866bc` |
| scenario.json | `751658628dda81dbec95faafc99b46a7f4d5087f8f355f9f014ff243b5f8efe9` |
| Canonical scenario | `d6dfed79f6a9f79c5e7c0741e0cd3acd6585d19e1dba8b7a5e2f59dae5bc4698` |
| ZIP | `b80b001e7c2db202da263e7e59ef637dc826224e06eba3da1e39d84291023e79` |

## Validation and reproduction

Buno self-validation: `python3 -m unittest discover -s scripts/operational-scenario -v`
**36/36 PASS**; earliest-expiry assertion is 2026-10-23T00:00:00Z.
Pinned-source extraction, exact canonical replay, verifier and ZIP scenario-byte
checks PASS. `git diff --check` PASS. Verifier bytes unchanged.

```bash
python3 scripts/operational-scenario/scenario.py --workbook "$WORKBOOK" --revision "$GENERATOR_COMMIT" --generated-at 2026-10-20T04:05:51Z --output "$OUT/replay.json"
python3 scripts/operational-scenario/verify.py --workbook "$WORKBOOK" --manifest "$OUT/scenario.json" --sha256 "$PUBLISHED_FILE_SHA"
cmp "$OUT/scenario.json" "$OUT/replay.json"
```

Generation used the CLI; replay and verification used the same Python build/verify
functions, comparing canonical bytes in memory. No live target, OCR, backup, preview,
confirmation, population, service mutation, census or forecasting job ran on Buno's host.
No model or confidence gate changes. Jopia must rerun OCR preview and inspect his
actual target; prior target/policy prefixes do not approve a new execution.

## Private transfer and review

Artifacts remain under private build/operational-stock-private/v5, directory 0700,
files 0600. ZIP contains scenario.json, SHA256SUMS and PRIVATE-TRANSFER.txt only.
Workbook/model are not resent. Never add artifacts or credentials to GitHub.
Private Drive folder discovery is pending; no destination is guessed. Local download
links are supplied for private forwarding while the folder is confirmed.

Jopia must verify published hashes/replay, review the live target/window, post ACCEPTED
on the V5 PR and seal that review before preview → confirm → apply. Preserve accounts,
credentials, identities, volumes, existing stock/history and frontend work; honor FEFO.
Then verify API/Fabric/workflow/census and restart within the frozen window.
V4 forecasting default and separate V5 model activation/binding gates are unchanged.
