# Lat J4 expiry frontend wiring — 2026-10-09

Classification: **SIMULATION_ONLY / LAT_LOCAL_VALIDATION**. Selected TP-08
remediation under BL-TST-01; J4, TP-JOP-D01/D02/D04, FR-03/08/09/12 and NFR-01.
Status: frontend implementation and synthetic browser regression PASS; retained
host deployment and live Fabric expiry verification **NOT_RUN — T0 gate**.

## Source and preservation

Fetched `origin/codex/jopia-uat-backend` and fast-forwarded
`codex/lat-uat-frontend` from `aecb1de` to
`46b01d19b9728b197e5e03b80a6f502a05f2b02c`. Source is
[PR35](https://github.com/luisantonioj/bloodledger/pull/35), the
[Jopia contract](../handoffs/JOPIA-TO-LAT-UAT-BACKEND-CONTRACT-2026-10-09.md)
and [OpenAPI V2](../../services/api/openapi-v2.json). No backend source,
chaincode, migration or policy was changed by Lat's implementation.

Validation used that backend revision plus the uncommitted frontend changes in
the retained working tree, including pre-existing user dashboard/design changes.
It is not a clean-commit or remotely published implementation result. Existing
changes and untracked dashboard/account-switcher files remain preserved. No
blanket staging, commit, push, reset or retained-host service restart occurred.

The scoped frontend changes are in the component contract/parser, operator action
mapping, inventory/record views, new expiry display/evaluation components, shared
mutation-error handling, transfer/local-release forms and their tests. Existing
browser component fixtures were updated with the required expiry field; other
pre-existing changes to `web.spec.ts` remain user work.

## Implemented behavior and evidence

| Acceptance criterion | Evidence / result |
| --- | --- |
| Server-computed expiry display | PASS: mandatory four-value enum is validated on list/detail reads; missing or unknown states fail closed. Both views display it separately from the ledger inventory status. Label-expired pending stock explicitly says not usable. No browser-clock inference or near-expiry policy was added. |
| Operator authorization | PASS: exact POST component expiry route maps to `inventory:expiry`. The action requires an own-custody AVAILABLE component with pending label expiry and an explicitly capable operator. Browser fixtures verify operator/body/key binding and absence without the capability. Backend enforcement remains authoritative. |
| Expiry request | PASS: sends only correlationId and expectedVersion from inventoryVersion, with the standard Idempotency-Key, V2.1 header and operator verification. No client evaluationTime/eventTime is sent. |
| Async command truth | PASS: 202 renders Accepted and queued, disables repeat submission and polls the bound command. Ledger-committed/projection-pending stays distinct from COMMITTED. Commitment refreshes detail/list and preserves the terminal command card. No optimistic EXPIRED transition. |
| Alerts and acknowledgement | PASS in HTTP-fixture browser evidence: committed projection appears as EXPIRED, then the existing V2 alert acknowledgement flow verifies its operator and refreshes acknowledged state. This is not a real ledger mutation result. |
| Reserved stock / conflicts | PASS: reserved pending-expiry stock has no Evaluate expiry action, points to cancelling its active reservation through an authorized workflow, and retains the linked reservation navigation. All seven documented immediate 409 codes have actionable messages and require a fresh read/review. |
| Rejected command time | PASS: transfer/local-release forms discard a 400 V2_COMMAND_TIME_OUT_OF_WINDOW attempt. Next manual submit creates fresh keys, correlation/resource IDs and eventTime (plus matching requestTime for transfers). Repetition mentions the device clock. No automatic resubmission. |
| Client versus transient errors | PASS: REQUEST_INVALID, REQUEST_BODY_TOO_LARGE and REQUEST_MEDIA_TYPE_UNSUPPORTED require correction; the forms disable the rejected intent until an input change. Ambiguous network/server failures preserve the exact body/key for replay. |
| Protected state | PASS: an actual HTTP 401 fixture during expiry clears the protected dialog/account data; existing logout, denied scope, missing/null resources and conflict/failure browser regressions pass. |

Cancellation controls for canonical reservations were already unconnected in the
frontend. J4 supplies cancellation guidance and reservation navigation; it does
not claim to implement that separate workflow. Reconciliation has no active
frontend form because its reason-policy boundary remains unresolved; no request
shape or reason code was invented. Jopia's same-key reconciliation replay fix is
integrated from PR35 and remains backend evidence.

## Reproducible checks

Native WSL Ubuntu-24.04, Node 24.17.0/npm 11.13.0, existing lockfile-installed
dependencies and Playwright Chromium. From the repository root with the pinned
Node bin directory on PATH:

| Command | Result |
| --- | --- |
| `npm run check:web` | PASS: TypeScript and Vite build |
| `npm run test:web` | PASS: 112 tests, 24 files, including existing uncommitted dashboard tests |
| `npm run test:web:e2e` | PASS final rerun: 91 passed, 7 deliberately retired V1 fixtures skipped, 98 selected (37.2 seconds) |
| `git diff --check` | PASS |
| `npm run scan:secrets` | PASS: Gitleaks 8.30.1, history/index/candidate content, no leaks |

The browser suite uses its isolated Vite preview on 4174 with synthetic HTTP
fixtures. It does not use retained 5174/3000 for acceptance and does not establish
Fabric commitment, preserved T0 counts or human UAT. The first browser run found
older component fixtures missing expiryState; they were corrected and the full
suite rerun. Only the verified leftover test preview on 4174 was stopped during
that rerun. No retained API, worker, frontend or ledger service was restarted.

## Deferred verification / Jopia completion message

Retained-host redeployment remains gated until **2026-10-11 16:00 Asia/Manila**,
after Buno's T0 verification window. Source changes are prepared; this report
does not authorize deploying them early. The frontend parser expects PR35's
required expiryState contract, so old-backend live behavior is not accepted as
the new contract's integration evidence.

J8 full regression, J9 controlled UAT dry run, real Fabric expiry submission,
real expired-alert acknowledgement and post-deployment durability remain
NOT_RUN. V4 stays default; V5, near-expiry, human UAT, physical OCR, full latency,
clinical/production/deployment claims and Testing-phase exit remain separate.

Completion summary below was expanded and posted to
[PR35](https://github.com/luisantonioj/bloodledger/pull/35#issuecomment-6083108209)
on the user's explicit instruction. The comment was read back and verified as
`Yuri-Benjamin-Lat`. The implementation remains local and uncommitted; no new
frontend PR was created.

> Jopia — Lat's J4 frontend wiring is implemented locally on
> codex/lat-uat-frontend over your PR35 commit 46b01d1. Inventory/detail expiry
> states, inventory:expiry operator verification, queued command polling,
> conflict messages and fresh-time/new-key handling are connected. Type/build
> and 112 web units pass; the full browser rerun passes 91 with seven retired V1
> fixtures skipped. Existing design work is preserved. No retained-host redeploy
> or domain mutation occurred; live Fabric expiry and J8/J9 remain deferred until
> after Buno's October 11 16:00 Manila T0 gate. See this validation report for
> scope, evidence and the uncommitted working-tree limitation.

2026-10-10 continuation: the prepared views and J4 work are published at
`4715941` in PR37 against backend `bf70eff`. Reservation cancellation and
reconciliation placement have since been connected; the above NOT_RUN and
unconnected statements describe the October 9 state. See
[LAT UAT frontend validation](LAT-UAT-FRONTEND-VALIDATION-2026-10-10.md) for current
scope, automated evidence and unchanged retained-host/UAT gates.
