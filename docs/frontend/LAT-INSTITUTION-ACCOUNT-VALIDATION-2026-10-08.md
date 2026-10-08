# Lat retained institution-account integration — 2026-10-08

**Classification:** `SIMULATION_ONLY`  
**Validator:** Lat, on Yuri's retained WSL2 host; separate from Jopia's host  
**Branch:** `codex/lat-institution-account-integration`  
**Delivered backend:** PR #25, `codex/jopia-institution-accounts`,
`8b2df89a1f2ddf78d91f1557f8f5bac33a76dfa8`  
**Previous retained integration:** `daf4ada29b5a0346a804815817fde64f4893a390`
**Tested integration implementation:** `639d600a53db4867ca943caa8afae36452ad348b`
(gateway/seed fix `6c72c6e4d9570936ffc265fa70d66e7eed531e13` plus frontend);
the subsequent documentation commit records these results.

## Scope and runtime

The user authorized local integration of Jopia's six primary institution
accounts. This implements the selected BL-WEB-05/06 integration under
PA-ACCOUNT-01/02 in `docs/TESTING-PHASE.md`, using
[`INSTITUTION-ACCOUNTS.md`](../INSTITUTION-ACCOUNTS.md) and ADR-036 through
ADR-039. It does not accept the whole Testing phase or activate forecasting.

The retained PostgreSQL database is `bloodledger_dev`, container
`bloodledger-postgres-1`, internal port 5432, volume
`bloodledger_postgres-data`. Fabric remains the existing single Mediatrix
organization/peer, channel `bloodledger-dev`, existing gateway certificate
and key. No volume, identity or password verifier was replaced.

| Address | Purpose and evidence |
|---|---|
| `http://127.0.0.1:5174` | Editable React frontend; official cookies and real API proxy |
| `http://127.0.0.1:3000` | API, not a second dashboard; use `/healthz` for health |
| `http://127.0.0.1:5174/capture/` | Built Capture PWA, proxied to the real API |
| `http://127.0.0.1:5175` | Sample design preview; excluded from persisted backend evidence |

The account usernames and approved category/operator mapping remain
authoritative in `services/api/policy/institution-accounts-v1.json`. All six
primary emails match the corrected PR #24 handoff. New private passwords and
operator PINs are in ignored `build/accounts/LOCAL-ACCOUNT-ACCESS.txt`, mode
0600. They are not included in this report or Git. Original six user records,
their credentials, institution assignments and original role rows survive.
Their account kinds/statuses change only as prescribed by the migration:
noninteractive operators, retired logins, or internal maintenance. They are
not six additional visible primary logins.

## Migration and preservation

PostgreSQL was backed up before the three additive migrations and again before
the account migration. Both custom dumps were checked with `pg_restore --list`.
Private retained artifacts are in ignored `build/accounts/`; migration count
increased from 27 to 30. Applied migrations were not edited.

- Target fingerprint:
  `3ddfcfd9398fc720822ac25acd6524dff8098335513301728ca84520eda5f074`.
- Reviewed account manifest SHA-256:
  `257019ba700fec21faad1a0f7f96eeb21110a71678249fc0b37d17eb64078c1e`.
- Mapping digest:
  `82138e33c7b3cfe46b4ed821f8eb512e7929b39b806dc38d01f33fcf92c25dc2`.
- Exact manifest apply: `APPLIED`, first execution `replayed:false`; resume
  returned the original result with `replayed:true`.
- Account verification found the exact six primary accounts and
  `domainFingerprintsPreserved:true` across 42 domain tables.
- Chaincode upgraded additively to sequence 5, version
  `institution-accounts-v1`. Local package ID:
  `bloodledger-institution-accounts-v1_a78c48587cf6:c374a4b02484dc87645a0619efc0b0cddbb63fc8121f1d164969ba4602353014`.

## Integration changes

Primary-account navigation, inventory, transfers, alerts, audit, network and
reports now use the supplied V2 contracts. Inventory defaults to V2.1 with all
five types; historical stock is available only to its authorized Mediatrix
scope. Transfer source choices use the three approved banks. Supported request
and local-release forms remain present. Queued commands are not displayed as
ledger commitments or completed transfers.

Accounts/Profile read the real directory and institution-owned operators.
Invited synthetic applicants have the separate applicant session/status flow.
Privileged mutations prompt for an eligible operator and a PIN bound to the
original action, payload and idempotency key. PINs and verification grants are
not written to browser storage. Session changes reject pending verification
and late data; protected 401 responses clear the entire authenticated tree.

Capture uses primary-account V2.1 verification, distinguishes issuer from
receiving custody, and filters browser receipts by account and institution.
Legacy receipts without owner fields remain quarantined. Logout clears
volatile image/OCR/verification values. Offline OCR submission remains blocked.

Two backend/tool defects were repaired within the integration:

1. The Fabric queue gateway rejected `SYNTHETIC_INSTITUTION_CORE_V1` despite the
   delivered API and chaincode accepting it. Its exact policy version is now
   allowed and tested; unknown versions remain rejected.
2. Frozen seed verification/resume lost its original actor lookup after legacy
   logins became noninteractive. Maintenance can verify the original retained
   credentials for accepted commands; it cannot create missing/new commands
   through retired credentials.

Previously uncommitted dashboard/top-bar/design edits remain separate user
work. This validation used that preserved working-tree design overlay;
integration commits do not incorporate those unrelated changes.

## Reconciliation and actual local command

| Evidence | Retained result |
|---|---|
| Original operational seed | Nine components, five types; six AVAILABLE, one RESERVED, one IN_TRANSIT, one EXPIRED |
| Original seed transfers | Three PENDING requests; two separate ACTIVE/IN_TRANSIT reservations |
| Original ledger operations | 18 VALID operations; complete components/receipts matched the original restart checkpoint on verify and resume |
| Historical snapshot | Fixed 2026-10-07; 522 distinct local components, 486 available/36 reserved, 20 combinations; paginated API receipts all VALID |
| Operational census | 40 combinations, six available, 34 verified zeros; historical stock excluded |
| Medix/N.L. Villa inventory | Empty, correctly scoped; not populated with Mediatrix's stock |
| Forecast | V4 remains default; V5 explicitly selected gives unavailable; no new persisted V5 run |

A separate browser test logged into Medix, verified its ROLE-02 operator,
requested one unit from N.L. Villa, and received 202. The ordinary sync worker
committed the new request to the local ledger:

- Command: `CMD_385F90895D2F92DFA0353F8FCBB6B97DD95A5BB2`.
- Local transaction:
  `a089314206649968561ffb75641171e68193e0cf5b326d3815be5f0a6d2971f6`.
- Local block: `556`; direct QSCC transaction/block verification: `VALID`.
- Verified actor: `USR_OP_BA806C9407FF05B6F3ECDA4D9CF4FCD9`, institution
  `INST_SYNTH_MEDIX`.

This adds one legitimate request/command/receipt outside the original seed:
four total PENDING requests and 19 committed operational commands. It does not
change inventory or reservations. The test helper saves its command ID and
reuses it on subsequent runs. A committed request is still a PENDING request
awaiting its separate lifecycle actions.

## Commands and checks

Private arguments/manifests were used as required by the delivered runbook;
credentials were never placed on the command line or in Git.

| Check/command | Result |
|---|---|
| `npm run migrate:up` | Three additive migrations applied |
| `scripts/institution-accounts/run.sh inspect`, `preview`, `apply`, `resume`, `verify` | Actual target inspected; frozen hash apply/replay and six-account preservation passed |
| `bash network/scripts/deploy-institution-accounts.sh --apply bloodledger-local` | Sequence 5 deployed on retained Fabric |
| `scripts/development-data/run.sh verify` and `resume` with original manifest/hash and `--report` | Exact original nine components and 18 receipts preserved |
| API unit suite | 123 passed, including new gateway policy test |
| Chaincode check/unit + static boundary | Check passed; 41 tests passed |
| Development-data recovery suite | Eight passed |
| `bash tests/accounts/postgres-integration.sh` | 150 assertions passed in disposable test database; independent of retained evidence |
| `npm run test:web` / `npm run test:capture` | 66 / 16 passed, including session-switch mutation isolation |
| `npm run check:web` / `npm run check:capture` | Type/build passed with pinned Node image |
| `npm run test:web:e2e` | 57 passed, seven existing legacy V1 cases skipped |
| `npm run test:capture:e2e` | Three passed; synthetic browser OCR only |
| `node tests/frontend/institution-accounts-live.mjs` | Six official-cookie logins; scope, 522 historical records, census, wrong PIN/DOH admin denial, 401 clearing passed |
| Same helper with `BLOODLEDGER_ACCOUNT_READ_ONLY=true` after restart | Passed; PRC/DOH network and stored reports use authenticated V2 reads |
| `node tests/frontend/institution-capture-live.mjs` | Passed before/after restart; browser-only visibility fixtures explicitly excluded from ledger evidence |
| `node tests/frontend/institution-command-live.mjs` | One real request committed; saved ID reused after restart |
| JSON formatting, database static checks, `git diff --check` | Passed |
| `npm run scan:secrets` | Passed for all Git history, index and candidate content; a console-message false positive was removed without relaxing scan rules |

The live helpers use ordinary login and official cookies, with no HTTP
interception. Mocked unit/E2E regression fixtures are a separate check and are
not counted as retained backend evidence. Logs, backups, private manifests and
browser reports remain under ignored `build/accounts/`.

## Restart durability and retained startup

Stopped the ordinary sync worker, restarted PostgreSQL/orderer/peer without
removing volumes, then restarted API and web in dependency order and resumed
the worker. All 42 domain fingerprints matched the post-write checkpoint;
direct Fabric verification of the same transaction/block passed. Exact
original account/credential fields and all six original role rows matched the
pre-integration checkpoint. Browser logins and Capture passed again.

For these already-created retained containers, use:

```bash
docker start bloodledger-postgres-1 bloodledger-orderer0-1 bloodledger-peer0-mediatrix-1
# Wait for their existing health checks, then:
docker start bloodledger-persistent-api
docker restart bloodledger-persistent-web
docker start bloodledger-persistent-sync-worker
```

The web container shares the API network namespace: restart web after restarting
API. After rebuilding Capture, restart API then web so API registers the
current static asset filenames. The source frontend on 5174 stays editable.
Port 5175 uses `npm run review:web`; this host requires a private writable Vite
cache (set `BLOODLEDGER_VITE_CACHE_DIR` to a `/tmp` path) because an earlier
container build owns the shared generated cache. No repository ownership reset
was performed. Old stopped API/web containers are retained as
`bloodledger-persistent-api-before-accounts` and
`bloodledger-persistent-web-before-accounts`.

Stop the general sync worker before runbook maintenance commands that require
exclusive queue ownership; restart it afterwards. Do not run the disposable
compose API in parallel with this retained API or recreate/reset its stores.

## Remaining dependencies and limits

- Jopia/Buno must separately review the actual retained-target V5 binding/job
  before persistence, with current execution dates and the new actor context.
  No model rebuild, retraining, activation or history resend was performed.
- Source inspection also shows that development-data `inspect`/`census` and
  therefore `forecast.sh` still expect the old ROLE-02/03 interactive credential
  lookup. Those accounts are now noninteractive; the repair here deliberately
  enables only verification/resume of already accepted seed commands. Jopia
  needs an approved primary/operator-aware maintenance configuration before
  new seed previews, census refreshes or forecast preflight through that tool.
  The 40-combination result above verifies the retained 2026-10-08 census via
  the authenticated API; it does not claim a new post-migration census run.
- Browser integration proves reads, operator-bound profile action and a real
  queued request. Complete invited onboarding/activation and every destructive
  administrative lifecycle were not exercised against these retained six
  accounts. Disposable backend tests do not replace that browser evidence.
- Existing unconnected reservation/reconciliation controls remain explicitly
  unavailable pending their reviewed frontend workflow. The original seed's
  reservation evidence is preserved and visible.
- Real onboarding RQ-14, research/UAT, physical OCR, full latency, official
  reporting policy, clinical readiness and deployment gates remain open.
