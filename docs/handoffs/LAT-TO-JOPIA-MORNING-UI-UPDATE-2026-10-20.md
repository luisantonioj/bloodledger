# Lat → Jopia: morning UI update — 2026-10-20

SIMULATION_ONLY. Scope: the user-selected morning batch, from the requester dashboard/form review through the stable Refresh controls (identified by the user as 06:33–07:06 Asia/Manila). Message timestamps were not independently verified. Self-validation: Lat agent implementation and automated checks; no independent teammate review claimed.

## Source and integration

- Branch: `lat-sync-20261020`.
- UI commit: `6856c283b85bffb9fc72f785fc0abde0e7a3f511`.
- Parent/demo-source baseline: `56d55770ac95738516ee937f183f51856e26f549` on `codex/jopia-tc-remediation`.
- A following docs-only commit adds this handoff. No PR was requested or created for this batch.

Fetch `origin/lat-sync-20261020` and inspect the UI commit before integration. If your branch already contains the demo baseline, cherry-pick `6856c28` to take just these UI changes; carry this handoff separately if needed. Do not replace your newer source or reset unrelated work. Preserve the saved layouts and scanner implementation.

## What changed

1. Removed the Expiry alerts panel from requester, PRC and DOH dashboards. PRC retains its existing Alerts tab, which reads the same `/api/v2/alerts` expired-unit network aggregates. No alert records or permissions were removed.
2. Blood Requests badge remains visible when switching to PRC Supply Requests or Transfers. The shared `/api/v2/transfers` read stays active for the mounted page instead of being set to null on the PRC tab. This preserves polling, errors and existing access-denial handling; the badge is a returned request-row count, not a newly defined complete-count contract.
3. Refresh buttons keep a stable label, width and opacity while reads run. Shared controls replace inline variants in Dashboard, requester Requests & Transfers, Blood Unit Receipt and requester Analytics. Busy disabling and `aria-busy` remain; automatic polling and mutation behavior are unchanged.

## Requester review: follow-up remains open

The review did not enable the primary requester submission form or add backend fields. The current API supports basic requests to an explicit source blood bank. The primary requester form instead displays pending automatic assignment and deliberately blocks submission (GAP-05).

Jopia follow-up: establish the routing decision/contract, or coordinate an explicitly accepted source-selection workflow with Lat. Requester/clinical details (GAP-01), authorized pickup (GAP-02), supporting documents (GAP-03) and notes (GAP-04) remain disabled because their supported storage/read, authorization and related policy contracts are missing. Do not enable fields that will be discarded. Publish schemas, safe errors, permissions and synthetic fixtures for Lat to wire after acceptance.

### Required follow-through: make the requester form usable

User clarification: publishing the backend contracts alone is not the requested end result. Jopia should also complete the corresponding frontend wiring, coordinating with Lat and preserving the saved layouts. After each dependency is implemented and accepted, replace the disabled placeholder with a functioning control:

- **Supplier routing:** resolve the supplying bank through the accepted workflow and remove the submission blocker. Show the resolved bank; allow bank selection only if the accepted routing decision permits it. Automatic routing does not require a free-text supplier field.
- **Requester / clinical details:** enable the requesting-person and other accepted fields so users can enter and edit supported information. Any field whose data scope remains unresolved stays explicitly unavailable, with the remaining decision reported rather than silently omitted or enabled without storage.
- **Authorized pickup:** enable entry and editing of the accepted representative and authorization-reference fields, with the agreed authority checks.
- **Supporting documents:** enable actual file selection and authorized upload, linked to the request with the accepted format, size, access and retention rules; selecting a file must not merely simulate an attachment.
- **Notes:** enable entry and editing of notes within the accepted scope, validation and persistence rules.

Acceptance: the requester can complete the supported form, pass operator verification and submit it to the resolved blood bank. The bank can read the request and the permitted details/document references. Confirm with synthetic tests that entered values persist and reappear in authorized detail reads, unsupported inputs fail clearly, unauthorized access is denied and retries do not create duplicate requests. Preserve the distinction between queued, committed and bank-approved outcomes. Report any still-disabled field and its exact unresolved dependency. This follow-through adds no permission to collect real personal/clinical data or to perform live retained-host submissions; the existing simulation and live-action boundaries still apply.

## Validation

Node 24.17.0; synthetic fixtures only for browser checks.

- `npm run check:web`: passed on the final UI source (TypeScript + Vite build).
- `npm run test:web`: 474 passed / 54 files, immediately before commit.
- Pinned `mcr.microsoft.com/playwright:v1.61.1-noble`, DejaVu fonts mounted, normal user, network bridge, `--workers=1`:
  - `blood-bank-pages.spec.ts`: 15 passed after the request-count fix, including the new cross-tab regression; this run preceded the final Refresh changes.
  - `dashboard-alerts.spec.ts requester-transfers.spec.ts`: 12 passed on the final UI source. Includes requester/PRC/DOH dashboard removal, PRC expired aggregates, and stable button text/width/opacity during a delayed read.
- `git diff --check`: passed before committing.
- No full browser suite or physical-device check was run for this batch. Existing Vite bundle-size warning remains.

Equivalent focused browser command, from `apps/web` in the pinned container: `npx playwright test e2e/dashboard-alerts.spec.ts e2e/requester-transfers.spec.ts --workers=1`. Use a writable ignored output directory.

## Host and boundaries

The localhost:5174 Vite web container reflects these source edits. This batch did not rebuild/redeploy the retained API, apply migrations, start a ledger peer/worker, change flags or accounts, or submit live requests. During the review `/healthz` reported API/database READY with workerFabric DISABLED; the retained peer was stopped, so this is not evidence of live request commitment. The retained API remains distinct from the newer checked-out demo source.

All unrelated untracked private handoffs, rollout reports, demo artifacts, credentials, PINs, configuration and backups were excluded. No additional deployment, live write, model activation, census/forecast rerun, reset or data population is authorized by this handoff.
