# Minimal synthetic live PRC validation plan — 2026-10-15

**PREPARED ONLY — NOT EXECUTED. Awaiting Jopia’s explicit go-ahead.**

Lat proposes this plan against main `014d862` or an approved descendant containing
#60 and #61. Policy: PA-DEF-06 `SYNTHETIC_PRC_SUPPLY_V1` / ADR-044.
SIMULATION_ONLY; not PRC or Mediatrix policy. No clinical, regulatory,
production or ISBT 128 claim. RQ-02 remains open.

## Approval and preparation

Jopia must name the target host/database, approved API/web build, execution
window and operator performing these five new coordination writes. Approval
must explicitly cover this plan before any submit, cancel, acknowledge, fulfil
or decline. The bank "requester" below means Mediatrix’s requesting blood-bank
account with a ROLE-02 operator, **never** the hospital ROLE-03 account.
PRC uses its existing reviewer operator (ROLE-04 with `prc-supply:respond`);
ROLE-04 alone does not grant that capability.

1. Jopia verifies API/web include #60/#61, health READY, and migration status
   32 applied / 0 pending on the chosen host. This plan authorizes no deployment
   or migration by itself. Confirm ordinary accounts and authorized operators
   privately; never record credentials, PINs or verification tokens in evidence.
2. Take a **fresh private pg_dump backup before the first action**, following
   the retained-host backup procedure in [LOCAL-DEVELOPMENT](../../LOCAL-DEVELOPMENT.md).
   Use the existing private runtime environment; restrictive directory/file
   permissions (0700/0600). Verify success and inspect archive readability with
   `pg_restore --list`. Store the backup path privately, not in Git or screenshots.
   A backup is evidence protection, not a routine undo procedure.
3. Record a quiescent before snapshot using read-only database access. No
   census, forecast, OCR intake, transfer or other domain task runs during the
   window. Preserve worker configuration; if background activity prevents a
   stable baseline, pause and reschedule rather than changing unrelated services.
4. Check that synthetic reference `PRC-SIM-LIVE-0001` is unused. If it already
   exists, ask Jopia to approve a different synthetic reference before writing.
   No real PRC reference, donor/patient information, free-text notes or files.

Read-only count template for the executor (not executed during preparation):

```sql
SELECT 'components' AS name, count(*) FROM app.v2_components
UNION ALL SELECT 'donations', count(*) FROM app.v2_donations
UNION ALL SELECT 'commands', count(*) FROM app.v2_commands
UNION ALL SELECT 'census_snapshots', count(*) FROM app.v2_census_snapshots
UNION ALL SELECT 'census_counts', count(*) FROM app.v2_census_counts
UNION ALL SELECT 'algorithm_runs', count(*) FROM app.v2_algorithm_runs
UNION ALL SELECT 'source_surplus_evidence', count(*) FROM app.v2_source_surplus_evidence
UNION ALL SELECT 'prc_requests', count(*) FROM app.prc_supply_requests;
```

Record component status/version totals and existing census IDs as well, to
avoid treating unchanged row counts as proof that nothing was edited. Retain
command status totals/queue counts. Store exact counts privately; do not assume
Lat and Jopia hosts have the same dataset. Let the PRC request baseline be P0.

## Approved flow (five new writes)

Use ordinary UI sign-in/account switching. Every action below prompts operator
selection and PIN verification. Each new action has its own client-generated
correlation/idempotency keys. Existing-record actions send the displayed current
`expectedVersion`; the published **submission** body has no expectedVersion.
Required By is picked in **Asia/Manila**, approximately submission +48 hours,
sent as the exact UTC equivalent and retained unchanged throughout that request.
Use blood type **A+**, component **PRBC**, urgency **ROUTINE** for both requests.

| Step | Exact UI path and action | Operator | Expected result / version | Expected detail history |
|---|---|---|---|---|
| 1 | Mediatrix → Requests & Transfers → PRC Supply Requests (`/transfers?tab=prc`) → **+ Request PRC Supply**. Enter A+, PRBC, **2 units**, ROUTINE and Required By about two days ahead; **Send to PRC** → verify | Bank ROLE-02, `prc-supply:request` | First generated PRCSR ID (A); **SUBMITTED**, version **1**; reference null → "Awaiting PRC acknowledgement"; units 2 | One `PRC_SUPPLY_SUBMIT`, prior null → SUBMITTED; recorded operator/time; Off-chain |
| 2 | PRC → **PRC Supply Requests** (`/prc-supply`) → open A by its exact ID → Acknowledge; enter **PRC-SIM-LIVE-0001** → **Acknowledge request** → verify | Existing PRC reviewer, `prc-supply:respond` | **ACKNOWLEDGED**, version **2**; reference exactly entered, provenance PRC_RECORDED_IN_SYSTEM | Prior entry unchanged; append `PRC_SUPPLY_ACKNOWLEDGE`, SUBMITTED → ACKNOWLEDGED |
| 3 | Same PRC detail A → choose Fulfil → fulfilled quantity **1** → **Record fulfilment** → verify | Same authorized PRC reviewer | **FULFILLED**, version **3**; Units **"1 of 2"**; closed time present; terminal | Append `PRC_SUPPLY_FULFIL`, ACKNOWLEDGED → FULFILLED; three entries total |
| 4 | Mediatrix `/transfers?tab=prc` → **+ Request PRC Supply** → same synthetic product, **1 unit**, ROUTINE, new Required By about +48 h → **Send to PRC** → verify | Bank ROLE-02, `prc-supply:request` | Second distinct PRCSR ID (B); **SUBMITTED**, version **1**; null reference; units 1 | One `PRC_SUPPLY_SUBMIT`, null → SUBMITTED |
| 5 | Mediatrix → open B by its exact ID → **Cancel PRC request** → verify; do this before any PRC acknowledgement | Bank ROLE-02, `prc-supply:cancel` | **CANCELLED**, version **2**; null reference; closed time present; terminal | Append `PRC_SUPPLY_CANCEL`, SUBMITTED → CANCELLED; two entries total |

Refresh and re-open by exact request ID after each step. Mediatrix sees its own
requests; PRC sees both. Each synchronous response is `replayed: false` for a
first success, with ledger.status NOT_APPLICABLE, presented as **Off-chain**.
There is no 202 queue or command polling. An explicitly retried, already recorded
same operator/key/body returns `replayed: true` with no extra version/history/write;
never auto-retry or create a replacement after an uncertain response. If a
version, scope, reference or state is unexpected, pause and report it to Jopia.
Do not broaden the five-write scope or try decline/recovery commands.

## Before/after acceptance and persistence

Compare the baseline after **every step**, then once more after ordinary reads:

| Evidence | Expected change |
|---|---|
| Component rows, their statuses/versions and donation records | **None**, after every step |
| V2 command rows/status totals and pending queue counts | **None**; no Fabric transaction or reservation is created |
| Census snapshot/count rows and existing snapshot IDs | **None**; no census run |
| Algorithm/source-surplus evidence and forecast run IDs/times | **None**; no forecast or model rerun |
| PRC request row count | P0+1 after steps 1–3; P0+2 after steps 4–5 |
| PRC-scoped account audit for the two exact IDs | +1 per first successful action, **5 total**; histories A=3 and B=2 |
| Coordination outcomes | A FULFILLED v3 with 1 of 2; B CANCELLED v2; original Required By values unchanged |

Compare PRC-scoped audit rather than assuming login/operator-verification records
are inventory events. Capture redacted/synthetic screenshots of both terminal
rows and histories and record build, host, timestamps (preserve milliseconds),
versions and private before/after count paths. Do not capture PIN/credential UI.
Per-request history is the evidence; general Activity History V1 excludes PRC.
The unfulfilled remainder of A is not a separate pending fulfilment or stock claim.

**These records persist. There is no undo or UI deletion.** Cancellation is a
new terminal state, not removal. Fulfilment is terminal and cannot be reversed;
it does not put a unit into stock. No DELETE, reset, repopulation, rollback or
backup restore is part of this validation. Real stock receipt still requires
the separate ordinary OCR intake, which is out of scope. Mark the plan awaiting
approval until Jopia explicitly authorizes it; do not record preparation as a
completed live test.
