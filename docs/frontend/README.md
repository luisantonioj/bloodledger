# Frontend Migration Register

This directory records how the approved BloodLedger UI reference is migrated
into the official application. It is tracking evidence, not a second
requirements or architecture source.

## Source roles

- `docs/DESIGN.md` is authoritative for reviewed visual tokens and rationale.
- `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, accepted ADRs, OpenAPI, and
  database/ledger contracts control behavior and implementation.
- The [frontend mockup](https://github.com/luisantonioj/bloodledger-frontend)
  supplies selected visual and interaction references identified in
  `MOCKUP_REFERENCE.md`.
- [Google Labs DESIGN.md](https://github.com/google-labs-code/design.md/tree/main)
  supplies the document format and validator only.

Do not copy the prototype runtime architecture, global state, mock credentials,
fixture data, topology claims, or browser-only writes.

## Registers

- `MOCKUP_REFERENCE.md` — immutable selected-source hashes and exclusions.
- `COMPONENT_MIGRATION.md` — shared visual primitive mapping and evidence.
- `PAGE_MIGRATION.md` — selected/deferred page mapping and API dependencies.

An entry is complete only when the official implementation, applicable tests,
and review evidence are recorded. A visually similar mockup is not completion.
