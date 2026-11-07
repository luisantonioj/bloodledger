# Lat panel host continuation — 2026-11-07

SIMULATION_ONLY. Lat performed this local technical validation. Physical-phone
testing and institutional acceptance remain separate.

## Integrated source

Work continued on `codex/lat-panel-evidence-20261107` from integration commit
`b19c6f0`, following Jopia's November 7 handoff. This includes merged PRs #109
and #110. Application source, lockfile, database migrations and chaincode
source match the reviewed `a8c6021` application source.

## Retained migration recovery

Fresh PostgreSQL custom-format backups were taken for the retained and sample
databases. Both passed `pg_restore --list`. Their hashes, archive listings and
the guarded runner are private under the ignored
`build/panel-host-private-20261107/` directory.

The retained preflight found exactly the two migrations identified by Jopia.
After stopping the retained API and checkpoint writer, the pinned
node-pg-migrate 8.0.4 runner applied them with `checkOrder: false`,
`singleTransaction: true`, `migrationsSchema: public`,
`migrationsTable: pgmigrations` and a count of two.

- `20261021000000000_allow-sliding-application-sessions`
- `20261103000000000_add-partial-approval-and-receipt-discrepancy`

Status moved from **42 applied / 2 pending** to **44 applied / 0 pending**.
The applied staff migration still has its original history row and run time.
The new discrepancy table is empty.

| Protected table | Before | After |
|---|---:|---:|
| institutions | 9 | 9 |
| application_users | 25 | 25 |
| institution_operators | 14 | 14 |
| account_audit | 13 | 13 |
| onboarding_applications | 1 | 1 |
| application_sessions | 1,137 | 1,137 |
| v2_components | 535 | 535 |
| v2_commands | 598 | 598 |
| v2_reservations | 27 | 27 |
| v2_transfer_requests | 22 | 22 |
| prc_supply_requests | 2 | 2 |
| v2_census_snapshots | 9 | 9 |
| v2_census_counts | 288 | 288 |
| forecast_runs | 1 | 1 |
| demand_forecasts | 20 | 20 |

## Service recovery

Docker Desktop had left both existing peers stopped after a Docker socket mount
error. Starting the existing retained and sample peer containers succeeded.
Both peers subsequently reported healthy. Their existing chaincode containers
started with them.

The retained API and checkpoint writer resumed after migration. Its API health
is READY and its worker reports DISABLED. The general sync workers are stopped.
The retained API still uses the older staff build snapshot.

The current panel application runs on the separate sample at
`http://127.0.0.1:5184`, with API port 3010. Its API reports READY and the
dedicated worker is configured. Restarting the existing sample web container
restored its connection to the API container's network after Docker resumed.

## Actual sample browser evidence

Chromium in the pinned Playwright container read existing sample records.
The guard permitted ordinary reads and sign-in/sign-out only. Domain POSTs
were blocked. The final run recorded zero attempted domain writes.

Thirteen candidate screenshots and their JSON index are saved privately in
`build/panel-host-private-20261107/screenshots/` and
`build/panel-host-private-20261107/browser-evidence.json`.

| Evidence | Actual read and UI result |
|---|---|
| Two-hospital partial approval | Mediatrix and Metro Lipa both returned requested 5, approved 3, shortfall 2, reason OTHER_OPERATIONAL, status RECEIVED for `RES_3B48895AAB8EC7F77B281BD599AC53F482F6C92A`. Both views captured |
| Open discrepancy | Mediatrix and Metro Lipa both displayed the OPEN record on `RES_AB365425556C79E7576887DCC3E319FA6D492D00`, including the receipt-blocking message |
| Resolved discrepancy | Metro Lipa displayed RESOLVED / RECOUNT_MATCHED for `RES_30A82B1AD15719EA1B9C31C95C7E2964C3E06C0F` |
| Hospital history | Separate INBOUND and OUTBOUND history views captured for Mediatrix, Medix and N.L. Villa |
| Phone layouts | Bank outbound transfer and requester incoming transfer selected at 390 × 844 with touch emulation. Both fit the viewport. Requester receipt showed the existing open discrepancy |

The discrepancy and receipt records were created by the earlier sample
scenario. These screenshots establish their current presentation. This run
did not execute a new mismatch/recount sequence or a fresh request-to-receipt
walkthrough.

Sample protected counts remained **1,050 components, 1,091 commands,
8 reservations and 2 discrepancies**. Its database, credentials, runtime
configuration and screenshots remain outside Git.

## Checks and remaining work

`npm run check:web` passed. `npm run test:web` passed 508 tests with zero
failures. The actual-host browser run captured 13 views with no domain writes.
The application code is identical to the reviewed source whose full browser
suite passed 267 tests with seven existing skips.

Jopia's stock refresh prerequisite still controls final stock/dashboard
figures. These captures focus on existing approval, history and discrepancy
records. The candidate screenshots need paper selection and figure assembly.
The complete UI walkthrough and a fresh mismatch/recount run still need a
bounded execution plan. The DOH heading awaits the team's template, and
frontend manuscript wording awaits a Suggesting-capable document session.
