# Lat post-merge read audit — 2026-10-15

Classification: **SIMULATION_ONLY**. Scope: FR-03/FR-12, TP-08 frontend remediation. Baseline: `main` at `12d21c0` (PR #54), after merged PRs #51–53. Validator: Lat, self-validation. Backend/OpenAPI/chaincode/migrations and live domain commands are outside this change.

Layout work is preserved separately on `codex/lat-layout-followups-20261015` at `ba2ae6d`; it is not included in this audit PR.

## Review of PR #54

Accepted the shared `retryAfterContextChange(read, active)` helper and inventory usage as merged. Inventory's request sequence is invalidated on refresh/unmount and supplied to both component and intake reads. The helper retries only the client `AUTH_CONTEXT_CHANGED` rejection, once, with a still-current caller. Principal-scoped pages remount on account changes. Success/error handlers retain their existing lifecycle and scope validation. No API wrapper receives an unconditional global retry.

One additional client issue was found: a real HTTP 401 arriving after an epoch change was previously converted to `AUTH_CONTEXT_CHANGED`. The client now preserves that server denial without logging out a newer session. A current-session real 401 still dispatches session-ended. Both cases are regression-tested, as are single retry, inactive callers, mid-flight invalidation and unchanged POST behavior.

Existing safe custom implementations in paged reads, live reads, coordination and automatic matching now use the shared helper for consistency. Live reads keep their existing transport backoff/polling; repeated context rejection does not cause an unbounded 250ms retry loop. Mutation requests are never passed to this helper.

## Direct read inventory

Read wrappers were traced to every production consumer using `rg` over `requestJson`, `fetch` and exported `read*` helpers. The only production raw `fetch` is in `services/api/client.ts`. **Changed** means this PR adds/consolidates retry handling; **Already safe** means an existing hook or #54 already protects it; **Not applicable** means no protected institution read or no mutation retry is introduced.

| Read / caller | Result | Current-request protection |
|---|---|---|
| `/components`, `/reports/inbound-intake` — `V2InventoryView` | Already safe (#54) | `requestSequence` matches, invalidated by refresh and effect cleanup |
| `/components/{id}`, `/reservations/{id}`, `/transfers` lookup — `V2RecordExplorer` | Changed | Effect closed flag + AbortController; preserves component/reservation/request validation |
| `/components` — dashboard `useStockEvidence` | Changed | Effect lifetime + latest sequence; own-institution/freshness validation unchanged |
| `/components` + `/transfers` request lookup — `RedistributionReview` | Changed | Each parallel GET guarded by allocation-effect lifetime; no reservation POST retry |
| V4/V5 active forecast — `ForecastCard` | Changed | Date/dataset/institution effect lifetime |
| Active forecast — retained `AnalyticsPreview` | Changed | Latest request ID; increments on date change/unmount |
| `/analytics/inventory-evidence` — `InventoryEvidencePanel` | Changed | Active effect; date/institution/revision key remains validated |
| `/reports/doh-census` list/cursor — `CensusDiscovery` | Changed | Abort state + latest generation; cleanup invalidates both |
| `/reports/doh-census` list/cursor — `ComplianceReports` | Changed | AbortController bound to principal/cursor/retry effect |
| Compromise/reconciliation reason policy — `ReasonSelector` | Changed | Effect closed flag + abort state; selection reset unchanged |
| `/commands/{id}` polling — `useCommandStatus` | Changed | Poll effect closed flag; full command identity verification unchanged |
| `/commands/{id}` and `?idempotencyKey=` manual recovery — `CommandRecovery` | Changed | Mounted caller; inputs locked during lookup; resource identity checked |
| `/commands?idempotencyKey=` ambiguous-attempt recovery — `useUatCommand` | Changed | Mounted caller + exact original attempt object; acceptance identity checked |
| RPS/BROA/source-surplus — `useCoordination` | Changed (already guarded custom retry) | Shared helper + existing AbortController |
| Automatic source-surplus/BROA series — `useRedistributionMatches` | Changed (already guarded custom retry) | Shared helper + effect AbortController; bounded series concurrency unchanged |
| `/unit-history` — Blood Unit Transactions | Already safe | `usePagedRead`; shared helper consolidation checks cursor generation + abort |
| `/transfer-summaries` — bank Transfers | Already safe | `usePagedRead`; reservation-key and institution scope validation retained |
| `/activity-history` — bank ROLE-02 Activity History | Already safe | `usePagedRead`; event identity/actor/status validation retained |

## Reads already covered by `useLiveData`

Each endpoint below already has cancellation, effect-generation and error guards. The hook now delegates its single context retry to the shared helper; callers do not add a second nested retry. A genuine 401 remains fatal and 403 remains an access error.

| Caller | Protected reads | Result |
|---|---|---|
| `FeatureRouter` | Authorized dashboard, transfers, audit, alerts, consortium and reports selected by existing endpoint map | Already safe |
| `DashboardPage` | Role-specific dashboard, permitted transfer requests | Already safe |
| `RequesterTransfersPage`, `V2TransferEvidenceView` | `/api/v2/transfers` | Already safe |
| Legacy `TransfersView` detail | Existing `/api/v1/transfers/{id}` | Already safe |
| `BloodUnitTransactionsPage` scanner request list | `/api/v2/transfers` while scanner open | Already safe |
| `BloodUnitReceiptPage` | `/api/v2/transfers` | Already safe |
| `AuditPage` legacy requester/regulatory view | Existing requester `/transfers` or role-authorized `/audit` | Already safe |
| `ObservedDemandAnalytics`, `RequesterAnalytics` | `/api/v2/transfers` | Already safe |
| `RegulatorAnalytics` | `/api/v2/reports/doh-census?limit=20` | Already safe |
| `ComplianceReports` cards/selected detail | `/api/v2/dashboard`, `/api/v2/reports/doh-census/{id}` | Already safe |
| `InstitutionRegulatoryView` | Dashboard and census list/detail | Already safe |
| `HistoricalStockView` | Historical snapshot list + selected detail/cursor | Already safe |
| `HospitalNetworkView` | Existing `/api/v1/consortium` | Already safe |
| `InstitutionAccountsView` / `InstitutionProfile` | Onboarding institution directory/profile/operators/application list | Already safe |

## Not applicable to institution read retry

| Operation | Result / reason |
|---|---|
| Initial `/api/v1/auth/session` GET in `App` | Not applicable: explicit epoch-exempt session bootstrap, before protected page/verifier mount; not a protected inventory read |
| Access/Login form session POST and logout DELETE | Not applicable: authentication transitions; never wrapped or replayed |
| Applicant-status GET after applicant login/withdrawal | Not applicable: separate pre-institution applicant session on the application screen; no institution verifier installs while it remains active; no new retry added |
| Applicant application/withdrawal/session POST/DELETE | Not applicable: writes, untouched |
| V2 submit helpers, legacy transfer commands, alert acknowledgement, account/operator administration, operator verification | Not applicable: POST mutations; untouched and not automatically retried |
| PRC Supply Requests | Historical audit disposition: unavailable at PR #55. RQ-17 is now decided as PA-DEF-06 / ADR-044; PR #57 supplies the backend. Lat-host migration/API activation and empty-list scopes are verified. Main UI stays unavailable pending draft UI PR #60 and delayed-replay review; populated live detail/actions remain unvalidated |
| PDF generation, static design previews, local image/camera previews | Not applicable: no backend read |

## Acceptance and evidence

- [Medix validation](https://github.com/luisantonioj/bloodledger/pull/52#issuecomment-6189519671): **complete — Jopia host**, at PR #52 head `595e689`; 16 summaries, 2 OCR receipts (1 CONFIRMED, 1 FAILED / Not committed), 18 activity events. This is Jopia's evidence, not a new Lat-host execution.
- ROLE-03 live check waived by Jopia: no Medix ROLE-03 login and Metrolipa has no transfers; backend tests cover scope. No account was reactivated or changed.
- Final read decisions: ADR-040 label identity, ADR-041 unit history, ADR-042 identifier vocabulary/transfer summaries, ADR-043 activity history. PR #53 resolves the prior numbering collision.
- `institution-inventory-first-load.spec.ts`: ordinary synthetic institution login on `/inventory`, verifier required, exact synthetic label within 2.5 seconds (before the 5-second poll), no refresh-error flash, no domain POST. Unit tests force the mid-flight verifier race and verify cancellation/denial behavior.
- `npm run check:web`: passed type check and production build; existing bundle-size warning only.
- `npm run test:web`: **295 passed / 41 files**.
- `npm exec --workspace @bloodledger/web -- vitest run src/styles/design-tokens.test.ts`: **2 passed** (also included in the unit suite).
- The affected browser selection below: **98 passed**, `--workers=1`. The expanded run also corrected stale accessible names in application/profile disabled-action tests and scoped expiry command-error assertions; the underlying disabled behavior, idempotency and correction assertions remain intact.

```bash
npm exec --workspace @bloodledger/web -- playwright test \
  institution-inventory-first-load.spec.ts pr51-table-contracts.spec.ts \
  defense-analytics.spec.ts dashboard-inventory-overview.spec.ts \
  inventory-table-presentation.spec.ts expiry-wiring.spec.ts uat-workflows.spec.ts \
  requester-transfers.spec.ts regulatory-alerts.spec.ts institution-profile-accounts.spec.ts \
  access-application.spec.ts operational-navigation.spec.ts initial-page-layout.spec.ts \
  activity-history-columns.spec.ts --workers=1
```

- `npm exec --workspace @bloodledger/web -- playwright test testing-phase.spec.ts --grep 'issue36 census discovery' --workers=1`: **1 passed** (cursor paging + access denial). Total: **99 browser cases** across the two commands.
- `npm run scan:secrets`: **passed** Git history, staged index and tracked/candidate content.
- `git diff --check`: passed. No backend or runtime-policy files changed.

No live domain commands, backend modifications, account changes, reset, population, census or forecast rerun. RQ-02 remains open. RQ-17 is resolved for simulation by PA-DEF-06 (`SYNTHETIC_PRC_SUPPLY_V1`), ADR-044 (PR #56); PR #57 merged its off-chain backend. Subsequent Lat-host rollout and read-only scopes are verified below; frontend integration is draft PR #60, with populated live detail/actions still unvalidated. No clinical, regulatory, production or ISBT 128 acceptance is claimed.


## PRC implementation prerequisite update — 2026-10-15

This supersedes the audit's earlier RQ-17/no-contract note. PR #57's merged OpenAPI is authoritative for PRC list/detail and synchronous actions. Jopia confirmed his migration at 2026-10-15T02:54:52Z (10:54 Asia/Manila); his persistent API remains stopped on older code.

With Jopia's explicit authorization, Lat separately took a private backup, verified the PRC migration was the sole pending migration, applied the documented migrator (31 applied/1 pending → 32 applied/0 pending), and compared every existing app table count unchanged. Local counts are 532 components, 595 commands and 1 account-audit row; new PRC requests are empty. The API was rebuilt from merged main and restarted: health READY. Guarded UAT worker restored after the queue check; general sync-worker stays stopped.

Ordinary bank/PRC sign-in list reads return 200, scopes INSTITUTION/PRC_ALL, zero rows and null cursors. A synthetic missing ID returns 404 PRC_SUPPLY_NOT_FOUND. Populated live detail remains unvalidated because no requests exist; no live domain action was executed. Main UI remains unavailable until the separate connected UI PR #60 merges. That draft PR contains full fixture validation, screenshots and a source-reviewed backend delayed-replay finding for Jopia; it does not change backend code or policy. Live PRC actions still require explicit go-ahead. Policy remains simulation-only, not PRC or Mediatrix policy.
