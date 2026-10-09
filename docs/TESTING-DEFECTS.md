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

## Jopia backend findings — 2026-10-09

**Owner:** Jopia (self-validation disclosed). Source review and live retained-host
observation; synthetic reproductions only. Contract and reruns:
[UAT backend contract note](handoffs/JOPIA-TO-LAT-UAT-BACKEND-CONTRACT-2026-10-09.md).

| ID | Discovered | Severity/owner | Requirements | Source observation / expected behavior | Status/evidence |
|---|---|---|---|---|---|
| TP-JOP-D01 | 2026-10-09 | Medium / Jopia | FR-12, NFR-10 | Framework 4xx errors (empty/malformed JSON, 413, 415) returned `500 INTERNAL_ERROR`; a JSON-typed bodiless logout was not revoked. Expected stable 4xx codes | Fixed on `codex/jopia-uat-backend`; request-rejection tests PASS |
| TP-JOP-D02 | 2026-10-09 | High / Jopia | FR-01/02/06/08, NFR-05 | V2 commands accepted any client `eventTime`/`requestTime`; backdating could reserve label-expired stock or inflate RPS wait. Expected server-clock bound with replay and approved-population exemptions | Fixed on `codex/jopia-uat-backend`; command-time-window tests PASS |
| TP-JOP-D03 | 2026-10-09 | High / Jopia | NFR-09/12 | After a Docker Desktop restart the stopped peer could not remount its Docker socket, taking the ledger down. Expected `start` to recover only the peer with volumes preserved | Recovered on Jopia's host (height 1158, volumes unchanged); `start` recovery and operations test PASS |
| TP-JOP-D04 | 2026-10-09 | High / Jopia; display Lat | FR-08/09, BL-INV-03 | No V2 path submits `EVALUATE_COMPONENT_EXPIRY`; label-expired units stay `AVAILABLE` in reads and the EXPIRED alert list stays empty. Chaincode FEFO already excludes them | API fixed on `codex/jopia-uat-backend` (`expiryState` + `POST /components/{id}/expiry`); component-expiry tests PASS; Lat UI and live Fabric NOT_RUN |
| TP-JOP-D05 | 2026-10-09 | Medium / Jopia | FR-05, NFR-09 | `POST /api/v2/transfers` is implemented but absent from `openapi-v2.json` | Fixed on `codex/jopia-uat-backend`: `POST /transfers` documented with `TransferRequest`; the reasons read moved to `/reconciliation/reasons` (issue #36) |
| TP-JOP-D06 | 2026-10-09 | Low / Jopia | NFR-09 | `tests/inbound-ocr/static-boundary.sh` requires the former branch name, so it fails on every other branch | Fixed: branch guard applies only on its original branch; content checks run everywhere and allow explicit `donationNumber: null`; a planted leak is still caught |
| TP-JOP-D07 | 2026-10-09 | Medium / Jopia | FR-06/07 | V2 RPS/BROA functions exist in `services/coordination` but no API exposes their read-only explanation for V2 requests | Open; optional before UAT |
| TP-JOP-D08 | 2026-10-09 | Medium / Jopia | FR-12, NFR-05 | A retry of `POST /api/v2/reconciliation` with the same key and body returned `409 V2_IDEMPOTENCY_CONFLICT`, because the server event time changed the command digest. Expected an exact replay | Fixed on `codex/jopia-uat-backend`; reconciliation retry test failed before and PASSES after |
| TP-JOP-D09 | 2026-10-09 | High / Jopia | FR-10/11, NFR-05 | Live J5 OCR receipt of in-transit stock failed at `RecordInboundReceipt` with `CORE_FIELD_NOT_ALLOWED`: the projection-only `captureId` reached the ledger payload. Expected only the chaincode's exact fields | Fixed in `d8cb0c3`; route regression fails before and passes after; live receipt committed ([J5 record](handoffs/JOPIA-J5-LIVE-CUSTODY-REHEARSAL-2026-10-09.md)) |
| TP-JOP-D10 | 2026-10-09 | Medium / Jopia | FR-12, BR-INV | The operator allowlist names `POST /reconciliation/{id}/resolve` but no route exists, so a reconciliation hold cannot be released | Deferred by Jopia on 2026-10-09: UAT places holds only; releasing needs an approved resolution list |
| TP-JOP-D11 | 2026-10-09 | High / Jopia; Lat host | FR-12, NFR-01 | Retained runtimes installed before the patch still run `fast-jwt` 6.3.2 (GHSA-x937-hj6v-793p) until `npm ci` | Fixed on Jopia's host by the J5 redeploy; Lat's host pending its post-T0 redeploy |
| TP-JOP-D12 | 2026-10-09 | High / Jopia | FR-01, NFR-09 | Retained hosts did not serve the capture PWA (`/capture/` returned 404: no `CAPTURE_PWA_DIST`, no build), so the UAT synthetic-scan step could not run | Fixed in `21f21f2`: `start-local.sh` builds and serves it; validated on Jopia's host (200 on API and web origins, environment hash unchanged) |

TP-JOP-D02's bound is 300 seconds. A fresh persistent development seed applied
more than five minutes after its preview is rejected without queuing; both
retained hosts are already seeded.
