# Lat operational record navigation — 2026-10-09

Classification: **SIMULATION_ONLY / LAT_LOCAL_VALIDATION**. Selected task:
TP-STOCK-01 technical frontend integration under BL-TST-01; FR-03/05/09/12,
NFR-01. This is not human UAT or Testing-phase exit evidence.

## Reviewed integration and preserved work

Reviewed [Buno PR26](https://github.com/luisantonioj/bloodledger/pull/26),
[Jopia PR27 final handoff](https://github.com/luisantonioj/bloodledger/pull/27#issuecomment-6071913481)
and draft [implementation PR28](https://github.com/luisantonioj/bloodledger/pull/28).
Fetched and integrated exact PR28 head
`c4f99c9c420a380ae64b1a444fc353fff666bd2e`, with verified ancestry
`954f170b840fce1a346bb3bd393748a731be1913`. No assumption about `main` was used.

Frontend branch: `codex/lat-operational-stock-navigation`. Tested implementation:
`0ae4c7577fc01495537cae21a2803a4f3dffc6b4`. Its parent is the exact reviewed
PR28 head. Existing nine unrelated design/evidence changes were preserved and
left unstaged: web.spec.ts, application-shell, inventory-overview-chart,
global.css, DESIGN, the earlier persistent-development validation, VISUAL-REVIEW,
and both visual-review helpers. The running workspace includes those retained
design changes; they are not packaged in this integration commit.

## Actual retained target

Windows/WSL Linux workspace `/home/yuri/projects/bloodledger-current`;
ordinary browser `http://127.0.0.1:5174` proxies to API 3000. PostgreSQL uses
database `bloodledger_dev`, internal port 5432 and retained volume
`bloodledger_postgres-data`. Fabric channel is `bloodledger-dev`.

Fresh post-restart QSCC genesis read plus retained database/volume evidence
reproduced target fingerprint
`3ddfcfd9398fc720822ac25acd6524dff8098335513301728ca84520eda5f074`;
database instance `68aa41aa9ca6b92980a1cb126ac9f5a2`.
This differs from Jopia's populated target
`ee1fcef55cde4b8d698b45faa79a091009acd2e391f0619db1abfc693422afb8`.
Jopia's 531-unit/559-commitment results remain **JOPIA_SELF_VALIDATION**.

Backed up PostgreSQL using a private custom-format `pg_dump` and verified its
archive listing before applying additive migration
`20261008040000000_add-operational-stock-journal.js` (30 → 31 migrations).
No population, census capture, forecast generation, reset, restore, identity
enrollment or account migration was executed in this integration. Local
installed institution-account chaincode remains sequence 5; source checks
include PR28's CRYO read correction, but sequence 6 was not deployed here.

Laptop/Docker recovery initially found a peer with a stale Docker socket mount.
Only its container was recreated with `--no-deps --force-recreate`; existing
ledger/configuration volumes and identities were retained. The subsequent
durability test used ordinary service restarts, without container or volume
recreation. A Docker daemon interruption and generated-artifact ownership
errors were recovered before successful checks; they were not passing runs.

## Implemented behavior

- Component IDs open collection/expiry, donation relationship, issuer/custodian,
  inventory version/state and linked reservation details.
- Reservation details display purpose, lifecycle/version, preparation evidence
  and member components. TRANSFER opens the existing scoped request list's
  matching `transfer_id`; request state stays separate from reservation state.
- LOCAL_RELEASE displays `localReleaseId`, purpose and member navigation from
  reservation detail. No nonexistent local-release detail route is called.
- Null reservation references have no link. Missing/denied/conflicted/error
  reads clear the previous detail and expose safe status/retry text. Aborted
  reads cannot restore a closed detail. Dates use the existing Manila formatter.
- Fresh detail links work for verified accounts: operator binding initializes
  before child reads, preventing a false session-epoch 401. Actual 401/logout
  removes protected detail and shell data.

Existing transfer/local-release forms remain intact. Navigation reads do not
authorize mutations. V4 remains the default; near-expiry remains disabled.

## Independent reconciliation and results

| Check | Result and scope |
| --- | --- |
| Retained operational inventory | PASS: 9; 6 AVAILABLE, 1 RESERVED, 1 IN_TRANSIT, 1 EXPIRED; all five types |
| Requests and reservations | PASS: 4 PENDING requests globally (3 in Mediatrix scope); 2 TRANSFER reservations, ACTIVE and IN_TRANSIT |
| Commands | PASS: 19 COMMITTED remain unchanged; no new submitted commands |
| Historical snapshot | PASS: fixed 2026-10-07 snapshot; 522 distinct paginated API components with stored VALID local receipt evidence; separate from operational inventory |
| Six accounts | PASS: all ordinary-cookie logins; 6 primary accounts and 12 operators retained |
| Component → reservation → request → member | PASS: genuine 5174→3000 browser/API reads, no interception |
| Missing/null resources and scope | PASS: missing component/reservation/request, null reservation, Medix/N.L. Villa foreign-component 404 and DOH reservation 403; no foreign detail displayed |
| Session clearing | PASS: authenticated session DELETE followed by a genuine protected 401 clears dialogs and shell for all six logins |
| Ordinary restart | PASS: PostgreSQL/orderer/both CAs/peer/API/web restarted; browser rerun returned exact same IDs, counts and scope results; sync worker restored |
| Preservation | PASS: 48 domain/account/operator/institution table fingerprints match; 76 identity/channel/secret files and five retained store mount sets match; backups and private reports outside Git |
| Local census | PASS for truthful display, not freshness: 40 stored combinations, stored available count 6; snapshot `CENSUS_0D5930F9FB6E6EF03AD8304112415BC7F166DCC5`, captured 2026-10-08T02:45:42.859Z; API reports STALE on October 9 |
| 531 units / 559 new commitments / Jopia T0 | BLOCKED on this target: zero operational-stock runs; no authorization/access to Jopia's populated target provided. No population attempted |
| Live LOCAL_RELEASE detail/member navigation | NOT_RUN: no such reservation exists locally; parser and HTTP-fixture UI regression PASS |
| Live FAILED/CONFLICT/queued transitions | NOT_RUN: no matching local commands; HTTP-fixture error/conflict/retry and existing command regression PASS; genuine PENDING request navigation PASS |
| V5 persistence/binding/job | BLOCKED: separate target/job approval; no generation or activation attempted |
| Full Fabric receipt/asset revalidation | NOT_RUN in this frontend task; authenticated historical reads verify stored receipt evidence, not a new QSCC review of every receipt |

## Reproducible checks

Credentials/PINs come from private ignored `build/accounts/private.json` and
are never embedded in tests. The live helper only logs in, reads and revokes
sessions; it performs no domain mutation and has no HTTP interception.

```bash
git fetch origin codex/jopia-operational-stock-population
git merge-base 954f170b840fce1a346bb3bd393748a731be1913 c4f99c9c420a380ae64b1a444fc353fff666bd2e
git switch -c codex/lat-operational-stock-navigation
git merge --ff-only c4f99c9c420a380ae64b1a444fc353fff666bd2e

docker exec bloodledger-postgres-1 pg_dump -U postgres -d bloodledger_dev -Fc > build/lat-stock-navigation/before-schema.dump
chmod 600 build/lat-stock-navigation/before-schema.dump
docker exec -i bloodledger-postgres-1 pg_restore --list < build/lat-stock-navigation/before-schema.dump
npm run migrate:up

# Pinned Node runtime for API checks; generated outputs remain ignored.
docker run --rm -v /home/yuri/projects/bloodledger-current:/workspace -w /workspace node:24.17.0 sh -ec 'npm run test:api && npm run check:web'
npm run test:web
npm run test:web:e2e
npm run test:e2e --workspace @bloodledger/web -- operational-navigation.spec.ts
bash tests/chaincode/static-inventory-contract.sh
docker run --rm --user 1000:1000 -v /home/yuri/projects/bloodledger-current:/workspace -w /workspace node:24.17.0 sh -ec 'npm run check --workspace @bloodledger/inventory-contract && npm run test:inventory-contract'
node --test tests/development-data/*.test.mjs

node tests/frontend/operational-navigation-live.mjs
docker stop bloodledger-persistent-web bloodledger-persistent-api
docker restart bloodledger-postgres-1 bloodledger-orderer0-1 bloodledger-ca-mediatrix-1 bloodledger-ca-orderer-1 bloodledger-peer0-mediatrix-1
# Wait for the existing database and Fabric health checks before starting API.
docker start bloodledger-persistent-api
docker start bloodledger-persistent-web
docker start bloodledger-persistent-sync-worker
BLOODLEDGER_NAVIGATION_REPORT=build/lat-stock-navigation/browser-after.json node tests/frontend/operational-navigation-live.mjs
git diff --check
npm run scan:secrets
```

Results: API 125/125; web units 80/80; full HTTP-fixture browser suite 64 PASS,
7 explicitly retired V1 mutation cases SKIPPED; final scoped navigation rerun
7/7 after focus/pending-reference refinements; chaincode format/lint/type/static
and 42/42 tests; development runner 23/23. Frontend type/build PASS. Full
history/index/candidate Gitleaks and diff checks PASS. Fixtures test UI behavior
and do not count as populated-target acceptance.

Private evidence is in `build/lat-stock-navigation/`: verified backup/list,
migration/test logs, before/after/final browser reports, target fingerprint,
domain/identity preservation reports and reconciliation. Private checkpoint
helpers hash canonical domain rows (using the existing `domainFingerprints`,
plus complete account/role/operator/institution rows), identity file bytes and
store mount sets. Their pre/post comparison passed. Authentication/session
activity is intentionally outside the domain-row comparison.

## Remaining owner handoff

Jopia: provide a reviewed connection/forwarding path to the already populated
target for independent 531-unit/local-release/T0 checks, or a separate explicit
retained-target preparation handoff. Current instruction prohibits population
or restoring stores, and Jopia's target approval cannot be reused here. Review
the frontend follow-up against PR28 before consolidating the integration.

Buno: PR26 data is incorporated in the reviewed PR28 ancestry; no model resend,
retraining or replacement workbook is needed for navigation. V5 binding/job
review remains separate with Jopia and Buno.

PR26/27/28 remain open for unresolved integration/target review. Human UAT,
physical OCR, full NFR-06 latency, forecasting accuracy, clinical interpretation,
near-expiry policy, activation, deployment and Testing exit are not completed.
