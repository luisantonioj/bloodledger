# Frontend Validation Conditions

This file records reproducible frontend test conditions. Requirements remain
authoritative in `docs/REQUIREMENTS.md`, and Sprint 5 acceptance remains in
`docs/SPRINT-05.md`. Passing a scenario here does not accept the sprint.

## NFR-06 controlled browser condition

The automated scenario `committed projection becomes visible within the
frontend NFR-06 budget` in `apps/web/e2e/web.spec.ts` measures the web polling
and rendering portion of NFR-06 under these conditions:

- Playwright's bundled Chromium has a visible, active dashboard page;
- the application uses its configured two-second successful polling interval;
- the first dashboard response shows one uncommitted scan separately from one
  ledger-confirmed unit;
- the test records a synthetic confirmed-ledger commit time only after that
  initial state is visible;
- from that recorded time, the same-origin dashboard projection endpoint makes
  the reconciled projection immediately available, with no injected database,
  gateway, transport, or server delay;
- the end time is recorded only after the rendered ledger-confirmed count
  increases and the rendered uncommitted count reaches zero; and
- elapsed wall-clock time must be no more than 5,000 milliseconds.

This is deterministic automated evidence for the frontend refresh/display
budget. It does not measure Fabric commit, worker scheduling, PostgreSQL
projection, physical-device capture, or production network latency. Those
boundaries require the separate clean same-origin integration evidence listed
in `docs/SPRINT-05.md` before accountable-owner review.

Run the scenario from the repository root with:

```bash
npm --workspace @bloodledger/web run test:e2e -- --grep "frontend NFR-06 budget"
```

## 2026-08-24 integrated validation checkpoint

This checkpoint was run on the canonical WSL2 Ubuntu 24.04 working copy with
Node.js `24.17.0`, npm `11.13.0`, the pinned repository dependencies, and the
local project-scoped Docker services. The implementation baseline through
`cdbc569` was under test. This evidence validates the automated Sprint 5 slice;
it does not accept the sprint or replace Lat's accountable-owner review.

The following static, build, boundary, and security checks passed:

```bash
npm run check:foundation
npm run check:inventory-contract
npm run check:forecasting
npm run check:coordination
npm run check:capture
npm run check:web
npm run check:api
npm run scan:secrets
npm run check:fabric-identities
npm run check:fabric-nodes
npm run check:fabric-channel
npm run check:fabric-health-contract
```

Gitleaks `8.30.1` found no leaks in Git history, the index, or tracked and
candidate content. The web and capture production builds completed without a
runtime CDN dependency.

The consolidated unit results were:

- inventory/transfer chaincode: 22 passing tests;
- forecasting: 32 passing tests;
- coordination policy: 9 passing tests;
- capture PWA: 25 passing tests;
- web application: 27 passing tests; and
- application API: 76 passing tests.

The full Playwright web suite passed 24 scenarios. It covered all six roles,
two distinct synthetic secondary hospitals using the shared structure,
PRC/DOH regulatory composition, administrative non-clinical composition,
session restoration/revocation, cross-institution isolation, selected transfer
and alert mutation retries, loading/empty/error states, polling cleanup and
backoff, keyboard navigation, regulatory CSV access, and the controlled NFR-06
browser condition.

The isolated PostgreSQL integrations passed for the API, forecasting, and
coordination services. Each integration created a fixed isolated database,
applied all eight forward migrations, validated its feature behavior, and
removed the database on exit. The forecasting integration's pre-feature schema
assertion was updated from the obsolete Sprint 3 count (`4|7`) to the current
forward-only migration baseline (`8|19`); its forecasting persistence,
idempotency, classification, and conflict assertions were unchanged and passed
after the correction.

The non-destructive consolidated infrastructure status passed: both Fabric CAs,
the Mediatrix peer, orderer, PostgreSQL, channel membership, committed health
contract, and fixed probe were healthy. Same-origin HTTP probes returned `200`
for `/` and `/capture/`; `/healthz` returned API and database `READY`, worker
Fabric `CONFIGURED`, classification `SIMULATION_ONLY`, and forecast readiness
`UNAVAILABLE`. `UNAVAILABLE` is an honest allowed forecast state, not evidence
of an operational forecast.

## Technical visual comparison

On 2026-08-24 every approved mockup source file matched the frozen SHA-256
values in `MOCKUP_REFERENCE.md`, including the recorded aggregate source. The
comparison did not read excluded fixtures into the official implementation.

At a `1440x1000` desktop viewport, temporary local captures covered sign-in,
dashboard, inventory, transfers, alerts, network view, audit, reports, and
profile. The authenticated captures used only the existing synthetic browser
contracts; no runtime fixture adapter or mock fallback was added.

The official surfaces retained the approved shell, hierarchy, density, palette,
typography roles, card/table language, and status vocabulary while replacing
fabricated mockup content with scoped projection and provenance evidence. The
inspection found one clipped transfer-detail action; reducing the table minimum
from `1180px` to `1100px` produced `1150px` client/scroll widths and placed the
button fully inside the viewport. The 27 web unit and 24 browser tests passed.

### Open review obligations

- Lat's owner review of the technical comparison against
  `MOCKUP_VISUAL_2026-08-20` remains pending.

- Lat's accountable-owner Sprint Review, incomplete-item disposition, and
  retrospective remain pending.
- The NFR-06 browser scenario retains the limited boundary documented above;
  it is not an end-to-end physical scan or production latency claim.
- Physical Android OCR evidence remains the explicitly accepted Sprint 4
  deferral and is not reclassified by this checkpoint.
- All accounts, data, locations, reports, and outcomes remain synthetic and
  `SIMULATION_ONLY`; no clinical, regulatory, or production-readiness claim is
  supported.
