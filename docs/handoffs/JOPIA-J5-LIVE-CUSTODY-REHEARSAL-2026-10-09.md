# Jopia J5 — live V2 custody rehearsal — 2026-10-09

Classification: **SIMULATION_ONLY / JOPIA_SELF_VALIDATION**. Selected TP-03/TP-08
under BL-TST-01; FR-02/05/08/09/10/11/12, NFR-02/05/08. Host: Jopia's retained
WSL2 environment (`bloodledger-dev`, one Mediatrix peer). Lat's retained target
and Buno's V2 population window were not touched.

This record holds synthetic identifiers, statuses and Fabric transaction IDs
only. Credentials, donation numbers and label fields stayed in the private,
Git-ignored `build/` files and were never printed.

## Preconditions and deployment

| Item | Evidence |
|---|---|
| Queue before start | 577 V2 commands, all `COMMITTED`; no writer lock; V1 queue idle |
| Backup | Private custom-format `pg_dump` (mode 0600), validated with `pg_restore --list` (57 table-data entries) |
| Pre-state | Ledger height 1158; components 492 `AVAILABLE`, 37 `RESERVED`, 1 `IN_TRANSIT`, 1 `EXPIRED` |
| Runtime code | Retained worktree moved from `c4f99c9` to PR #35 (`46b01d1`, then `d8cb0c3`); `npm ci` and API rebuild in `node:24.17.0`; no migration, chaincode or policy difference |
| Dependency | The retained runtime still had `fast-jwt` 6.3.2 (GHSA-x937-hj6v-793p). The redeploy installed the locked 6.3.4 |
| Worker | `worker-main.js` with V2 sync enabled, started inside the API container for the run and stopped afterwards; nothing was pending either time |

## Harness

[`tests/live/v2-custody-rehearsal.mjs`](../../tests/live/v2-custody-rehearsal.mjs)
uses the existing `InstitutionClient` (ordinary session cookies plus a per-command
operator grant), paces each institution at 35 seconds as the stock runner does,
polls each command until it reaches a terminal status, and stops on the first
failure. The report is written with mode 0600 and holds no secrets.

```bash
node tests/live/v2-custody-rehearsal.mjs --config <private stock-runtime.json> \
  --labels <private execution-v2.json> --report <new private report> --run R1 \
  --expired-component <label-expired AVAILABLE component>
```

`--scenarios A6,B,C,D,E --receipt-attempt 2` resumed the run after the receipt
fix, with a new idempotency key, without repeating steps that had committed.

## Results

Run `R1`: 2026-10-09 14:53–15:08 UTC. Combination chosen by the harness:
`WHOLE_BLOOD` / `AB_POSITIVE`.

| Scenario | Steps | Result |
|---|---|---|
| F — J3 stale time | Transfer request with a one-hour-old time | **PASS**: `400 V2_COMMAND_TIME_OUT_OF_WINDOW`, no command queued |
| A — transfer and receipt | Request (Medix), FEFO reservation, prepare, dispatch, transit (Mediatrix), OCR receipt (Medix) | **PASS after fix**: first receipt `FAILED CORE_FIELD_NOT_ALLOWED` (TP-JOP-D09); retry committed. Component held by `INST_SYNTH_MEDIX` as `RECEIVED`; reservation `RECEIVED` v5 |
| B — local release | Server FEFO reservation, prepare, completion | **PASS**: reservation `COMPLETED`; component `RELEASED` |
| C — cancel | Request, reservation, cancel | **PASS**: reservation `CANCELLED`; component back to `AVAILABLE` |
| D — compromise | Request, reservation, prepare, dispatch, compromise | **PASS**: reservation and component `COMPROMISED` (synthetic free-form reason, accepted before `SYNTHETIC_COMPROMISE_REASONS_V1` was enforced; the harness now uses an approved code) |
| E — J4 expiry | Read, evaluate, alert acknowledgement | **PASS**: `LABEL_EXPIRED_PENDING_EVALUATION`/`AVAILABLE` → `EXPIRED`/`EXPIRED`; V2 alert listed and acknowledged |

C and D used the same component. Once C's cancellation returned it to stock, it
was again the FEFO-first unit, as expected.

### Committed Fabric transactions

| Step | Operation | Transaction ID |
|---|---|---|
| A1 | `SUBMIT_TRANSFER` | `75797464fdc282560c0d3f81632d78258521c9b882222c654bfdc2a2bb8fa586` |
| A2 | `RESERVE_COMPONENTS` | `fb4ea2dd493112f11bfd4d9273c207bf45b014f319970e39f6926bde3ee58488` |
| A3 | `PREPARE_RESERVATION` | `b58601212d25c7e5f087e6d163c0135b47d4f04b020e780ae355aabdca53909b` |
| A4 | `DISPATCH_RESERVATION` | `4478e117acabc91f8abea10ebf3cf745772c2f37e2a17cd829e1a09180c014a7` |
| A5 | `START_RESERVATION_TRANSIT` | `08d84d5c89ef8281430a149891164be50f736dc776afef693682d4e7e318a161` |
| A6R2 | `RECEIVE_INBOUND_COMPONENT` | `3c73b685675ebd30734b49aaa8ca4a421737b68a7ae2f7c8ef12be84b35543ad` |
| B1 | `RESERVE_LOCAL_RELEASE` | `1ab37e1c81ad37843e8aac620dfb3ce43d24dbc89909059ecf90f7155f5d21a0` |
| B2 | `PREPARE_RESERVATION` | `eed42134e39b2ac463859a5b0fb77ca9d5935a78c233602b9269f61c2b7cc414` |
| B3 | `COMPLETE_LOCAL_RELEASE` | `f345be996bda4719989fe4443754a006094987ce182463321d01c11c78d86c92` |
| C1 | `SUBMIT_TRANSFER` | `6413544781505158cdcc1e5f38fcd9a7eb1e7ccdffecefbaebff2266760c6609` |
| C2 | `RESERVE_COMPONENTS` | `2f7de332d01230e67459db77f9b57152a1794a7d346d60d4df421a160f21774d` |
| C3 | `CANCEL_RESERVATION` | `56e52b0fb2d02c30e017b13a5c340ce5d982526bea7c84265bbe81604fb1fe49` |
| D1 | `SUBMIT_TRANSFER` | `2230d0fca1e87e6b1f0cba6b47a0685318b5344c97547b0105d22af260133ab8` |
| D2 | `RESERVE_COMPONENTS` | `9105df77415e00b3dfcc2919970b805129d582afb2151cbec14bcba069a0a659` |
| D3 | `PREPARE_RESERVATION` | `826e4739e70051f1d9baeb9d3a4f1eb0a8fc937c134f51bc11be47ab1fa281c2` |
| D4 | `DISPATCH_RESERVATION` | `1fa68a0371cb2514679e0030a81d2bbbce7f60f9a9aa4d1071e14e6d54a14e78` |
| D5 | `COMPROMISE_RESERVATION` | `70b2a2d157eb4481b4d1c72fa52147ef93152e2e58718b201815d73d712f89c2` |
| E1 | `EVALUATE_COMPONENT_EXPIRY` | `41427622bb99f992530baf8225292752d6f043553cd8dcce3d70a8cd486679c3` |

The worker records a commit only after the gateway reports `VALID`. The alert
acknowledgement (E2) is off-chain by design (`OFF_CHAIN_ACKNOWLEDGEMENT`).

### Reconciliation of state

| Measure | Before | After | Explanation |
|---|---|---|---|
| Ledger height | 1158 | 1176 | 18 committed rehearsal transactions; the failed first receipt never produced a block |
| `AVAILABLE` | 492 | 488 | One each received (A), released (B), compromised (D) and expired (E); C returned its unit |
| `RECEIVED` / `RELEASED` / `COMPROMISED` | 0 / 0 / 0 | 1 / 1 / 1 | A, B, D |
| `EXPIRED` | 1 | 2 | E |
| `RESERVED` / `IN_TRANSIT` | 37 / 1 | 37 / 1 | Retained T0 reservations untouched |
| V2 commands | 577 committed | 595 committed, 1 failed | The failed command is the first receipt |

### Timing

Acceptance to ledger commit was at most 581 ms. The stored ledger-commit and
projection-update timestamps are identical, because the worker projects in the
same step. This is database evidence only. Browser display time was not
measured, so full NFR-06 (commit to visible dashboard) remains deferred.

## Findings

- **TP-JOP-D09 (fixed, `d8cb0c3`):** OCR receipt of in-transit stock sent the
  projection-only `captureId` to `RecordInboundReceipt`. A route-level regression
  fails without the fix and passes with it.
- **TP-JOP-D10 (open):** the operator allowlist includes
  `POST /reconciliation/{id}/resolve`, but no such route exists, so a live hold
  cannot be released. Reconciliation was therefore left out of the live run.
- **TP-JOP-D11 (fixed on Jopia's host):** the retained runtime ran `fast-jwt` 6.3.2
  until this redeploy. Lat's retained host gets 6.3.4 only after a deliberate
  `npm ci` redeploy, after the T0 gate.
- **UAT runbook input (J9):** the retained environment runs no V2 worker by
  default, so commands submitted from the UI stay `QUEUED` until a worker is
  started. Received stock is `RECEIVED` at the destination, not `AVAILABLE`,
  while RQ-10 is unresolved; the UAT script must not present it as usable stock.

## Limits

One organization and peer; synthetic accounts and labels; Jopia's host only. No
browser, Lat UI, human UAT, clinical, physical OCR or deployment claim. The saved
T0 census snapshot is unchanged; current inventory now differs from it by the
rehearsal transactions above.
