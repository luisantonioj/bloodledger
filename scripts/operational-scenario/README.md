# Synthetic operational scenario 522 V2 — Buno preparation

Status: **Proposed, SIMULATION_ONLY**. This successor responds to Lat's PR30
and Jopia's PR31 at exact head `a66528934432ebbb35eb1f45617909ca59374824`.
It supersedes V1 only for unsubmitted work because V1's population deadline
passed. V1 evidence remains historical and immutable. Neither this generator
nor its validator submits a command, accepts Jopia's review, approves Lat's
target, or grants permission to populate.

## Contract

`scenario.py` is schema/generator version `OPERATIONAL_SCENARIO_V1` /
`SYNTHETIC_OPERATIONAL_STOCK_522_V2`. It requires the exact original V5 workbook
bytes and opens only `Synthetic_Daily_Stocks`. The 2026-10-07 counts for
`SIM_INSTITUTION_01` supply **only** the twenty-series count distribution.
Historical dates, Donation No., collection/expiry and reservation purpose are
not inferred from aggregate rows. Original workbook and historical snapshot
remain immutable. The forecasting model, adapter, V4 default and V5 gates are
unchanged. This is not a new training dataset or a forecasting binding.

The external JSON contains:

- source byte hash, source-count digest, generator commit/file digest, seed,
  baseline, generation timestamp, scenario identity and proposed binding;
- all twenty positive ABO/component series including zero rows;
- 522 unit keys, each linked to one singleton synthetic donation group (522
  groups). No biological component yields or shared-donation relationships are
  asserted. WB is never grouped with a derived component;
- 486 intended AVAILABLE and 36 intended RESERVED units, split into 18 TRANSFER
  and 18 LOCAL_RELEASE units. Each reservation includes members, series,
  quantity, source, destination if applicable, stable workflow key and intended
  ACTIVE state. These are scenario keys, **not backend component/donation IDs**;
- separate issuer and custodian, both proposed `INST_MEDIATRIX`. Proposed mapping
  `SIM_INSTITUTION_01 -> INST_MEDIATRIX` applies only to this fixture. Transfer
  destination is explicitly `INST_SYNTH_MEDIX`; no stock or source-alias mapping
  to Medix or NLVilla is implied. Local release has null destination;
- no names, diagnoses, real labels, credentials or Donation No. material.
  Jopia must allocate collision-checked synthetic label references privately
  under the reviewed issuer contract and derive opaque persistent IDs.

Negative Rh series are **not provided/unknown**, never fabricated zero stock.
If a forty-cell census shows zero negative counts after an actual import, that
is a fact about that isolated operational state, not workbook source coverage.

## Frozen proposed execution window and nonclinical date policy

T0 is **2026-10-11 08:00 Asia/Manila** (`2026-10-11T00:00:00Z`).
Population may start no earlier than **2026-10-10 16:00 Manila**
(`2026-10-10T08:00:00Z`) and must finish before T0 to establish the target at T0.
Verify during `[T0, 2026-10-11T08:00:00Z)` (08:00–16:00 Manila).
This is Buno's **proposal**, not an approved execution window. If it is missed,
stop; issue a new scenario version, new dates and new reviewed hashes. Never
silently renew dates, reuse a version for changed bytes, or backdate to Oct 7.

All collection timestamps are T0 minus 24 hours. Reserved transfer units
expire T0 plus 48 hours; local-release units plus 49 hours. Available units
expire after T0 by WB 120h, PRBC 144h, FFP 168h, PC 96h, CRYO 192h.
These intentionally arbitrary technical offsets are
`SYNTHETIC_522_DATES_V2`, **not clinical shelf lives**. They keep all target
units unexpired throughout verification and create ties for FEFO tests.
Near-expiry alerts remain disabled; recommendations remain nonautonomous.

## Population contract and blockers (PR30/31)

1. Jopia reviews exact manifest, binding, date policy, window and target
   fingerprint. Reinspect retained target before mutation; the handoff's
   fingerprint `3ddfcfd9398fc720822ac25acd6524dff8098335513301728ca84520eda5f074`
   is prior evidence, not approval of a current database/ledger.
2. Preserve all existing accounts, requests, commands, nine operational units
   and the separately namespaced historical snapshot. Reject duplicate scenario
   applications and collisions. Record scenario-to-backend-ID mappings,
   generated label reference evidence, versions and real command/transaction
   receipts privately. No receipt, approval or ledger commitment is fabricated.
3. ADR-035 still requires confirmed OCR intake. Jopia must establish the
   approved population path; the JSON is **not** authorization to bypass OCR or
   perform direct database/ledger inserts. Any alternative requires explicit
   reviewed contract/architecture disposition.
4. Resolve primary-account/operator tooling and authorization prerequisites.
   Do not use retired role-cookie impersonation or confuse gateway with issuer.
5. Register all new units through that accepted path. For each series, reserve
   TRANSFER before LOCAL_RELEASE (earlier expiry). Fetch **all** eligible stock
   including pre-existing units; sort by actual expiry and backend component ID.
   Within a tied group, submit members in backend FEFO order, never scenario-key
   order. Validate exact intended membership against global FEFO before mutation.
   If old stock displaces any intended member, stop and review a new plan or an
   explicitly approved isolated target. Do not skip older units, re-date existing
   units, or alter global FEFO rules to force 36 new reservations.
6. Transfer workflows include a real destination-side request and accepted
   source-side reservation. A request alone does not reserve stock. Local
   release has a linked scenario workflow key; do not invent a backend request
   endpoint if none exists. Keep reservations ACTIVE, with no dispatch or
   completion at T0. Later lifecycle tests require separately versioned fixtures
   or explicit post-T0 evidence; they must not reduce the 522 target.
7. Verify real authorized API, census and ledger receipts. If the prior nine
   remain exactly unchanged, the conditional combined operational result is
   531 units: 492 AVAILABLE, 37 RESERVED, one IN_TRANSIT, one EXPIRED. This is an
   expectation, not an observed result. Historical 522 is never added as stock.

Application population, actual global FEFO ordering, authorization, and browser
results are **NOT_RUN** by Buno. Lat owns frontend verification after Jopia's
accepted population. Binding, activation, UAT, research and deployment gates
remain separate. No ML refit, model substitution, or V5 activation is needed.

## Reproduction (Python 3 standard library)

Run from repository root; use recorded generator revision for verification.
Set WORKBOOK to the original external XLSX and OUT to a new external directory.
Never place the XLSX, generated manifest or synthetic label material in Git.

```bash
python3 -m unittest discover -s scripts/operational-scenario -v
python3 scripts/operational-scenario/scenario.py \
  --workbook "$WORKBOOK" --revision "$GENERATOR_COMMIT" \
  --generated-at "$GENERATED_AT" --output "$OUT/scenario.json"
python3 scripts/operational-scenario/verify.py \
  --workbook "$WORKBOOK" --manifest "$OUT/scenario.json" --sha256 "$REVIEWED_FILE_SHA"
```

The canonical digest is SHA-256 of JSON with sorted keys, ASCII escaping and
compact separators, no terminal newline. File digest includes its terminal
newline. Neither digest is embedded in the file it hashes. The generator digest
identifies `scenario.py`; the generator commit also pins its verifier and tests.
No-overwrite protection requires a new output path for deterministic replay.
Use a private access-controlled transfer for `scenario.json` and its checksum;
verify against the separately published reviewed digest, not only a checksum
provided in the same transfer. The workbook is already privately held; do not
resend the frozen model or image.
