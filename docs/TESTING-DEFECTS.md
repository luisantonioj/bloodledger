# Testing-phase defect register

**Owner:** Lat. **Classification:** SIMULATION_ONLY.
[Testing phase](TESTING-PHASE.md) controls acceptance; [traceability](TESTING-TRACEABILITY.md)
links scoped evidence. Existing defect IDs remain stable; this register links
prior dispositions instead of duplicating their authoritative records.

## Prior resolved findings

- `LAT-V5-01` — current dependency advisory, fixed by `dbea2ec`.
- `LAT-V5-02` — missing V5 prerequisites misclassified, fixed by `a409188`.

Source and exact reproduction/reruns:
[Lat PR 22 incorporation record](frontend/VALIDATION.md#lat-pr-22-incorporation-review--2026-10-07).
These prior results are not freshly rerun here.

## Current findings and remediation

| ID | Discovered | Severity/owner | Requirements | Source observation / expected behavior | Status/evidence |
|---|---|---|---|---|---|
| TP-LAT-D01 | 2026-10-07 | Medium / Lat | FR-03/12 | V2 inventory requests have no response-order/selection guard; previous data remains while selection changes. Selected view must clear mismatched evidence and reject late responses | Fixed; TP-LAT-001 PASS |
| TP-LAT-D02 | 2026-10-07 | High / Lat; API authorization remains Jopia | FR-03/09/12 | Inventory and generic refresh failures preserve data even after 401/403. Access-denial must clear restricted evidence; foreign inventory rows must fail closed | Fixed; TP-LAT-002/003 PASS |
| TP-LAT-D03 | 2026-10-07 | Medium / Lat | FR-09, NFR-10/11 | Non-dashboard FeatureRouter paths omit refresh error presentation when prior data exists. Preserved data must have visible unavailable/stale context and retry | Fixed; TP-LAT-004 PASS |
| TP-LAT-D04 | 2026-10-07 | Medium / Lat; backend identity remains Jopia | FR-11/12 | readCommand accepts any valid command envelope from the requested URL; command/resource identity must remain bound to the accepted command | Fixed; TP-LAT-006 PASS |
| TP-LAT-D05 | 2026-10-07 | Low / Lat | NFR-09/11 | ReportView says no census index exists and copy order is unapproved; Sprint 6 records scoped discovery and a synthetic column-order decision. UI must preserve capture/export deferrals without claiming those contracts are absent | Fixed; TP-LAT-007 PASS |

Findings originated in source review. The focused post-fix browser rerun passed all 14 cases; [the validation record](frontend/VALIDATION.md#lat-testing-phase-frontend-regression--2026-10-07) distinguishes diagnostic execution from final evidence.
No clinical/privacy data is used in reproductions. Backend/API responses remain
responsible for actual authorization; frontend clearing and rejection are defense
in depth. Technical records cannot authorize clinical use or close UAT.

## Remediation boundary

- D01: clear counts, intake and freshness on contract changes; ignore superseded
  requests and remount inventory when the authenticated owner scope changes.
- D02: clear inventory/intake after 401/403 or invalid/foreign component evidence;
  clear shared feature data after 401/403. Transient errors may preserve evidence.
- D03: display refresh failure, preserved-data context and an explicit retry on
  non-dashboard feature views.
- D04: bind status URL and command ID at the reader; bind resource type/ID,
  correlation and acceptance time in polling; ignore responses after cleanup.
- D05: describe existing scoped census discovery and synthetic display order,
  preserving unavailable capture/copy/export.

TP-LAT-005 required fixture corrections: use the component combobox's accessible
name and include the existing contract's `urgency` field in the expected payload.
Both retry cases pass without changing the request implementation.

## Fix revisions

TP-LAT-D01–D05 are fixed in `71c91af`; source and browser scenario hashes are
recorded in the frontend validation record. The final runtime rerun tests
`b5601cc` and is recorded by `467b146`. PR #23's executable preflight patch
`60fd148` is incorporated as `d0ceeed`; its evidence-only commit `daf5a0c` is
incorporated as `b5601cc`, preserving Jopia authorship. No new application
defect was found in the real rerun.
