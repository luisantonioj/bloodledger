# [Frontend] Integrate Sprint 6 V2/OCR workflows and ML V4 contracts

**Implementation status:** Contract-based frontend work implemented on
`codex/s6-frontend-integration`; live integration and human UAT remain open.

## Purpose

Track the frontend integration work created by the Sprint 6 backend, inbound
OCR, V2/V2.1, and ML V4 contract changes reviewed in Issue #9.

The BloodLedger mockup visual migration is a separate completed body of work.
This issue covers API integration, truthful asynchronous workflow states,
privacy-safe rendering, accessibility, and browser UAT. All behavior remains
`SIMULATION_ONLY`.

Detailed review and acceptance guidance:

- `docs/LAT-S6-FRONTEND-HANDOFF.md`
- `docs/SPRINT-06.md`
- `docs/INBOUND-OCR-REGISTRATION.md`
- `services/api/openapi-v2.json`
- `BloodLedger_LAT_ML_V4_Frontend_Handoff_UPDATED.md` supplied to LAT on
  2026-09-17

## Current frontend state

- Capture PWA submits confirmed OCR intake to `POST /api/v2/inbound-captures`
  and polls the returned command status.
- V2 inventory reads, intake status, ROLE-03 transfer requests, and ROLE-01/02
  local releases are integrated in the main web workspace.
- Active ML V4 Analytics is contract-backed and rejects unsupported datasets,
  models, and series.
- Reservation actions, reconciliation, and census remain visibly unavailable
  where the required read contract or approved policy input is missing.
- Offline V2 submission remains blocked because the exact Donation No. cannot
  be persisted and no approved secure replay mechanism exists.
- The forecast endpoint still requires legacy bearer authentication while the
  web workspace uses the official session cookie; the live UI reports this gap
  without fabricating data.

## Confirmations used for implementation

### JOPIA — backend and integration confirmation

Please confirm:

1. The exact commit, branch, or pull request that LAT must use as the stable
   integration baseline for Sprint 6 V2/V2.1 and ML V4 API work.
2. That the final component read shape is
   `{ scope, components, classification }` and identify any remaining OpenAPI
   corrections before a frontend consumer is built.
3. The final asynchronous command envelope, `statusUrl` behavior, status
   transitions, idempotency requirements, polling expectations, and safe error
   codes.
4. The final request/response bodies, canonical actions, role permissions, and
   safe failure states for transfers, local releases, and reconciliation.
5. The approved inbound OCR issuer allowlist and the safe issuer display names
   the frontend may show. Also confirm that receiving custody must always be
   derived from the authenticated session and cannot be selected by the user.
6. Which V2/V2.1 requests require
   `X-BloodLedger-Contract-Version: V2.1`, including the required behavior for
   `CRYOPRECIPITATE`.
7. That component, census, and intake-status reads do not expose decrypted
   Donation No., unrestricted OCR text, patient data, or donor data.
8. Whether contract-based frontend implementation may proceed before the final
   producer-to-database-to-API and real-Fabric evidence, with those items kept
   as explicit blockers for final end-to-end acceptance.

### BUNO — forecasting and research confirmation

Please confirm:

1. The accepted commit and re-review status for the four remaining forecasting
   corrections:
   - institution and immutable run lineage in forecast identity;
   - hashing actual dataset evidence and rejecting nonexistent supplied paths;
   - persisting unavailable attempts for null observations without zero
     imputation; and
   - preserving requested origin and horizon for unavailable results.
2. That the default frontend request omits `datasetVersion` to select
   `SYNTHETIC_FORECAST_V4_RUNTIME_V1`, and that V4 uses a one-day horizon.
3. That the active V4 display matrix is the documented four positive blood
   groups by five components, up to twenty returned series, with
   `PACKED_RED_BLOOD_CELLS` as the active V4 red-cell value.
4. The final meanings and display expectations for `CURRENT`, `STALE`,
   `UNAVAILABLE`, `forecastStatus`, `stale`, and `unavailableReason`.
5. That null lower/upper forecasts must be presented as uncertainty unavailable
   and must never be converted into zero or an invented confidence band.
6. Whether the first frontend implementation should expose an explicit
   historical V1 selector or support active V4 only. No silent V1 fallback will
   be implemented.
7. The approved human-readable model/provenance wording that preserves the
   simulation-only research boundary without implying clinical or operational
   accuracy.

## Implementation scope after confirmation

### 1. Inbound OCR Capture PWA

- Migrate submission to `POST /api/v2/inbound-captures`.
- Build the confirmed `InboundOcrCapture` payload.
- Require explicit operator review and confirmation.
- Preserve original event, correlation, and idempotency evidence during offline
  synchronization and retry.
- Keep raw images and unrestricted OCR text volatile and out of requests,
  IndexedDB, logs, screenshots, reports, and fixtures.

### 2. Asynchronous command presentation

- Poll the backend-provided `statusUrl`.
- Render `QUEUED`, `SUBMITTING`, `RETRY_WAIT`,
  `LEDGER_COMMITTED_PROJECTION_PENDING`, `COMMITTED`, `FAILED`, and `CONFLICT`
  truthfully.
- Never present command acceptance as ledger commitment.
- Keep pending, failed, and conflicted intake separate from committed inventory.

### 3. Inventory and census integration

- Consume the corrected component envelope and approved role/institution scope.
- Integrate component, intake-status, inventory, and census reads.
- Preserve unavailable, held, failed, and conflicted states rather than
  converting them to zero or available inventory.
- Apply V2.1 only where required by the final contract.

### 4. Transfer, local-release, and reconciliation integration

- Use the final V2 command contracts and canonical action names.
- Show only controls allowed for the authenticated role and institution.
- Represent pending, committed, failed, and conflicted outcomes accurately.
- Do not allow RPS, BROA, or forecasts to submit or approve transfers.

### 5. ML V4 Analytics integration

- Parse the response as an envelope object containing `forecasts`.
- Request active V4 by default without silently falling back to V1.
- Render only returned supported series.
- Make `CURRENT`, `STALE`, and `UNAVAILABLE` visually distinct.
- Keep missing values and null uncertainty visibly unavailable.
- Display dataset, model, as-of date, horizon date, classification, and disabled
  recommendation eligibility as provenance.

### 6. Frontend validation

- Add unit tests for contract parsing, status mapping, unavailable semantics,
  role scope, and privacy-safe rendering.
- Add browser tests for OCR confirmation, offline/retry behavior, command
  polling, component/census views, workflow permissions, and all forecast
  states.
- Use synthetic fixtures only.
- Verify that restricted values do not appear in UI, browser storage, logs,
  screenshots, or fixtures.

## Acceptance criteria

- [x] JOPIA records the stable integration baseline and answers the backend
  confirmations above.
- [ ] BUNO human research re-review remains pending; the merged technical
  corrections and active runtime contract were used without making an accuracy
  claim.
- [x] Capture PWA uses the approved V2 inbound OCR contract and explicit
  operator confirmation.
- [x] Raw images and unrestricted OCR text are not persisted or transmitted.
- [x] Receiving custody cannot be overridden by the client.
- [x] Every asynchronous command state is represented truthfully.
- [x] Pending, failed, and conflicted intake is excluded from committed
  inventory.
- [x] Component reads parse `{ scope, components, classification }`.
- [ ] Inventory and connected workflows preserve role/institution scope; census
  remains blocked by the missing snapshot index and unapproved DOH order.
- [x] V2.1 is used only where required, including approved
  `CRYOPRECIPITATE` behavior.
- [ ] Transfer request and local release match the accepted roles/contracts;
  reservation actions and reconciliation remain disabled for the documented
  contract/policy gaps.
- [x] Forecasts distinguish `CURRENT`, `STALE`, and `UNAVAILABLE`.
- [x] Missing forecasts and null uncertainty never become zero values or
  invented bounds.
- [x] Forecast provenance and `SIMULATION_ONLY` limitations remain visible.
- [ ] Automated frontend checks pass; human browser UAT and live cross-owner
  integration evidence remain pending.
- [ ] Final live integration evidence is rerun after BUNO's fixes and JOPIA's
  accepted backend baseline are available.

## Out of scope

- Implementing or approving BUNO's forecasting corrections.
- Changing backend persistence, projections, Fabric recovery, or privacy
  enforcement.
- Creating clinical thresholds, issuer policies, reserve rules, or operational
  decisions that have not been approved.
- Autonomous clinical decisions or transfer submission/approval by forecasts,
  RPS, or BROA.
- Claims of clinical validity, regulatory approval, operational forecast
  accuracy, real consortium deployment, or production readiness.

## Ownership

- **LAT:** frontend implementation, visual behavior, accessibility, and browser
  UAT.
- **JOPIA:** backend contracts, persistence, projections, command recovery,
  privacy enforcement, integration baseline, and API evidence.
- **BUNO:** forecasting corrections, method/lineage confirmation, research
  interpretation, and forecasting re-review.
