# Lat → Buno: complete synthetic operational test-stock scenario

Prepared 2026-10-08. Classification: SIMULATION_ONLY.
Owner: Buno for synthetic data design, lineage and review. Jopia owns validated
population/persistence; Lat owns API presentation and frontend validation.

## Requested outcome

Prepare a complete per-component synthetic dataset for a new operational
technical test scenario, using the reviewed 2026-10-07 historical distribution
as its count target: 486 AVAILABLE + 36 RESERVED = 522 new units across twenty
positive-blood-group/component combinations, including CRYO. This supports
later approved UAT; generating it does not execute human UAT or establish
clinical shelf life, real inventory, activation or deployment readiness.

Deliver your versioned scenario and generation evidence to Jopia. A workbook
alone cannot populate Lat's frontend: acceptance needs generation → validation
→ controlled backend population → Fabric/projection/API reconciliation → Lat
browser/workflow verification. No population or data change is made by this
handoff PR.

## Verified context and correction

Original source: `BloodLedger_ML_Research_Dataset_v5.xlsx`, SHA-256
`5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`.
Lat rechecked its bytes and selected synthetic stock table on 2026-10-08:
twenty rows for 2026-10-07, source alias `SIM_INSTITUTION_01`, 486 available,
36 reserved and 522 closing. These are aggregate stock counts, not donation
dates, individual labels or original reservation relationships.

Lat's real API separately confirms:

- Nine operational components already contain `componentId`, `donationId`,
  `collectedAt`, `expiresAt`, `issuerInstitutionId`, `institutionId`,
  `inventoryStatus`, `reservationId` and current inventory/reservation versions.
  They are six AVAILABLE, one RESERVED, one IN_TRANSIT and one EXPIRED.
- Two actual TRANSFER reservations have ACTIVE/IN_TRANSIT states and linked
  request IDs. Purpose is returned by reservation reads, rather than included
  directly in the operational component projection.
- The 522 historical records already have deterministic `component_id`,
  `snapshot_status`, series/allocation group IDs and VALID local ledger
  references. Collection/expiry and original reservation purpose are null.
  Generated historical allocations are not operational reservations.

Thus “all those fields are missing from the system” is inaccurate. What is
missing is a larger new, fully specified operational scenario and its tested
population/integration path. Historical rows and their source counts can
already be displayed without waiting for this work.

## Implementation baseline and retained host

Read AGENTS.md, the bloodledger-role skill as Buno, current Testing phase and
the linked authoritative sources. Inspect/preserve your own work first.

Use or explicitly integrate the verified successor:

- Branch `codex/lat-institution-account-integration`.
- Published evidence head `954f170b840fce1a346bb3bd393748a731be1913`.
- Tested implementation `639d600a53db4867ca943caa8afae36452ad348b`.
- Backend delivery PR #25 at `8b2df89a1f2ddf78d91f1557f8f5bac33a76dfa8`.
- [Lat's retained validation](https://github.com/luisantonioj/bloodledger/blob/954f170b840fce1a346bb3bd393748a731be1913/docs/frontend/LAT-INSTITUTION-ACCOUNT-VALIDATION-2026-10-08.md).

This handoff is a one-file documentation PR based on main for review. Main
does not contain the full retained integration; it is not the implementation
baseline. Use a dedicated `codex/` branch and grouped commits. Preserve the
original external workbook and unchanged pinned forecast model/image.

## Deliver the scenario specification first

Provide an immutable scenario/version identifier, declaration of purpose,
seed/generator revision, source byte hash/date, generation time, declared
starting instant T0, timezone, institution binding and canonical manifest hash.
Do not reuse the original historical manifest approval or IDs. Dates of
generation and T0 are separate from the fixed historical source date.

Use UTC timestamps in artifacts and Asia/Manila for interpretation. Derive T0
for the reviewed execution window, then freeze exact dates/hash for apply and
replay. Do not silently refresh an expired manifest or backdate a new run to
2026-10-07. Define what must happen if implementation occurs after its window.

| Per-unit/scenario evidence | Buno's deliverable |
|---|---|
| Unit identity | Stable synthetic unit key; Jopia derives authoritative persistent component IDs and checks collisions |
| Donation relationships | Stable synthetic donation/group key and legal component relationships; reuse of one donation across components must be consistent |
| Collection and expiry | Explicit UTC `collectedAt`/`expiresAt`, consistent ordering and declared nonclinical synthetic policy for each type; no shelf-life inferred from stock snapshot date |
| Original issuer/current custody | Separate issuer and custodian intentions, both from approved synthetic institutions; no assumption that a gateway identity is the source institution |
| Intended state at T0 | AVAILABLE/RESERVED targets per series; additional lifecycle examples tracked separately rather than silently changing 486/36 |
| Reservations | Unit membership, purpose TRANSFER/LOCAL_RELEASE, scenario request/release keys, source/destination and desired lifecycle; 36 reserved units must have genuine workflow relationships |
| Provenance | Source distribution versus newly generated assumptions, policy versions and generator digest; no fabricated current transaction evidence |

The workbook alias `SIM_INSTITUTION_01` is a research alias. Supply a proposed
explicit development-only mapping to `INST_MEDIATRIX`, plus rationale and
scope for Jopia review. It is not an approved real institution or UAT binding.
Do not automatically copy that mapping to Medix or N.L. Villa. The six-account
roster, operators and roles remain unchanged; recipient workflow scenarios
must use the existing approved banks/requestor and verified capabilities.

Keep any synthetic Donation No. label material and generated manifests outside
Git unless its exact fixture scope is explicitly approved. No donor/patient
identity, employee IDs, real staff details, credentials or unrestricted label
OCR are permitted. Version generator/schema/validation code and safe summaries.

## Reconciliation and scenario quality

1. Preserve the twenty source count rows, including any zero entries, with
   available + reserved = closing for every series. Match all 522 distinct
   new unit keys; report donation groups and per-purpose reservation totals.
2. Keep available units unexpired and eligible at T0 under the selected
   synthetic rules. Plan tied expiry/FEFO examples and boundary cases without
   assuming clinical blood compatibility or real shelf-life rules.
3. Coordinate FEFO selection with Jopia's existing eligible stock. A scenario
   cannot skip older eligible units simply to force its new IDs into a
   reservation. Do not change global FEFO or existing units to make counts fit.
4. Baseline and new-scenario totals are separate. If the current nine remain
   unchanged, additive population gives 531 operational units: 492 AVAILABLE,
   37 RESERVED, one IN_TRANSIT and one EXPIRED. These are conditional planned
   totals, not observed post-load evidence; actual expiry/time/state changes
   must be reconciled. The original historical 522 stay separate.
5. Produce valid/invalid generation checks for duplicates, date order,
   unsupported enums, cross-institution reservations, overlapping reservation
   membership, donation grouping, balance and deterministic replay.
6. Provide mapping across all forty supported census combinations. The V5
   source has twenty positive-Rh series; unsupported/missing data is not a
   verified operational zero. Jopia must derive actual census/zero evidence
   from the populated operational projection.

The near-expiry alert policy remains disabled; dates and expiry examples do
not enable it. Keep stock-dependent recommendations nonautonomous.

## Handoff back to Jopia and Lat

Return exact branch/commit, source and scenario hashes, schema/generator
version, reviewed mapping/T0/policies, safe twenty-row reconciliation,
per-purpose reserved membership counts, validation commands/results, private
artifact transfer instructions and unresolved decisions. Confirm which
assumptions are proposed versus reviewed. Keep the original historical
snapshot untouched. Do not label fabricated IDs or another host's receipts
as a new local Fabric commitment.

No forecast resend, reconstruction or retraining is requested. V4 stays the
default. V5 retained persistence still needs separate current-target
binding/job approval and operator-aware maintenance tooling from Jopia. Human
UAT participation, consent/instrument/research custody, RQ-07/RQ-14, physical
OCR, full latency, reporting policy, clinical and deployment gates stay open.
