# Workload, resilience and request-to-receipt evidence (2026-11-03)

SIMULATION_ONLY. Panel items Franze #6 (synchronization latency, throughput, recovery and
consistency under interruptions and concurrent requests) and Franze Q2 (one complete
request-to-receipt transaction validated by the smart contract). Run by the Jopia role on
the Jopia laptop with the owner's explicit approval on 2026-11-03.

## Environment and boundary

- One development host: Windows 11 + WSL2 Ubuntu 24.04, Docker Desktop. One Mediatrix peer,
  one Raft orderer, channel `bloodledger-dev`, chaincode `bloodledger-inventory`
  (`InterviewCoreContract`, package `bloodledger-tc-remediation-v1`).
- `tests/api/workload-resilience.sh --confirm-shared-ledger` with
  `services/api/test/workload-resilience-probe.mjs` (commit `ce4e007` plus the endpoint fix).
  Each run uses its own isolated PostgreSQL database (created, then dropped on exit). It writes
  synthetic `SUBMIT_TRANSFER` transactions (`TRF_WL_<run>_…`) to the shared development
  channel. Those requests are on the ledger but not in the live application database.
- Commands go through the real durable queue (`app.v2_commands`), 4 concurrent workers, the
  Fabric Gateway and the projector. The API's operator-PIN step is bypassed on purpose: its
  rate limit (30 grants per 15 minutes per institution) would otherwise cap the measurement.
- This is not a realistic multi-hospital workload, and it does not measure browser rendering.
  The NFR-06 dashboard path (`scripts/validation/nfr06-latency.mjs`) was not run.

Before the runs, the host peer had been stopped since a failed Docker Desktop restart at
08:22 UTC (a `docker.sock` bind-mount error). It was restarted with `docker start` on its
existing ledger (last block 2284), with no reset. Run R1 was stopped and discarded: the
runner inherited the compose-network peer address from `.env`, so no transaction left the
host. Every R1 command stayed queued and retrying, none was lost, and its database was
dropped. The runner now uses `127.0.0.1:7051`.

## Results (runs R2 and R3)

Latency is measured from acceptance into the queue. "VALID" is the peer's commit status;
"projected" is after the read model is updated. Times are in seconds.

| Scenario | Run | VALID p50 | VALID p95 | VALID max | Projected p95 | Wall | Commits/s | Recovery | Lost | Duplicates |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 concurrent | R2 / R3 | 5.25 / 5.14 | 7.39 / 7.25 | 7.39 / 7.25 | 7.40 / 7.26 | 7.6 / 7.4 | 1.31 / 1.34 | — | 0 / 0 | 0 / 0 |
| 25 concurrent | R2 / R3 | 8.51 / 8.65 | 12.76 / 13.25 | 14.83 / 14.53 | 12.78 / 13.26 | 15.1 / 14.7 | 1.66 / 1.70 | — | 0 / 0 | 0 / 0 |
| 50 concurrent | R2 / R3 | 14.51 / 15.97 | 24.89 / 27.09 | 26.94 / 28.31 | 24.90 / 27.10 | 27.4 / 28.5 | 1.83 / 1.75 | — | 0 / 0 | 0 / 0 |
| 25 with a 60 s peer outage | R2 / R3 | 77.2 / 83.4 | 81.6 / 87.9 | 83.7 / 90.2 | 81.7 / 88.0 | 84.0 / 90.3 | 0.30 / 0.28 | 11.9 / 16.3 s after peer start | 0 / 0 | 0 / 0 |
| 5 abandoned claims (crashed worker) | R2 / R3 | 32.5 / 34.0 | 34.7 / 36.3 | 34.7 / 36.3 | 34.7 / 36.3 | 34.5 / 36.3 | 0.15 / 0.14 | 34.5 / 36.3 s after abandon | 0 / 0 | 0 / 0 |

In every scenario of both runs:
- accepted = committed = distinct ledger transactions = projected rows;
- the queue's ledger transaction IDs equal the projection's;
- no command was lost and none was projected twice.

The peer-outage commands needed up to 7 attempts (exponential backoff). The abandoned claims
returned to the queue after the 30-second lease and were completed by another worker.
Raw reports: `run-r2.json` and `run-r3.json`, which hold synthetic IDs and timings only. In
those files, `resubmittedAfterCommit` actually counts commands whose submission was retried
after a failure; the probe now calls it `commandsWithRetriedSubmission`.

**Interpretation.** Throughput levels off near 1.8 commits per second. Each worker waits for
its transaction's block (the orderer's batch timeout is about 2 s), so latency grows with the
backlog: a burst of 10 commands is fully ledger-confirmed within about 7.5 s, and a burst of 50
within about 28 s. During a peer outage, commands wait in the queue and are confirmed 12–16 s
after the peer returns. No outage, crash or retry lost or duplicated a command. These figures
apply to one development host and are not operational capacity claims.

## Request-to-receipt on the ledger (Franze Q2)

The defense-day rehearsal of 2026-10-21 (Asia/Manila). One unit of O+ packed red blood cells,
requested by the synthetic Metro Lipa account from Mary Mediatrix: transfer
`TRF_WEB_8D4DB9D85E254F3E8546028F5A1AA36B`, reservation
`RES_WEB_19D0F5F1D10446D5B066AAA490CAE86B`. Each transaction's block and validation code were
read from the peer through `qscc` (`GetBlockByTxID`, `GetTransactionByID`) on 2026-11-03.

| Accepted (Manila) | Command → chaincode transaction | Ledger transaction ID | Block | Validation |
|---|---|---|---:|---|
| 09:29:13 | SUBMIT_TRANSFER → SubmitTransferRequest | `21a554a312c64ae34f5cfcf0aa90b80380eb4b364f548f9ab3092de6f9355a29` | 2251 | VALID |
| 09:32:33 | RESERVE_COMPONENTS → ReserveComponents (FEFO) | `b1ebee2cbab6c10e66ce84f05b296b55a3c723081b0e6177de2fee4f419f0f63` | 2252 | VALID |
| 09:49:58 | PREPARE_RESERVATION → PrepareReservation | `4149676e4f01c2898decfa185db6236f013ffe237ca0015ef51fd3590ab14e66` | 2253 | VALID |
| 09:51:41 | DISPATCH_RESERVATION → DispatchReservation | `9346a06a90a3d357bab6ebe3140eda0c237e13c84a768d849b76316baf54a551` | 2254 | VALID |
| 09:53:03 | START_RESERVATION_TRANSIT → StartReservationTransit | `79a52108806ee0e94465cdb99217027b267868e21c112110abd2ed824d0d59f9` | 2255 | VALID |
| 09:59:32 | RECEIVE_RESERVATION → RecordReservationReceipt | `ffa14b538a68289ace6b2a90846352bbe34455f67722652811ea747b8b2509c7` | 2256 | VALID |

Each command was projected within one second of acceptance. Every step was a PIN-verified
operator action through the web application. The chaincode rejects out-of-order and
stale-version steps (Table 3).
