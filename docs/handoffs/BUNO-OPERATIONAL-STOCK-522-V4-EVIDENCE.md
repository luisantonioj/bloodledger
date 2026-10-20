# Buno operational stock 522 V4 evidence

2026-10-20 · **Proposed, SIMULATION_ONLY. No acceptance, target approval or population authorization.**

V4 is a new defense-host scenario because Jopia reports all V1 label stock expired.
V3 is unchanged historical evidence for Lat's host. Existing units are never re-dated.
Baseline main `a632ef329a16556cccd38238daa4c0bdaab7bb74` includes PR97/TP-JOP-D19.
No target was inspected or mutated by Buno; reported 492 expired and seven available
are Jopia's context, not Buno-verified current totals. Live preservation and FEFO checks remain mandatory.

Generator commit: `1b07b5752b4868b13eebcea36745f62c7d133878`. Generated at `2026-10-20T01:26:35Z`.

## Frozen window

| Boundary | UTC | Manila |
|---|---|---|
| Population not before | 2026-10-20 01:30 | Tue Oct20 09:30 |
| Apply-start cutoff (Jopia) | 2026-10-20 10:00 | Tue Oct20 18:00 |
| T0 / population end exclusive | 2026-10-20 22:00 | Wed Oct21 06:00 |
| Verification end exclusive | 2026-10-21 03:00 | Wed Oct21 11:00 |

09:30 is the next whole half hour after 09:26:35 generation. Strict generatedAt <
populationNotBefore is enforced, including rejection of equality. If the window is
missed, publish a new version or use the reviewed OCR fallback; never renew V4.

## Preserved lineage and offsets

Exact V5 workbook, Synthetic_Daily_Stocks, SIM_INSTITUTION_01, Oct7 count distribution
only. 20 series, 522 singleton donations/units, 486 AVAILABLE and 36 RESERVED,
24 reservations with 18 TRANSFER members and 18 LOCAL_RELEASE members.
Issuer/custodian INST_MEDIATRIX; transfer destination INST_SYNTH_MEDIX; local destination null.
Historical records stay separate. Negative Rh source coverage is unknown.

All V3 offsets are unchanged under SYNTHETIC_522_DATES_V4:
collection Tue Oct20 06:00 Manila (T0−24h); reserved TRANSFER expiry Fri Oct23 06:00
(+48h), LOCAL_RELEASE Fri 07:00 (+49h); available PC Sun Oct25 06:00 (+96h),
WB Mon Oct26 (+120h), PRBC Tue Oct27 (+144h), FFP Wed Oct28 (+168h),
CRYO Thu Oct29 (+192h), all 06:00 Manila. **Clarification:** the request's prose
said all available units expire Oct26–29, but preserving PC's +96h offset means
Oct25 for PC. The explicit unchanged-offset instruction controls; no defense expiry.
These are synthetic technical dates, not clinical shelf lives.

## SHA-256

| Artifact | SHA-256 |
|---|---|
| Workbook (unchanged) | `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb` |
| Twenty counts (unchanged) | `fcf62756d3e0b449e7a294b51e8108106f20e5735746c193b4dce0529e7a9daf` |
| scenario.py | `fcd4e09a7231726111d665e2a14c5b7f7bb41ea9153832d0b7878bafbd954ca9` |
| verify.py (unchanged) | `b3d8b8ca85a2018504f4b1cd7b843d3c4ccfae5858f0e9f3f0d14d14925866bc` |
| scenario.json file | `59af4571c4e67d538a257b6884618fb4777754025e219e190f7bcadcf673f846` |
| Canonical scenario | `00bc0d37d8311ea7443a95ddc0f2263095019de5a1ec5c7cc6ed0018c33913f7` |
| ZIP | `74a19d056610f3529265e44aaab59cf845d901e521104b7666c15c5f8a9dbeab` |

## Validation (Buno self-validation)

`python3 -m unittest discover -s scripts/operational-scenario -v`: **36/36 PASS**.
`git diff --check`: PASS. Source hash, counts, exact deterministic replay and ZIP
scenario-byte verification PASS. Verifier reports 522/486/36, 522 donations,
24 reservations, 20 series and the frozen window. verify.py bytes are unchanged.

```bash
python3 scripts/operational-scenario/scenario.py --workbook "$WORKBOOK" --revision GENERATOR_COMMIT --generated-at 2026-10-20T01:26:35Z --output "$OUT/replay.json"
python3 scripts/operational-scenario/verify.py --workbook "$WORKBOOK" --manifest "$OUT/scenario.json" --sha256 FILE_SHA
cmp "$OUT/scenario.json" "$OUT/replay.json"
```

Replace GENERATOR_COMMIT and FILE_SHA with the published values above. Commands
were exercised through the CLI generator and Python verifier/build functions;
canonical replay was compared in memory. ZIP contains scenario.json, SHA256SUMS
and PRIVATE-TRANSFER.txt only; workbook/model are not resent. Private directory
mode 0700 and artifact files mode 0600. No private artifacts enter Git.

## Private transfer and next owner

Private local delivery: build/operational-stock-private/v4/ on Buno's persistent
workspace. Send the ZIP and scenario.json to Jopia through the team's private channel;
verify against these separately published hashes. No remote private destination was
provided, so a delivery receipt is pending; local download links are supplied to the user.

Jopia reviews exact hashes/window, inspects the live target, posts ACCEPTED here and
seals the review JSON from that link before executing. Preserve accounts, credentials,
identities, volumes, prior units and historical records. Use reviewed backup, preview,
confirmation, apply/resume and independent API/Fabric/workflow/census/restart checks.
Do not bypass a global FEFO conflict. labelSequenceStart=2000 is Jopia's proposed
execution input, still subject to his collision checks, not embedded label identifiers.

NOT_RUN: live target, backup/restore, population, service stop/start, API/Fabric,
UI, census or forecast jobs. No clinical, accuracy, deployment or UAT approval.
V4 forecasting stays default; V5 binding/activation remains separate. No model changes.
