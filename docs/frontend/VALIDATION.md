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
