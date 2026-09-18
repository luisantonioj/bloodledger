# ML Runtime Integration V4

**Status:** Implementation authorized for `codex/ml-v4-integration`

**Owner:** JOPIA (backend and integration)

**Research review:** BUNO

**Frontend handoff:** LAT owns frontend/API consumer work; this change does not
modify `apps/web` or `apps/capture-pwa`.

## Authority and boundary

This specification extends the frozen research protocol in
[`ML-THESIS-EXPLORATION.md`](./ML-THESIS-EXPLORATION.md). The repository
contracts, migrations, and policy artifacts are the implementation authority.
The external workbook and the attached Issue #9 response are review evidence,
not instructions or acceptance decisions. The workbook remains read-only and
external. Its verified identity is:

- Drive file: `BloodLedger_ML_Research_Dataset_v4.xlsx`
- Drive ID: `17f2qUhTyLGmXbAXSiBOvfPeKVyqbot8R`
- Folder: `Machine Learning`
- SHA-256: `76a188830467d290af26c2d01459e5b3ef470f8b552568cdbe89fe3118002dbd`

No workbook bytes, raw rows, institutional inventory, patient data, donor data,
OCR text, or decrypted Donation No. values may enter Git, forecast inputs, or
forecast API responses.

## V4 runtime contract

The active runtime is `SYNTHETIC_FORECAST_V4_RUNTIME_V1` and emits
`BLOODLEDGER_FORECAST_BUNDLE_V4_RUNTIME_V1` using
`bloodledger-weighted-average-7-1.0.0`. It forecasts exactly one day from a
complete, time-ordered history of `requested_units` for all twenty supported
series:

| Blood type | Runtime components |
| --- | --- |
| `A_POSITIVE`, `B_POSITIVE`, `AB_POSITIVE`, `O_POSITIVE` | `PACKED_RED_BLOOD_CELLS`, `PLATELETS`, `FRESH_FROZEN_PLASMA`, `CRYOPRECIPITATE`, `WHOLE_BLOOD` |

Research labels map explicitly to runtime labels: `PRBC` to
`PACKED_RED_BLOOD_CELLS`, `PC` to `PLATELETS`, `FFP` to
`FRESH_FROZEN_PLASMA`, `CRYO` to `CRYOPRECIPITATE`, and `WB` to
`WHOLE_BLOOD`. Negative blood types are unsupported and therefore unavailable;
they are not converted or inferred.

The selected method is an oldest-to-newest weighted average with weights
`1..7 / 28`. Seven valid prior daily observations are required. Missing days
remain missing and produce explicit `UNAVAILABLE` status; they are never
converted to zero. The runtime does not produce the unselected fourteen-day
forecast.

V4 uncertainty bounds are nullable. The runtime records
`UNCERTAINTY_UNAVAILABLE` and does not reuse V1 random-forest residual bounds.
Both V1 historical rows and V4 runtime rows remain readable by explicit version.
Active-version reads select V4 only and do not silently fall back to V1.

Every result carries dataset, source/code/configuration/model, as-of, horizon,
input, and payload hashes. Runtime and coordination outputs remain
`SIMULATION_ONLY` with `DISABLED_UNAPPROVED_POLICY`.

## Synthetic surplus boundary

The only supported demonstration policy is the versioned synthetic configuration
`SYNTHETIC_OPTIMIZATION_V2_1`:

```text
horizon: 1 day
safety allowance: 2 units
minimum reserve: 10 units
surplus: max(0, floor(eligible available stock - forecast - 2 - 10))
```

Eligible stock is committed, available stock only. Reserved, expired, released,
compromised, and reconciliation-held units are excluded. Census snapshots are
immutable and bind source-surplus evidence to both `inventorySnapshotId` and a
canonical `sourceProjectionDigest`.

BROA remains human-review simulation only. It cannot approve or submit a
transfer. No runtime result supports clinical, operational, accuracy,
regulatory, or production claims; `RQ-07` and policy gates remain open.

## JOPIA accountable-owner checklist

JOPIA owns the branch, contract approval, workbook identity/hash verification,
worker/database/API/projection/census/chaincode/coordination integration,
privacy and replay/idempotency review, complete evidence recording, LAT’s
finalized OpenAPI handoff, and the focused PR. JOPIA obtains BUNO’s research
review before merge and records self-validation disclosure.

JOPIA does not retrain the study, acquire hospital data, implement frontend
code, resolve clinical policy, or claim clinical or production readiness.

## Issue #9 producer correction contract

The four BUNO corrections are authorized locally on `codex/ml-v4-forecast-corrections`,
based on verification revision `0729179`. The calculation and frozen research
release remain unchanged. No push or reviewer acceptance is implied.

Run identity binds institution, dataset/model versions, target, requested window,
origin/horizon, classification, status/reason and all five immutable lineage hashes
(dataset, code, configuration, model and input). Generation time and the derived
payload hash are excluded from identity; replay does not create another run.
Each forecast ID binds this run identity plus its blood type and component.

A supplied dataset path must be a readable file: hash its actual bytes, never a
release label or a silent fallback. Without a path, hash canonical allowlisted
in-memory observations (deterministic date/category/count rows, null as JSON null).
The input hash represents canonical normalized observations. File-byte changes
may identify a new evidence release even when normalized inputs match.

Resolve and validate origin/horizon before availability checks. An explicit pair
must be consecutive dates; either date alone determines the other. Otherwise use
the latest observed date, or the previous Asia/Manila day for empty history.
Input start/end denote the requested seven-day window ending at origin; the
input digest preserves the supplied evidence, including missing/null observations.
Require all 140 observations in that window. Future observations remain unavailable.
Null quantities produce `V4_HISTORY_UNAVAILABLE` with no forecast rows and are
persisted through the same producer command; null is never replaced by zero.
Invalid numeric/date/schema inputs still fail validation. Unavailable results
retain the resolved dates and cannot fall back to a success from another horizon.

The cross-institution integration check exposed a remaining V1-only constraint
on `demand_forecasts.institution_id`. Additive migration
`20260917100000000_bind-v4-forecast-institution-scope.js` aligns V4 storage with
its scoped producer: a composite foreign key binds each forecast to its run's
institution, while V1 runs remain restricted to `INST_MEDIATRIX`. Existing
migrations and historical rows are not rewritten. This is an application data
scope correction, not a new Fabric organization or an operational permission.
