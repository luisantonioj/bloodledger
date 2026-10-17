# Jopia → Lat: OCR, receipt verification and outbound V2 rollout runbook

Date: 2026-10-18, Asia/Manila. **SIMULATION_ONLY**. **Status: Authorized by Jopia on
2026-10-18 (R1–R4 below).** Lat executes it under the gates below. This runbook does not establish clinical,
regulatory or production readiness.

## What this rolls out

Target: merged `main` at **`26fdbfb`** or a later `main` that you record. A
later `main` that adds only PR #81 (Buno's OCR research tooling) changes no
deployed code.

The last rollout to your retained host deployed API source `25bddeb` (PRs #69 and
#72), with 34 migrations applied and 0 pending. This rollout adds:

| Area | Change | PR |
| --- | --- | --- |
| API | Inbound-capture retries return the original command (J1) | #73 |
| API | `OUTBOUND_LABEL_VERIFICATION_V2` with the OCR-read component (J2, ADR-047 amendment) | #74 |
| API | `receipt-verifications` and evidence-bound `receive` (J3, ADR-049). Blood-bank destinations receive only with evidence; an intake scan of an in-transit unit now returns `409 INBOUND_RECEIPT_REQUIRED`. Bank operators list `transfer:receive` | #75 |
| API | New intake captures need `OCR_LABEL` evidence (J5, ADR-035 amendment) | #76 |
| DB | `20261017000000000_allow-outbound-verification-v2` (widens one check constraint) and `20261017010000000_create-receipt-verifications` (new empty table) | #74, #75 |
| Web | Lat's OCR scanner and DOH dashboard | #77 |
| Web | Incoming transfer receipt flow and outbound V2 requests | #78 |
| Web | Frozen PA-OCR-01 corpus profiles (extraction preview only) | #79 |

No chaincode change. No forecasting change.

### Why the API and web must go out together

Once the J3 API runs, a bank can no longer receive a transfer by scanning one
label. It receives only through the Incoming transfer card, which is behind
`VITE_BLOODLEDGER_RECEIPT_VERIFICATION_READY`. Deploying the API without a web
build that has that flag on leaves banks with no way to receive. Deploying the
web flag without the J3 API gives `404` on `receipt-verifications`. Deploy both
in one window, API first.

The web app now sends outbound V2 bodies. That needs the J2 API, but it only
matters if `VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY` is on, and this runbook
keeps it off.

## Authorization decisions (accountable owner Jopia, 2026-10-18)

| # | Decision | Status |
| --- | --- | --- |
| R1 | Staged rollout of `main` (target above) to **Lat's retained host**, both migrations in filename order, executed by Lat under the gates below | **Accepted** |
| R2 | Build the web app with `VITE_BLOODLEDGER_RECEIPT_VERIFICATION_READY=true` | **Accepted**; required by the J3 API |
| R3 | `VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY` and `VITE_BLOODLEDGER_LABEL_EXTRACTION_PREVIEW` stay **off**; `VITE_BLOODLEDGER_PUBLIC_APPLICATIONS_READY` keeps its current value | **Accepted** |
| R4 | **Not authorized:** any live receipt verification, `receive`, intake capture, outbound verification, prepare/dispatch, reset, population, account creation, census/forecast run or Fabric change. All checks are read-only. A live receipt run needs its own bounded plan | **Accepted** |

## Rollout gates

Stop at the first failed gate. Do not restore, roll back, change ownership or
retry anything yourself; report what you saw.

1. **Prepare.**
   - `git fetch` and check out the target commit. Use Node 24.17.0.
   - Confirm `npm run migrate:status` lists exactly `20261017000000000` and
     `20261017010000000` as pending.
   - Record the currently deployed API commit and web build reference.
2. **Quiesce.**
   - Stop web, API and the guarded UAT worker. The general sync-worker stays
     stopped. Stopping must preserve data; remove no volumes.
   - Confirm queues are drained, using the same V1/V2 queue and writer-lock
     checks as the 2026-10-16 rollout. In particular, no V2 command may be in a
     non-terminal state, so no receipt queued through the old path is still in
     flight:

     ```sql
     SELECT status, count(*) FROM app.v2_commands WHERE status NOT IN ('COMMITTED','FAILED','CONFLICT') GROUP BY status;
     ```

     This must return no rows.
3. **Back up.** Take a custom-format PostgreSQL backup and validate it with
   `pg_restore --list`. Record its SHA-256. The private dump stays out of Git:
   mode 0600, parent folder 0700.
4. **Baseline counts.** Record:
   - the seven protected tables: `app.institutions`, `app.application_users`,
     `app.onboarding_applications`, `app.account_audit`, `app.v2_components`,
     `app.v2_reservations`, `app.v2_commands`;
   - `app.v2_outbound_verifications`;
   - reservations by status, especially `IN_TRANSIT`.

   For comparison, the 2026-10-16 baseline was 9 / 22 / 0 / 6 / 532 / 27 / 595.
   Record today's actual values; don't assume them.
5. **Migrate, one at a time.**
   - Run `BLOODLEDGER_MIGRATION_COUNT=1 npm run migrate:up`, then recheck the
     counts and `migrate:status`. Run it again for the second migration and
     recheck.
   - Every baseline count must be unchanged, and `migrate:status` must end at
     36 applied / 0 pending.
   - `app.v2_receipt_verifications` must exist and be empty.
   - This query must list both `OUTBOUND_LABEL_VERIFICATION_V1` and `_V2`:

     ```sql
     SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'v2_outbound_policy';
     ```
6. **API.**
   - Build as the normal host user: `npm run build --workspace @bloodledger/api`.
     If a root-owned generated file blocks it, stop. The one-shot build
     containers run as the invoking user since PR #70.
   - Confirm `services/api/build/src/receipt-verification.js` exists.
   - Start the API with the existing retained configuration. Health must be
     READY, and an authenticated `GET /api/v2/reservations` must return 200 for
     a bank account and for a requester account. Counts must be unchanged.
7. **Web.**
   - Build from the target commit with R2/R3 flags only. Run the replacement web
     container as the host UID/GID and keep the previous web container stopped,
     not removed, for rollback.
   - Do read-only browser checks against the real API, blocking non-read API
     requests in the harness:
     - The bank scanner (Blood Unit Transactions → Open Mobile Scanner →
       Inbound) shows the Incoming transfer card. It lists the in-transit
       transfers the bank is the destination of, or says there are none.
     - The requester scanner (Blood Unit Receipt) shows the Incoming transfer
       card and no "Confirm inbound receipt" button.
     - The Outbound direction and the other pages look unchanged.
     - Zero API write requests and zero page errors.
   - Counts are still unchanged. Do not scan, verify or receive anything (R4).
8. **Resume.** Restore the guarded UAT worker only after the step 2 checks read
   zero again. The general sync-worker stays stopped.

## Rollback (each step needs explicit authorization at the time)

- **Web:** stop the new web container and start the preserved previous one.
- **API:** the migrations are additive, so the previous API build (`25bddeb`)
  can run against the migrated database. If the API is rolled back, roll the
  web back too, or the receipt card will call a missing endpoint.
- **Database:** restore only from the step 3 backup, only with explicit
  authorization, and only if a migration itself failed.

## Report back

Put the following in `docs/validation/lat-ocr-receipt-rollout-<date>/`, as a
README and a JSON record:
- the target SHA and the previously deployed API/web references;
- the backup SHA-256 and before/after counts;
- the `migrate:status` output and the constraint definition;
- the API and browser check results, with screenshots that contain no label
  values;
- the web build reference and flags.

State explicitly that no live receipt, intake, outbound action, reset,
population or Fabric change was performed. Validation is self-validation unless
someone else independently repeats it.

## After this rollout

- A live receipt test (one synthetic in-transit transfer, scan every unit,
  verify, receive) needs its own bounded plan and authorization.
- Enabling outbound verification needs its own decision. J4 (requiring stored
  `EVD_` evidence for `prepare`) is decided only at that point.
- OCR corpus collection (Buno, V4 plan) and its benchmarks are independent of
  this rollout.
