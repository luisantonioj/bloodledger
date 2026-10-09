# Buno: operational scenario V2 review and private transfer

Status: **Proposed; SIMULATION_ONLY; no population authorization.**
Selected work: TP-STOCK-01 / BL-TST-01. Prepared 2026-10-09.

## Reviewed boundary

Reviewed [Lat PR30](https://github.com/luisantonioj/bloodledger/pull/30)
at `f7a11adb356647038b356ca88086ed936c965a31` and
[Jopia PR31](https://github.com/luisantonioj/bloodledger/pull/31)
at `a66528934432ebbb35eb1f45617909ca59374824`. No blocking
scenario/ML-boundary finding was identified at these heads. This is a scoped
technical review, not acceptance of Lat's environment or population approval.

PR30 correctly separates Lat's nine operational units from the historical 522.
PR31 binds successor review to exact source, generator/verifier, manifest,
window, target and policy; retains original V1 recovery; protects retained rows,
identity bytes/modes and volumes; reads the original T0 census on restart with
honest CURRENT/STALE status; rejects missing/late capture; and updates fast-jwt
to 6.3.4 with a cached-expiry regression. These controls must be exercised on
Lat's actual environment. Jopia's documented host results remain his disclosed
self-validation, not Lat evidence.

## Frozen successor

Generator commit: `e1114dda935c100cdc0113120e631ef12534422b`.
Scenario: `SYNTHETIC_OPERATIONAL_STOCK_522_V2`.
Schema remains `OPERATIONAL_SCENARIO_V1`; date policy is `SYNTHETIC_522_DATES_V2`.
Generated at `2026-10-09T07:40:19Z`. The unchanged generator algorithm expands
the original twenty counts, including AB+ platelets zero. Negative Rh remains
unknown in source coverage. No model training, inference or adapter changed.

The exact V5 workbook, sheet `Synthetic_Daily_Stocks`, alias
`SIM_INSTITUTION_01`, business date **2026-10-07** supplies counts only.
522 new singleton donation groups yield **486 AVAILABLE and 36 RESERVED**:
24 reservation scenarios, 18 TRANSFER units and 18 LOCAL_RELEASE units.
The proposed alias maps only to `INST_MEDIATRIX`, separately recorded as issuer
and custodian. Transfer destination is `INST_SYNTH_MEDIX`; local destination is
null. Backend IDs and collision-checked synthetic labels belong to Jopia's
reviewed population path. No accepted review or target authorization is supplied.

V1 and the historical snapshot remain separate and immutable. For V1 archival
replay use its original revision, not the V2 verifier. Existing model bytes were
rechecked unchanged. This successor is not a new workbook or forecasting binding.

| Window | UTC | Asia/Manila |
| --- | --- | --- |
| Population start, inclusive | 2026-10-10 08:00 | October 10, 16:00 |
| Population end, exclusive / T0 | 2026-10-11 00:00 | October 11, 08:00 |
| Verification end, exclusive | 2026-10-11 08:00 | October 11, 16:00 |

All collection timestamps are October 10 00:00 UTC. Reserved TRANSFER expiry
is October 13 00:00 UTC; LOCAL_RELEASE expiry is October 13 01:00 UTC.
AVAILABLE expiry is 00:00 UTC on October 16 (WB), 17 (PRBC), 18 (FFP),
15 (PC), and 19 (CRYO). These are synthetic technical offsets, not clinical
shelf lives. A missed window requires a newly versioned reviewed scenario;
do not silently renew V2 or backdate a population/census.

## Published SHA-256 values

| Artifact | SHA-256 |
| --- | --- |
| Original V5 workbook bytes | `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb` |
| Ordered original twenty counts | `fcf62756d3e0b449e7a294b51e8108106f20e5735746c193b4dce0529e7a9daf` |
| Generator scenario.py | `57dab0b00211ea4b7f0ce000e28cf4c7b16661d508c0d7d2c6b0c5c367da1fb3` |
| Verifier verify.py | `e37be3062860607bf09e18b2cdd080dc8bd1abb0eb71c85da19a1d830e060899` |
| scenario.json file bytes | `4379fbba1d1daf4b9c3742b6f4d1687eaee2aea4be922b8e7058e9918b38651e` |
| Canonical manifest | `bff9265b5d33ba34f438e3d8d445ca83bdfb1ca43265cb77833d40cf991e6b58` |
| bloodledger-operational-stock-522-v2.zip | `4d275d8fd38f70ecd17c4c4d9058ca4cd2c524cda4fba124fd42aabbdf28dff9` |
| Unchanged selected_model.json bytes | `1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764` |

## Buno validation and reproduction

At the generator commit above, Python 3.12.3:

```bash
python3 -m unittest discover -s scripts/operational-scenario -v
python3 scripts/operational-scenario/scenario.py \
  --workbook "$WORKBOOK" --revision e1114dda935c100cdc0113120e631ef12534422b \
  --generated-at 2026-10-09T07:40:19Z --output "$OUT/replay.json"
cmp "$OUT/scenario.json" "$OUT/replay.json"
python3 scripts/operational-scenario/verify.py \
  --workbook "$WORKBOOK" --manifest "$OUT/scenario.json" \
  --sha256 4379fbba1d1daf4b9c3742b6f4d1687eaee2aea4be922b8e7058e9918b38651e
```

Results: **32/32 scenario tests PASS**, byte-identical replay PASS, pinned
source and exact manifest verification PASS: 20 series / 522 units / 522
donations / 24 reservations / 486 available / 36 reserved.

An isolated `git archive` snapshot of the generator commit was mounted as
`/workspace` in `node:24.17.0-bookworm-slim`, using Windows Docker and a private
C-drive scratch directory. No application target, database, Fabric network or
credentials were mounted. Commands run inside that container:

```bash
npm ci --ignore-scripts
npm run test:development-data
node --test services/api/build/test/jwt-cache-expiry.test.js
```

Results: install PASS (0 audit vulnerabilities reported); API and chaincode
TypeScript builds PASS; **32/32 development-data tests PASS** covering review,
preservation, FEFO, recovery and census boundaries; **1/1 JWT regression PASS**.
These are software checks, not a live target population or browser validation.

## Private transfer and remaining gates

Buno holds `operational-stock-522-v2/bloodledger-operational-stock-522-v2.zip`
outside Git. Send it through the team's private access-controlled transfer to
Jopia and Lat. It contains only `scenario.json`, `SHA256SUMS` and
`PRIVATE-TRANSFER.txt`; the original workbook and frozen model are not resent.
Verify the archive against the independently published hash above, extract
privately, then verify the manifest and replay using the pinned repository
revision and already-held original workbook. Never upload the archive, manifest,
labels, target configuration or credentials to a PR.

Jopia must review the exact successor and Lat's fresh target/policy/lifecycle
evidence, then supply the accepted sealed review required by PR31. The previous
target fingerprint is not current approval. Lat follows the
[reviewed population package](JOPIA-TO-LAT-POPULATION-PACKAGE-2026-10-09.md):
preservation checkpoint, validated backup, preview/global FEFO, explicit exact
execution confirmation, population and independent API/Fabric/workflow/census
and restart checks. Preserve accounts, credentials, identities, volumes,
existing operational/historical rows and frontend edits. Do not reset, copy
Jopia's populated store or reuse his receipts. Stop on mismatch or missed window.

Target mutation, live backup/restore, population, real API/Fabric verification,
browser checks and restart checks are **NOT_RUN by Buno**. Conditional totals
remain 531 operational if Lat's original nine are preserved; historical 522 is
never added to operational stock. V4 remains default. V5 activation/binding,
research, UAT and deployment approvals remain separate and ungranted here.
