# Jopia → Lat: Thesis 2 panel revisions (2026-11-03)

Status: in progress. SIMULATION_ONLY. Jopia (backend) and Lat (frontend) work in
parallel; Buno's forecasting revision is reported done and is being verified by Jopia.
Panel form: Google Doc `1P-FDfdQWkODuzrzM5MbHxNDBQ1jQvfsXhdQUAqERzJI`. Final IMRAD
manuscript: Google Doc `1--PKwbCks5GUs6Y9JxzWu20QJ8mjg4LymneHhEDi_rQ`.

## Base and branches

- Integration branch: `codex/panel-revisions-integration`, created from
  `codex/jopia-defense-day-20261021` @ `0bfb6da` (PR #102, everything from Jopia's laptop).
- Work on `codex/lat-panel-<topic>` / `codex/jopia-panel-<topic>` branched from the
  integration branch; open PRs **into the integration branch**, not `main`. The other
  role reviews. One PR from the integration branch to `main` at the end.
- Rebase on the integration branch before opening a PR. Push at the end of every session.

## Contract (authoritative: `services/api/openapi-v2.json`; decisions PA-REV-01/02, ADR-053)

No chaincode change and no lifecycle upgrade. Backend work lands behind this contract.

| Change | Shape |
|---|---|
| Partial approval (PA-REV-01) | `POST /api/v2/reservations` may add `approvedQuantity` (1..requested) **and** `partialReasonCode` together. `selectedComponentIds` must hold exactly `approvedQuantity` FEFO units. Reason codes: `INSUFFICIENT_ELIGIBLE_STOCK`, `LOCAL_RESERVE_PROTECTED`, `OTHER_OPERATIONAL`; `null` for a full approval. Error `400 PARTIAL_APPROVAL_INVALID`. Without both fields the old full-quantity rule applies. The remainder closes as a shortfall. |
| Reservation read | New required fields `requestedQuantity`, `approvedQuantity`, `shortfallQuantity`, `partialApproval` (`{reasonCode, policyVersion}` or null), `receiptDiscrepancy` (see below or null). Older reservations return `approvedQuantity`/`shortfallQuantity` null. |
| Receipt discrepancy (PA-REV-02) | `POST /api/v2/reservations/{reservationId}/receipt-discrepancy`, same body as `receipt-verifications`, `Idempotency-Key` and `Operator-Verification` headers. Returns `ReceiptDiscrepancy` (`discrepancyId`, counts, `status` OPEN/RESOLVED, `resolutionCode` RECOUNT_MATCHED/COMPROMISED). Errors: `409 RECEIPT_LABELS_MATCH` (nothing to dispute), `409 RECEIPT_DISCREPANCY_OPEN`, `409 RECEIPT_DISCREPANCY_IDEMPOTENCY_CONFLICT`, plus the receipt-verification errors. While OPEN, `receive` returns `409 RECEIPT_DISCREPANCY_OPEN`. |
| Expired units | Already in `GET /api/v2/dashboard/summary` as `inventory.labelExpiredPendingEvaluation`. |

Contract questions go in the status log below, not in code. Neither side changes the
contract alone.

## Ownership

| Jopia | Lat |
|---|---|
| `chaincode/`, `services/`, `database/`, `network/`, `scripts/`, `tests/`, OpenAPI, `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/validation/`, `docs/research/` | `apps/web/src/**`, `apps/web/e2e/**`, `docs/DESIGN.md`, `docs/frontend/` |
| Reviews shared parsers in `apps/web/src/services/api/*` | Edits shared parsers |

## Panel split

- **Jopia:** RPS/BROA sensitivity study (Franze #2, Cruzette #3); bounded workload and
  resilience experiment (Franze #6); request-to-receipt evidence (Franze Q2); partial
  approval and receipt discrepancy backend (Dean Cherrie #2, Franze Q3); expiry evaluator
  on by default in development; PIN/session wording; Buno verification; manuscript
  backend, custody, test-result, Discussion Q1/Q3 and Recommendations text.
- **Lat:** see the prompt in Jopia's reply (items a–h): expired card, partial-quantity
  field, DOH report heading (needs the team's sample DOH report), inbound/outbound check,
  discrepancy UI, PR #102 follow-ups, review of `dda543b`, Figs 15–19 screenshots,
  frontend manuscript text.

## PR #102 follow-ups for Lat

- The "Committed" banner blocks choosing the next reservation action until dismissed.
- The supplier summary shows requester details as "Not available".
- The requester Transfers row is not clickable.
- The receipt dropdown shows raw reservation IDs.

## Host differences (do not treat either as the other's baseline)

| | Jopia host | Lat host |
|---|---|---|
| Operator PIN | 6 digits (`SYNTHETIC_OPERATOR_PIN_6_V1`, applied 2026-10-21) | 6 digits (`SYNTHETIC_OPERATOR_PIN_6_V1`) |
| Data | V5 population (1,060 units) | Lat's dataset |
| Ledger | `tc-remediation-v1` | sequence 8 (staff build) |

Lat uses Playwright route mocks for PA-REV-01/02 until Jopia's backend PR merges.

## Not carried over from Jopia's laptop

Old local-only branches (`codex/jopia-lat-population-handoff`,
`codex/jopia-outbound-confirm-20261021`), a V4 scenario worktree and an old stash are
superseded and stay local. Private material (`build/defense-demo/`,
`build/operational-stock-private-v5/`, runtime `.env`, `~/bloodledger-handoffs/`) is
never committed.

## Status log

- 2026-11-03 Jopia: integration branch and contract published.
- 2026-11-03 Jopia: PA-REV-01/02 backend on `codex/jopia-panel-backend` (API 251/251; disposable-database probe 35 assertions, harness 330). No chaincode change. Lat can switch from mocks once it merges into the integration branch.
- 2026-11-03 Jopia: PR #103 merged into the integration branch (`0712f05`, self-validated). Lat can use the real backend after `npm run migrate:up` (migration `20261103000000000`). Sensitivity study PR #104 open. Workload experiment written (`ce4e007`, guarded) but not run: the host peer is stopped and the run needs owner approval.
- 2026-11-04 Jopia: PIN decision — the manuscript states six digits (owner decision). Both hosts already run `SYNTHETIC_OPERATOR_PIN_6_V1`; the code default for a fresh host stays eight. Jopia manuscript edits applied to the final IMRAD as suggestions (not accepted); Lat edits only frontend sections.
