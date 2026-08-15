# BloodLedger Sprint 3 Coordination Worker

This TypeScript workspace implements explicit, simulation-only backend commands
for dispatch/receipt location evidence, Request Priority Scoring (RPS), and
Blood Redistribution Optimization Algorithm (BROA) evaluation. It is not a
background scheduler, API, GPS UI, transfer approver, or Fabric client.

The authoritative synthetic configurations are:

- `policy/synthetic-location-v1.json`: six invented facility points, a
  500-metre match radius, maximum 1,000-metre accuracy, approved fallback
  reasons, and 30-day exact-coordinate retention;
- `policy/synthetic-optimization-v1.json`: normalized 70/30 RPS and
  40/25/20/15 BROA weights with operational eligibility disabled.

The coordinates and distances are deliberately invented test fixtures and must
never be presented as real hospital locations or routes.

## Commands

```bash
npm run build --workspace @bloodledger/coordination
node services/coordination/build/src/cli.js validate-policy
node services/coordination/build/src/cli.js capture-location-evidence --input INPUT.json
node services/coordination/build/src/cli.js rank-rps --input INPUT.json
node services/coordination/build/src/cli.js recommend-broa --input INPUT.json
node services/coordination/build/src/cli.js purge-expired-location-evidence \
  --as-of 2026-09-13T00:00:00.000Z
```

Add `--persist` only to capture/ranking commands after the three migrations are
applied and the existing untracked `POSTGRES_*` runtime variables are set. The
worker refuses a database role other than `bloodledger_app`. Exact location
points are stored only in PostgreSQL; the returned `chaincodeSummary` omits
latitude, longitude, and accuracy.

Forecast-triggered BROA requires `scenarioMode: true` and an `AVAILABLE`
forecast status. Stale or unavailable forecasts fail safely. All RPS/BROA
outputs include input/config/result hashes, normalized contributions,
`SIMULATION_ONLY`, and `DISABLED_UNAPPROVED_POLICY`; no command submits or
approves a transfer.

## Verification

```bash
npm run check:coordination
npm run test:coordination
npm run test:coordination:database
```

The live database test proves insert/replay/conflict behavior, two disabled
algorithm runs, runtime-role restrictions, and deletion at the exact 30-day
boundary. It uses synthetic fixtures only and prints no credentials.
