# PR37 live verification on Jopia's retained host — 2026-10-10

Classification: **SIMULATION_ONLY**. Owner: Jopia (self-validation disclosed).
Synthetic data only. Results are PASS, FAIL, BLOCKED or NOT_RUN. These results do
not show UAT acceptance, clinical safety or production readiness.

Scope: Lat's [PR37](https://github.com/luisantonioj/bloodledger/pull/37) head
`ec81d42`, based on `bf70eff`. It was deployed on Jopia's retained host and tested
through the real browser path 5174 → API 3000 → PostgreSQL → V2 worker → Fabric.
The two backend defects this run found (TP-JOP-D13, TP-JOP-D14) were fixed in
`338e684` on `codex/jopia-uat-fix-d13`, applied over `ec81d42` on the host and
retested. Lat's host was not touched.

## 1. Deploy rehearsal (runbook sections 2–4)

| Step | Result |
|---|---|
| Host reboot left the Fabric peer stopped with the stale Docker-socket error; `scripts/bloodledger-dev.sh start` recreated only the peer (TP-JOP-D03) | PASS |
| Starting state: writer lock 0, pending V2 commands 0, ledger height 1176; private backup listed 57 table-data entries | PASS |
| `git switch --detach ec81d42`, remove both containers, `npm ci --ignore-scripts` (0 vulnerabilities, including `jspdf` 4.2.1), `start-local.sh --apply` | PASS |
| `/healthz` READY; `/` and `/capture/` return 200 | PASS |
| `uat-worker.sh start` with no pending commands | PASS |
| `docker restart` of API and web together after the API rebuild; both URLs return 200 | PASS |

## 2. Automated checks on `ec81d42` (isolated worktree)

| Check | Result |
|---|---|
| Foundation, `check:api`, `test:api` (143) | PASS |
| `check:web`, `test:web` (146) | PASS |
| `check:capture`, `test:capture` (23), capture browser suite (5, Playwright 1.61.1 container) | PASS |
| Web browser suite (Playwright 1.61.1 container) | See section 6 |
| Inbound OCR boundary, operations behavior, development-data (37), secret scan, `git diff --check` | PASS |
| `test:api` on `338e684` (145, including the D13 and D14 tests) | PASS |

The host has no Chromium system libraries, so the browser suites ran in the
Playwright container.

## 3. Live read-only checks (no command submitted)

The Mediatrix coordinator and the Medix recipient signed in with ordinary cookies.

| ID | Check | Result |
|---|---|---|
| R1 | Coordinator sign-in through the real API | PASS |
| R2 | Inventory list parses live components, including the required `expiryState` | PASS |
| R3 | Available component: "Label current"; hold form loads 7 reasons from the API (`SYNTHETIC_RECONCILIATION_REASONS_V1`); no release control | PASS |
| R4 | Ledger-expired component shows Expired; no expiry action | PASS |
| R5–R6 | Active transfer and local-release reservations offer exactly prepare and cancel | PASS |
| R7 | In-transit reservation offers only compromise; 4 API reasons, no free text, confirmation required | PASS |
| R8 | Received reservation shows RECEIVED, not usable inventory (RQ-10) | PASS |
| R9–R10 | Committed J5 command recovered by command ID and by saved request key, without a POST | PASS |
| R11 | Capture PWA served at `/capture/` | PASS |
| R12 | Recipient bank sees no reservation receive action (receive is ROLE-03 only) | PASS |
| R13 | No V2 mutation sent during R1–R12 | PASS |

Command lookup is scoped to the institution account and its operators, so a
command submitted by a legacy user correctly returns 404.

## 4. Live UI-driven commands

Each command used explicit confirmation and operator PIN verification, then was
polled to `Committed`. The first run failed at W1 (`CORE_FIELD_NOT_ALLOWED`,
TP-JOP-D13). After `338e684`, every step passed:

| ID | Action through Lat's UI | Ledger transaction |
|---|---|---|
| W1 | Reconciliation hold (`LABEL_RECORD_MISMATCH`); component shows the hold; no release control | `c807cf619afbdf004e545d1348bc43f92d4d73188da687662fa6eee8cf2146e7` |
| W2 | Prepare transfer reservation (synthetic evidence) | `1aa59df0290e306e3469112b18374c67a56a6ff28add489266c024ae441b8231` |
| W3 | Dispatch, offered only after preparation | `e889dcddbd718985fed4429e81f13c37a850cbbd50f53f705de416d4c1db63a4` |
| W4 | Start transit | `970cd963628c9cb1c272b99137f0f7948fc1df901318dac3e9f0d15810718945` |
| W5 | Compromise (`HANDLING_OR_CUSTODY_DEVIATION_REPORTED`); W6: no further action offered | `3706ebad112bf8b8f40f3d699bce0b0324788b132402ea10a6c11b6287a0c101` |
| W7 | Cancel transfer reservation | `6642f04d67f4622acecfbcae47bc9be69b0adb35a0d16d7efdb31401c1f29cef` |
| W8 | Prepare local release | `f0771bd9c45316c080fa24e181f269cb551f257434f91dd4890ffe5a8143d40c` |
| W9 | Complete local release, offered only after preparation | `37c0682f661ed7e846251dcc1d7908c276a9b54f14969a95e57e3d04534d63df` |

Ledger height went from 1176 to 1184.

## 5. Database restart drill (TP-JOP-D14)

With the worker running, `docker restart bloodledger-postgres-1` was issued. The
same worker process stayed RUNNING and logged `57P01` and `57P03` warnings, and
the API stayed READY. The next UI command (cancel) committed:
`3e7c649ec74f01cf0c60c27e86b3cc53ba7a8ff996c8be81818f633ba0038713`. Ledger height
reached 1185. **PASS**.

Before the fix, two PostgreSQL crash-recoveries had ended the worker
(TP-JOP-D15, host memory pressure).

## 6. Web browser suite

The first container run overlapped the live stack and the capture suite. It
failed 17 cases on test or browser-launch timeouts. The standalone run passed
116, failed 22 and skipped 7. Memory pressure averaged 29% over five minutes,
and pages stalled at "Restoring session…". Rerunning only the failures passed 15,
then the remaining 7. Every case passed at least once: 138 passed, 7 retired V1
fixtures skipped, matching Lat's result. **PASS**, with one caveat: the suite's
10-second expectations are flaky on a memory-starved host.

## 7. Synthetic records changed on Jopia's host

One component is on reconciliation hold. Reservations: one compromised, two
cancelled, one local release completed. Two FAILED commands are retained (the D13
attempt and J5's A6 attempt). Lat's host and Buno's population were not touched.

## 8. Not covered here

| Item | Status |
|---|---|
| Requesting-hospital (ROLE-03) reservation receive | NOT_RUN live: no ROLE-03 credentials on this host. Statically, the API payload matches the exact keys of `RecordReservationReceipt` |
| Expiry evaluation command | NOT_RUN: no eligible component. This host's reserved labels expire on 2026-10-11 08:00 Manila |
| Census discovery | NOT_RUN live: DOH account only |
| End-to-end capture scan | NOT_RUN: page served; no scan performed |

These belong in the J9 dry run on Lat's host.
