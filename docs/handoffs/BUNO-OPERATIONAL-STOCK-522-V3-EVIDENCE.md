# Buno: operational scenario V3 review and private transfer

Status: **Proposed; SIMULATION_ONLY; no population authorization.**
Selected work: TP-STOCK-01 / BL-TST-01. Prepared 2026-10-11.

## Why V3 exists

**V2 = MISSED_WINDOW, not populated and not renewed.** Its population window
(2026-10-10T08:00Z to 2026-10-11T00:00Z) closed on Lat's retained host with
zero stock runs: nine operational and 522 historical units, unchanged. As the
[V2 evidence](BUNO-OPERATIONAL-STOCK-522-V2-EVIDENCE.md) requires, a missed
window needs a new version with new dates and new reviewed hashes. V1 and V2
remain historical and immutable. Replay each with its own recorded revision,
not the V3 verifier.

## Frozen successor

Generator commit: `130b4ed2d2f9190e25ab1e4f98ee8617e2e0a247`.
Scenario: `SYNTHETIC_OPERATIONAL_STOCK_522_V3`.
Schema remains `OPERATIONAL_SCENARIO_V1`; date policy is `SYNTHETIC_522_DATES_V3`.
Generated at `2026-10-11T02:57:39Z` (10:57:39 Manila), before the population
window opens. The validator now rejects a `generatedAt` later than
`populationNotBefore`, so the manifest cannot be generated or backdated inside
its own window. No model training, inference or adapter changed.

Unchanged from V2: the exact V5 workbook, sheet `Synthetic_Daily_Stocks`,
alias `SIM_INSTITUTION_01` and business date **2026-10-07**. These supply
counts only. The ordered algorithm still expands the same twenty counts,
including AB+ platelets zero. The result is 522 singleton donation groups,
**486 AVAILABLE and 36 RESERVED**, 24 reservation scenarios, 18 TRANSFER units
and 18 LOCAL_RELEASE units. The proposed `SIM_INSTITUTION_01 -> INST_MEDIATRIX`
binding is unchanged; Mediatrix is both issuer and custodian. The transfer
destination is `INST_SYNTH_MEDIX`; local release has a null destination.
Negative Rh remains unknown in source coverage.

One recorded field changed besides version, policy and window:
`baselineCommit` is now merged main
`bf70eff50ec7235626150d0f1678aaf40508b476` (PR #35). That commit contains
Jopia's PR31 runner (`a6652893…` is an ancestor) and the
`stock-review.mjs` successor rule that accepts V3. Nothing under
`scripts/development-data` or `services` changed.

## Window decision

| Window | UTC | Asia/Manila |
| --- | --- | --- |
| Population start, inclusive | 2026-10-11 06:00 | Sunday October 11, 14:00 |
| Population end, exclusive / T0 | 2026-10-11 15:30 | Sunday October 11, 23:30 |
| Verification end, exclusive | 2026-10-11 23:00 | Monday October 12, 07:00 |

The proposed T0 was 23:00 Manila. Buno set it to **23:30** for this reason: the
agreed sequence lets apply start as late as the 16:00 cutoff and estimates
5.5–7 hours. With T0 at 23:00, a 16:00 start at the 7-hour bound ends exactly
at T0 and fails. At 23:30, that worst case leaves 30 minutes for one resume.
The planned 15:45 start leaves 45 minutes to 2 hours 15 minutes. T0 stays
before Manila midnight, so the T0 census keeps business date 2026-10-11.
Verification runs 7.5 hours, from 23:30 to the Monday 07:00 go/no-go. This
covers T0 verification, the restart check and the J9 dry run. T0 verification
and the dry run start 30 minutes later than in the agreed sequence.

The window is frozen as three absolute instants, not V2's T0−16h/T0+8h shape.
The runner requires only `populationNotBefore < t0 < verificationWindowEndExclusive`.

## Date policy `SYNTHETIC_522_DATES_V3`

The offsets relative to T0 are unchanged from V2; only T0 moved. These are
synthetic technical offsets, not clinical shelf lives. Near-expiry alerts stay
disabled.

| Units | Offset | UTC | Asia/Manila |
| --- | --- | --- | --- |
| All collections | T0−24h | 2026-10-10 15:30 | Sat Oct 10, 23:30 |
| Reserved TRANSFER expiry | T0+48h | 2026-10-13 15:30 | Tue Oct 13, 23:30 |
| Reserved LOCAL_RELEASE expiry | T0+49h | 2026-10-13 16:30 | Wed Oct 14, 00:30 |
| AVAILABLE PC expiry | T0+96h | 2026-10-15 15:30 | Thu Oct 15, 23:30 |
| AVAILABLE WB expiry | T0+120h | 2026-10-16 15:30 | Fri Oct 16, 23:30 |
| AVAILABLE PRBC expiry | T0+144h | 2026-10-17 15:30 | Sat Oct 17, 23:30 |
| AVAILABLE FFP expiry | T0+168h | 2026-10-18 15:30 | Sun Oct 18, 23:30 |
| AVAILABLE CRYO expiry | T0+192h | 2026-10-19 15:30 | Mon Oct 19, 23:30 |

The earliest expiry is after Monday's UAT and after a Tuesday fallback session.

## Retained-stock FEFO check

The runner rejects the preview if an older AVAILABLE Mediatrix unit in a
reservation series expires before the intended members
(`STOCK_GLOBAL_FEFO_MEMBERSHIP_CONFLICT`). The reservation series are all
PRBC, FFP, PC and CRYO series except AB+ PC and AB+ CRYO. No WB series has a
reservation.

Lat's nine retained units come from the persistent seed run with
`--date 2026-10-08` ([Lat retained validation](../frontend/LAT-RETAINED-ACTOR-VALIDATION-2026-10-08.md)).
Under that seed, the seven non-expired units expire 2026-10-18T00:00Z, which is
after both T0+48h and T0+49h. The EXPIRED unit (2026-10-07T23:00Z) and the
imminent unit (2026-10-08T23:00Z) are excluded from eligibility because they
expire before any population event. Buno ran the runner's own
`reservationPlan()` at `bf70eff` with these nine units. It ran at the window
start and at 15:29:59Z, once with the recorded statuses and once with all nine
treated as AVAILABLE at Mediatrix. All four runs selected exactly the 36
intended members in 24 reservations and **zero retained units**.

This is a derived check, not Lat's live list. If Lat's actual 9-unit list or
Jopia's review shows any other AVAILABLE Mediatrix unit in a reservation series
expiring at or before 2026-10-13T16:30Z, stop before preview. Do not change
old stock or V3 dates. The live preview remains the authoritative FEFO check.

## Published SHA-256 values

| Artifact | SHA-256 |
| --- | --- |
| Original V5 workbook bytes | `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb` |
| Ordered original twenty counts | `fcf62756d3e0b449e7a294b51e8108106f20e5735746c193b4dce0529e7a9daf` |
| Generator scenario.py | `98ecbaf6935aab2eca2c4e25c40074f90a6fa0e4160c1952ead625550b64358f` |
| Verifier verify.py | `b3d8b8ca85a2018504f4b1cd7b843d3c4ccfae5858f0e9f3f0d14d14925866bc` |
| scenario.json file bytes | `afcf63cc3e07f42869511c628df5e904a5aec665bdb4c2955917532135ca2562` |
| Canonical manifest | `2d40ef8a6fca84bf23a1df42e1f0d68b24feaae1898bd84f62c5c661dc943941` |
| bloodledger-operational-stock-522-v3.zip | `926daea1e45505da414635d937d8c45743ea62697d5aa0d4f031d329a1708e4f` |
| Unchanged selected_model.json bytes | `1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764` |

## Buno validation and reproduction

At the generator commit above, Python 3.12.3:

```bash
python3 -m unittest discover -s scripts/operational-scenario -v
python3 scripts/operational-scenario/scenario.py \
  --workbook "$WORKBOOK" --revision 130b4ed2d2f9190e25ab1e4f98ee8617e2e0a247 \
  --generated-at 2026-10-11T02:57:39Z --output "$OUT/replay.json"
cmp "$OUT/scenario.json" "$OUT/replay.json"
python3 scripts/operational-scenario/verify.py \
  --workbook "$WORKBOOK" --manifest "$OUT/scenario.json" \
  --sha256 afcf63cc3e07f42869511c628df5e904a5aec665bdb4c2955917532135ca2562
```

Results:

- **36/36 scenario tests PASS.** The four new tests cover the frozen V3
  window, rejection of the V2 identity and date policy, rejection of generation
  after the population start, and the earliest expiry.
- Byte-identical replay PASS.
- Pinned-source and exact-manifest verification PASS: 20 series, 522 units,
  522 donations, 24 reservations, 486 available, 36 reserved. The verifier
  also prints the date policy and the four window instants.
- The extracted ZIP matches its `SHA256SUMS`, and the extracted `scenario.json`
  passes the same verifier.

An isolated `git archive` snapshot of the generator commit was mounted as
`/workspace` in `node:24.17.0-bookworm-slim` (Docker in WSL, private scratch
directory). No application target, database, Fabric network, credentials or
private artifacts were mounted. Commands run inside that container:

```bash
npm ci --ignore-scripts
npm run test:development-data
```

Results: install PASS (576 packages, 0 audit vulnerabilities reported); API
and inventory-contract TypeScript builds PASS;
**37/37 development-data tests PASS**. These cover review hashes, successor
acceptance, window boundaries, global FEFO and older-stock displacement,
preservation, recovery, census and J9 worker controls. These are software
checks, not a live target population or browser validation.

## Private transfer and remaining gates

Buno holds `bloodledger-operational-stock-522-v3.zip` outside Git in a mode-0700
private directory. Send it through the team's private access-controlled
transfer to Jopia and Lat. It contains only `scenario.json`, `SHA256SUMS` and
`PRIVATE-TRANSFER.txt`. The original workbook and frozen model are not resent.
Verify the archive against the hash published above, not only the
`SHA256SUMS` inside it. Then extract it privately, and verify and replay the
manifest using the pinned generator revision and the original workbook you
already hold. Never upload the archive, manifest, labels, target configuration
or credentials to a PR.

Jopia must review this exact successor and Lat's fresh target and policy
evidence, then post the ACCEPTED review that Lat's sealed scenario review
references. Earlier target fingerprints are prior evidence, not current
approval. Lat follows the
[reviewed population package](JOPIA-TO-LAT-POPULATION-PACKAGE-2026-10-09.md)
with V3 files: preservation checkpoint, validated backup, preview with global
FEFO, explicit confirmation of the exact execution, population, and independent
API, Fabric, workflow, census and restart checks. Preserve accounts,
credentials, identities, volumes, existing operational and historical rows,
and frontend edits. Stop on mismatch or a missed window. **A missed V3 window
needs a new reviewed version; never extend V3.**

Target mutation, live backup or restore, population, real API or Fabric
verification, browser checks and restart checks are **NOT_RUN by Buno**. If
Lat's original nine are preserved, the conditional total is 531 operational
units. The historical 522 are never added to operational stock. V4 remains the
default. V5 activation and binding, research, UAT and deployment approvals
remain separate and are not granted here.
