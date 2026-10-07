# Testing-phase requirement traceability

**Status:** Scoped frontend regression and remediation complete; overall Testing phase remains in progress.
**Owner:** Lat; Codex-assisted self-validation. **Classification:** SIMULATION_ONLY.
**Selected work:** BL-TST-01, TP-01/TP-03/TP-08.
**Starting implementation:** `0f2f1f42d735f606aabf1a754bb6cca261b117e4`.
**Branch:** `codex/lat-testing-traceability`.

The [Testing phase](TESTING-PHASE.md) controls scope and gates. This register
indexes scoped evidence; it does not promote a passing UI slice into a complete
requirement or close Testing-phase acceptance. The requirements remain in
[REQUIREMENTS](REQUIREMENTS.md). Execution details remain in the linked validation
records; defect dispositions have their home in [TESTING-DEFECTS](TESTING-DEFECTS.md).
Only PASS, FAIL, BLOCKED and NOT_RUN describe test results. Prior-owner evidence
is explicitly prior evidence, never a new Lat rerun.

## Evidence sources

| ID | Owner/executor | Revision/source | Boundary |
|---|---|---|---|
| TP-E01 | Sprint 5 owners, prior accepted evidence | [Sprint 5 review](SPRINT-05.md#8-review-record), accepted merge `7c87c67`, tag `sprint-05-accepted-2026-08-24` | Accepted prototype baseline; not a current rerun |
| TP-E02 | Jopia, prior self-validation | [Sprint 6 validation](SPRINT-06-VALIDATION.md) | API/database/Fabric recovery; contemporaneous browser block remains historical |
| TP-E03 | Jopia, prior self-validation | [PR 21 follow-up](ML-V5-PR21-JOPIA-VALIDATION.md), implementation `f13c2b0c2a69662d85b91a0bbd59e748f5944b0f` | Isolated V5 producer/cookie/browser success, synthetic projection fixture |
| TP-E04 | Lat, earlier session self-validation | [Lat incorporation](frontend/VALIDATION.md#lat-pr-22-incorporation-review--2026-10-07), `0b7833e88bd7f4b192cb25cb23ba14645fbc1257`, focused harness `a409188dd31843f709408074bbf0f2e14450d633` | 106 API / 59 web / 19 coordination / 14 capture; 43 mocked browser passes / 7 skips; disposable database; real V5 BLOCKED |
| TP-E05 | Buno, prior ML review | [V5 Buno review](ML-V5-BUNO-REVIEW.md), PR 20 approval at `dfffe8aba7d02b0d109b2dbd27e240ddcbeb11d9` | Frozen calculation/model review, not operational accuracy or current browser evidence |
| TP-E06 | Lat, current self-validation | [Frontend regression record](frontend/VALIDATION.md#lat-testing-phase-frontend-regression--2026-10-07); starting commit `0f2f1f4`, working-tree changes | 14 focused mocked browser cases PASS; scoped evidence only |

## Current frontend scenario selection

The following cases target coverage gaps rather than replacing retired V1
mutation fixtures. They use mocked HTTP with distinct synthetic identifiers.

| Test ID | Requirements/rules | Expected boundary | Result |
|---|---|---|---|
| TP-LAT-001 | FR-03/12, NFR-11 | Inventory contract switches clear prior counts; late response cannot restore the wrong selection; narrow viewport usable | PASS (TP-E06) |
| TP-LAT-002 | FR-03/12, BR-SEC-01 | Foreign component evidence is rejected and clears the invalid projection | PASS (TP-E06) |
| TP-LAT-003 | FR-03/09/12, NFR-11 | Inventory/alert/report refresh 401/403 clears restricted evidence | PASS (TP-E06) |
| TP-LAT-004 | FR-09, NFR-10/11 | Transient alert/report refresh error labels preserved data and exposes safe retry | PASS (TP-E06) |
| TP-LAT-005 | FR-05/11/12, NFR-01/11 | Canonical V2 request validates quantity, retries same keys/body, preserves recipient scope, renders failure/conflict without resubmission | PASS (TP-E06) |
| TP-LAT-006 | FR-11/12, NFR-10 | Command status cannot switch identity/resource on an unrelated response | PASS (TP-E06) |
| TP-LAT-007 | NFR-09/11 | Reporting explains existing scoped census discovery and remaining capture/export gates accurately | PASS (TP-E06) |

## Incomplete acceptance

The V5 pinned model/image availability blocker was resolved by the verified
transfer and [Lat real rerun](frontend/VALIDATION.md#lat-verified-runtime-transfer-and-real-v5-rerun--2026-10-07).
Full Fabric-to-browser NFR-06, physical Android OCR,
RQ-07/RQ-14, onboarding activation and human UAT remain unchanged. No new binding,
clinical rule, deployment, operational recommendation or phase exit window is
approved by this register.
