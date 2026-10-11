# UAT host runbook — 2026-10-12

Classification: **SIMULATION_ONLY**. Phase: [Testing](TESTING-PHASE.md) TP-06/TP-07,
J9. UAT host: **Lat's retained host** (Jopia decision, 2026-10-09). Host operator:
Lat. Backend, ledger and worker support: Jopia. UAT coordination and data: Buno.

This runbook operates the prototype for a guided synthetic session. It does not
authorize deployment, clinical use or real data, and it does not record UAT gate
decisions: Lat and Buno record sanitized TP-G01–G03 decisions in
[`TESTING-PHASE.md`](TESTING-PHASE.md) before the session. Never put credentials,
participant identities, raw responses, label images or OCR text in Git.

Each command is marked **Validated** (run on Jopia's retained host on 2026-10-09,
see [J5](handoffs/JOPIA-J5-LIVE-CUSTODY-REHEARSAL-2026-10-09.md)) or **NOT_RUN**.

## 1. Timeline (Asia/Manila)

Buno's V2 population window (Oct 10 16:00 → Oct 11 08:00) closed with nothing
populated on Lat's host. V2 is `MISSED_WINDOW`, superseded by
`SYNTHETIC_OPERATIONAL_STOCK_522_V3` ([Buno's V3 evidence](handoffs/BUNO-OPERATIONAL-STOCK-522-V3-EVIDENCE.md),
[Jopia's acceptance](https://github.com/luisantonioj/bloodledger/pull/39#issuecomment-6105343615)).
This V3 timeline supersedes the V2 rows:

| When | Step | Owner |
|---|---|---|
| Sun Oct 11, by 14:00 | Merge #38, #37 and #39, run J8 and tag `uat-baseline-2026-10-12` | Jopia |
| Sun Oct 11, before 14:00 | Sections 2–3: back up and deploy the baseline **before** population. Both workers stay stopped | Lat |
| Sun Oct 11 14:00 → 23:30 | V3 population window (2026-10-11T06:00Z → 15:30Z, end exclusive): preview, confirm, apply. Apply must start by 16:00 | Lat; Jopia approves each digest |
| Sun Oct 11 23:30 → Mon 07:00 | T0 verification and restart check (verification ends 2026-10-11T23:00Z), then section 4 worker start and section 5 J9 dry run | Lat, Jopia on call |
| Mon Oct 12 07:00 | Section 6: go/no-go | Lat, Jopia, Buno |
| Mon Oct 12, before the session | Repeat the section 6 checks | Lat |

The deploy moved before population (Jopia, 2026-10-11) so that the API runs the
D13/D14 fixes during population and nothing is recreated between T0 and UAT.
The population runner holds the writer lock until T0 verification, so the worker
and the dry run cannot start earlier.

## 2. Before deploying

Run from Lat's repository checkout, the one the retained containers mount:

```bash
docker inspect bloodledger-persistent-api --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
git status --short
```

The working tree must be clean, with Lat's frontend work committed and merged.
Keep design work in a separate worktree, never in the mounted checkout: on
Oct 11, design edits reached the UAT checkout four times from editor and agent
sessions left open on it. Then confirm the population run has released its lock, back up, and record the
starting state (**Validated**):

```bash
bash scripts/development-data/uat-worker.sh status
umask 077; docker exec bloodledger-postgres-1 pg_dump -U postgres -d bloodledger_dev -Fc > "$PRIVATE/pre-uat-deploy.dump"
docker exec -i bloodledger-postgres-1 pg_restore --list < "$PRIVATE/pre-uat-deploy.dump" | grep -c "TABLE DATA"
bash network/scripts/query-channel.sh
```

`$PRIVATE` is a mode-0700 directory outside Git, for example under `build/`.
Expect `population writer lock: 0` and `pending V2 commands: 0`. Keep the ledger
height, the backup checksum and the T0 census snapshot ID in the private record.

## 3. Deploy the UAT baseline

The API and web containers are disposable; all state lives in PostgreSQL and
Fabric. Recreating them keeps the private runtime environment and adds the
capture PWA (**Validated** on Jopia's host: identical environment hash, ledger
height and component counts before and after):

```bash
git fetch origin && git switch --detach uat-baseline-2026-10-12.2
docker stop bloodledger-persistent-web bloodledger-persistent-api
docker rm bloodledger-persistent-web bloodledger-persistent-api
docker run --rm -v "$PWD:/workspace" -w /workspace node:24.17.0 npm ci --ignore-scripts
bash scripts/development-data/start-local.sh --apply
curl -s http://127.0.0.1:3000/healthz
```

`uat-baseline-2026-10-12.2` is the current baseline. Its revisions `.1` and `.2`
change only the population runner (TP-JOP-D16, TP-JOP-D17); the API, web,
chaincode and migrations are identical to `uat-baseline-2026-10-12`. Moving a
deployed checkout between these three tags therefore needs no redeploy.

`npm ci` is required: it installs `fast-jwt` 6.3.4 (TP-JOP-D11).
`start-local.sh` builds the API and the capture PWA and prints the URLs. Check
that `http://127.0.0.1:5174/` and `http://127.0.0.1:5174/capture/` both return
200. If the Fabric peer is down after a Docker restart, `scripts/bloodledger-dev.sh start`
recreates only the peer (TP-JOP-D03).

## 4. Command worker

Retained hosts run no worker by default; without one, every UI command stays
`QUEUED`. **Validated**:

```bash
bash scripts/development-data/uat-worker.sh status
bash scripts/development-data/uat-worker.sh start
bash scripts/development-data/uat-worker.sh stop
```

Lat's host also has an older general worker container,
`bloodledger-persistent-sync-worker`. It runs code from before the D13 fix and
the population wrapper refuses to run beside it, so it stays stopped (Jopia,
2026-10-11) and `uat-worker.sh` is the only worker for UAT.

`start` refuses while a population writer lock is held, when a worker already
runs, or when unfinished commands exist. Review those commands before using
`--confirm-pending`. **Any restart of the API container stops the worker**; run
`start` again afterwards.

## 5. J9 dry run (Sunday evening)

Use the six synthetic institution logins and their operators: Mediatrix,
Medix and N.L. Villa (blood banks), Metro Lipa (requesting hospital), PRC and DOH.
Record each step as PASS, FAIL, BLOCKED or NOT_RUN in the private dry-run record,
and record defects in [`TESTING-DEFECTS.md`](TESTING-DEFECTS.md).

| # | Step | Account | Expected | Live evidence so far |
|---|---|---|---|---|
| 1 | Sign in, view dashboard and inventory with `expiryState`, sign out | All six | Scoped data; logout ends the session | API tests; Lat browser suite |
| 2 | Synthetic scan at `/capture/` with an approved synthetic label, desktop Chromium | A blood bank, ROLE-01/02 operator | Confirmed OCR intake is queued, then committed | Capture newly served; **NOT_RUN** end to end |
| 3 | Requisition to another blood bank | Medix or Metro Lipa | Request queued, then committed | J5 A1 |
| 4 | FEFO reservation, prepare, dispatch, transit | Source bank | Each step committed; FEFO enforced | J5 A2–A5 |
| 5a | Receipt at a blood bank by scanning the label | Destination bank | Unit `RECEIVED` at destination | J5 A6R2 |
| 5b | Receipt at the requesting hospital (`receive` action) | Metro Lipa | Unit received | **NOT_RUN live** |
| 6 | Local release: reserve, prepare, complete | Blood bank | Unit `RELEASED` | J5 B |
| 7 | Cancel an active reservation | Source bank | Stock returns to `AVAILABLE` | J5 C |
| 8 | Compromise with a listed reason | Source or destination | `COMPROMISED`, quarantine pending review | J5 D (pre-vocabulary code) |
| 9 | Place a reconciliation hold | Blood bank | Unit leaves usable stock; no release | API tests only |
| 10 | Acknowledge an `EXPIRED` alert | Blood bank | Acknowledged | J5 E |
| 11 | Audit, census and report reads | PRC, DOH | Read-only, scoped | API tests; Lat browser suite |
| 12 | Revoked session cannot act | Any | Next request asks for sign-in | API tests |

**Expiry demonstration:** no V3 unit expires during UAT. The earliest are the
reserved TRANSFER members, at 2026-10-13T15:30Z (Tue Oct 13 23:30 Manila).
Lat's retained AVAILABLE whole-blood AB+ unit, however, passed its label
expiry on 2026-10-08T23:00Z, so it shows `LABEL_EXPIRED_PENDING_EVALUATION` and
can demonstrate the expiry evaluation action. It is the only such unit: if the
dry run evaluates it, the session cannot repeat the action. Lat and Buno decide
which of the two uses it. Step 10 can use an existing `EXPIRED` alert either way.

## 6. Go/no-go — Monday 07:00

All must pass; otherwise postpone the affected tasks or the session.

| Check | Command or action |
|---|---|
| Fabric and PostgreSQL healthy | `bash scripts/bloodledger-dev.sh status` (**NOT_RUN** this week; `query-channel.sh` is **Validated**) |
| API ready | `curl -s http://127.0.0.1:3000/healthz` shows `READY` |
| Web and capture load | 200 on `/` and `/capture/` at port 5174 |
| UAT checkout at the baseline | `git describe --tags --exact-match` shows `uat-baseline-2026-10-12.2` and `git status --short` is empty |
| Worker running, queue clear | `uat-worker.sh status`: RUNNING, no stuck commands; `bloodledger-persistent-sync-worker` not running |
| Clocks agree (J3 five-minute bound) | Compare `docker exec bloodledger-persistent-api date -u` with Windows (`powershell.exe -NoProfile -Command "[DateTime]::UtcNow.ToString('o')"`, **Validated**: 113 ms skew). Escalate to Jopia if over 60 seconds; the fix is not validated here |
| Six logins work | Sign in and out once per account |
| Fresh backup | Section 2 `pg_dump` with today's date |
| Gates recorded | TP-G01–G03 sanitized decisions present in `TESTING-PHASE.md` |

## 7. During the session

| Symptom | Action |
|---|---|
| Command stays `QUEUED` | `uat-worker.sh status`, then `start` |
| `V2_COMMAND_TIME_OUT_OF_WINDOW` | Check the device clock; the UI retries with a fresh time |
| API unhealthy or 5xx | `docker restart bloodledger-persistent-api bloodledger-persistent-web` (the web container shares the API network), then `uat-worker.sh start` |
| PostgreSQL restarted or briefly unavailable | The worker keeps running (TP-JOP-D14); check `uat-worker.sh status` and that queued commands drain |
| Peer down after a Docker restart | `bash scripts/bloodledger-dev.sh start`, then restart API/web and the worker |
| `git status --short` not empty in the UAT checkout | Close the editor or agent that wrote it, then `git stash push -u -m "<what and when>"` and confirm `HEAD` is still the tag. Never commit on the UAT checkout |
| Anything else | Stop the task, note the time and step, call Jopia |

Do not run builds, test suites or other heavy work on the UAT host during the
session: on a memory-constrained host they caused PostgreSQL crash-recoveries
(TP-JOP-D15). Never reset Fabric or the database, restore a backup over the live
database, or delete volumes during UAT. Record defects with stable IDs; no participant data.

## 8. Known limitations to state in the UAT script

- All data and outputs are synthetic and `SIMULATION_ONLY`; nothing is a clinical
  recommendation or approval.
- Received stock is `RECEIVED`, not `AVAILABLE`, while RQ-10 is open.
- Reconciliation holds cannot be released (TP-JOP-D10).
- Compromise reasons are the synthetic `SYNTHETIC_COMPROMISE_REASONS_V1` list;
  the effect is quarantine pending manual review.
- RPS/BROA recommendations are not shown for V2 requests (TP-JOP-D07) and are
  never autonomous. Forecasts use the synthetic V4 default.
- Near-expiry alerts and DOH census copy/export stay disabled.
- Capture uses desktop synthetic OCR; physical Android OCR is not validated.
- Full NFR-06 browser timing and onboarding (RQ-14) remain outside executed scope.
