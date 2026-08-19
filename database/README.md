# BloodLedger Development Database

**Status:** S1-04/S1-05 implemented and verified by the assigned owner on
Jopia's canonical supported development host

This document is the authoritative source for Sprint 1 PostgreSQL identifiers,
roles, migration scope, persistence, and reset behavior. Sprint 1 proves the
database and migration mechanism; it does not create BloodLedger domain tables.

## 1. Approved baseline

| Decision | Value |
|---|---|
| PostgreSQL target | `17.10` planning target; installed image/version must be recorded |
| Development database | `bloodledger_dev` |
| Bootstrap/admin account | Container-local `postgres` account; not used by the later application |
| Migration role | `bloodledger_migrator` |
| Runtime role | `bloodledger_app` |
| Application schema | `app` |
| Migration tool | `node-pg-migrate` `8.0.4` |
| PostgreSQL Node driver | `pg` `8.22.0` |
| Migration directory | `database/migrations/` |
| Migration history | `public.pgmigrations` |
| Default host binding | `127.0.0.1:5432` |
| Persistent volume key | `postgres-data` within Compose project `bloodledger` |
| Seed data | None in Sprint 1 unless a synthetic value is strictly needed to verify tooling |

Both npm packages are exact development dependencies in the approved npm
workspace and one root lockfile. Migration operations use a committed package
script after that script is implemented and validated; documentation must not
use an unpinned on-demand `npx` download.

## 2. Role separation

- `postgres` bootstraps the local development instance and roles. It is not an
  application credential.
- `bloodledger_migrator` owns schema `app` and applies migrations.
- `bloodledger_app` receives only the runtime privileges explicitly granted by
  migrations. It does not receive schema ownership or unrestricted DDL rights.
- DBeaver is optional and uses a least-privileged account appropriate to the
  inspection task.

All passwords are local secrets supplied through untracked configuration. The
future `.env.example` contains variable names and empty placeholders, not usable
passwords.

## 3. Planned environment-variable names

| Variable | Safe planning value | Secret? |
|---|---|:---:|
| `POSTGRES_HOST` | `postgres` inside Compose | No |
| `POSTGRES_PORT` | `5432` | No |
| `POSTGRES_DB` | `bloodledger_dev` | No |
| `POSTGRES_ADMIN_USER` | `postgres` | No |
| `POSTGRES_ADMIN_PASSWORD` | Empty placeholder | Yes |
| `POSTGRES_MIGRATOR_USER` | `bloodledger_migrator` | No |
| `POSTGRES_MIGRATOR_PASSWORD` | Empty placeholder | Yes |
| `POSTGRES_APP_USER` | `bloodledger_app` | No |
| `POSTGRES_APP_PASSWORD` | Empty placeholder | Yes |
| `POSTGRES_HOST_PORT` | `5432` | No |

Application connection strings containing passwords are never committed or
printed in validation evidence.

## 4. Sprint 1 migration decision

The first migration proves that migrations apply and are tracked. It may:

1. create schema `app` owned by `bloodledger_migrator`;
2. grant schema usage to `bloodledger_app`; and
3. leave migration history in `public.pgmigrations`.

It does not create `blood_units`, `transfers`, `users`, forecasts, audit tables,
notifications, sync queues, hospital data, or other feature schema. Those begin
only after the linked requirements, data classification, keys, constraints, and
column-level design are approved.

This also excludes `institutions`, institutional invitations/applications,
onboarding decisions, and applicant identities. ADR-030 places those records in
PostgreSQL/identity storage, but their migrations remain deferred to
`BL-API-02` and an activating API sprint after `RQ-14` and the column-level
design are approved.

No institutional or personal data is needed to validate Sprint 1 migrations.

## 5. Migration rules

- Migration files are ordered, immutable after shared application, and reviewed.
- A correction is a new forward migration; an applied migration is not edited.
- Local rollback may be used only while developing an unapplied migration.
- Shared/integration environments move forward through new migrations.
- Migration status must be inspectable without manually reading the database.
- Recreating an empty development database must apply the same migration history
  and result in the same schema.
- The migration role is used only for migration operations.

## 6. Persistence and reset

Normal stop preserves the `postgres-data` project volume. Network-only Fabric
reset also preserves PostgreSQL.

Only a confirmed full development reset removes the BloodLedger PostgreSQL
volume and migration history. The reset must scope selection to Compose project
`bloodledger`, display the target first, and never remove unrelated volumes or
database directories.

## 7. Tested PostgreSQL and migration commands

Run these commands from the repository root after copying the approved variable
names to an untracked `.env` and filling all three database password values.
The npm commands connect through the loopback host binding and read the
migration credential from the process environment or untracked `.env`; they do
not print the credential or a connection string.

Before first start, confirm that the default host port is free:

```bash
ss -ltn '( sport = :5432 )'
```

If it is occupied, set only `POSTGRES_HOST_PORT` in the untracked `.env` to an
available local port. Do not change the container port or loopback address.

The following configuration, start, migration, status, and non-destructive stop
commands were exercised by `npm run test:database` on 2026-07-15:

```bash
docker compose --project-name bloodledger config --quiet
docker compose --project-name bloodledger up --detach --wait postgres
npm run migrate:status
npm run migrate:up
npm run migrate:status
docker compose --project-name bloodledger down
```

Before the first migration, status exits nonzero and lists the bootstrap as
pending because `public.pgmigrations` does not yet exist. After apply it reports
one applied and zero pending migrations. Reapplying reports no migrations to
run and leaves one history row. Applied shared migrations are immutable; make
corrections with a new ordered forward migration.

The validation-only destructive path is implemented inside
`tests/database/integration.sh`. It refuses to delete unless the project and
volume labels resolve exactly to Compose project `bloodledger` and volume
`postgres-data`, displays the target, and requires the literal validation token.
It is not the general full-development reset command reserved for S1-08.

## 8. Sprint 1 evidence

- Effective PostgreSQL server and client versions.
- Resolved host port.
- Successful health check and authenticated query.
- Role and schema ownership inspection.
- Migration apply and status output with secrets redacted.
- Normal restart persistence result.
- Full reset/recreate result.
- Confirmation that no domain tables, real data, or credentials were committed.

Jopia-host validation on 2026-07-15 proved PostgreSQL server and client `17.10`,
healthy startup, authenticated runtime-role connectivity, separated roles,
`bloodledger_migrator` ownership of `app`, runtime usage without DDL, one
`public.pgmigrations` row, idempotent reapply, zero tables in `app`, normal
restart persistence, and exact-volume empty-state recreation. Additional-host
repetition is optional portability evidence under the 2026-07-30 validation
policy.

## 9. Sprint 3 simulation forecast schema

Migration `20260812000000000_create-simulation-forecast-tables.js` activates
only the FR-14 experiment boundary approved in `docs/SPRINT-03.md`:

- `app.forecast_runs` stores immutable lineage, model-selection evidence,
  stable idempotency/payload hashes, generation time, status, and safe failure
  code.
- `app.demand_forecasts` stores the four next-day blood-type/component values,
  non-negative empirical interval, freshness evidence, `SIMULATION_ONLY`
  classification, and `DISABLED_UNAPPROVED_POLICY` eligibility.

The `bloodledger_app` role receives only `SELECT` and `INSERT` on these two
tables. It receives no `UPDATE`, `DELETE`, DDL, sequence, or unrelated-table
privilege. The forecasting command writes one completed run and four forecasts
in a single transaction. The unique run key makes an identical payload a no-op
and a changed payload fail as `FORECAST_RUN_CONFLICT`.

These tables do not authorize predicted surplus, BROA/RPS, transfer, custody,
clinical, or Fabric behavior. A separately approved migration must supersede
the synthetic classifications and constraints before operational data is used.

## 10. Sprint 3 synthetic coordination schema

Migration `20260814000000000_create-synthetic-coordination-tables.js` adds two
strictly synthetic/off-chain tables:

- `app.location_evidence` stores exact invented dispatch/receipt points,
  accuracy/source, facility-match and fallback results, the evidence digest,
  and an enforced deletion time exactly 30 days after capture;
- `app.algorithm_runs` stores immutable RPS/BROA input, configuration, and
  recommendation hashes plus explainable JSON evidence, always classified
  `SIMULATION_ONLY` with `DISABLED_UNAPPROVED_POLICY` eligibility.

`bloodledger_app` receives `SELECT` and `INSERT` only. It has no direct update
or delete permission. Exact synthetic coordinate deletion is exposed only
through the fixed, migration-owned
`app.purge_expired_synthetic_location_evidence(timestamptz)` function. The
function has a fixed search path and deletes only expired
`SYNTHETIC_DATA` rows. Sprint 3 adds no scheduler; callers invoke the purge
explicitly and must record operational scheduling/monitoring in a later sprint.

The coordination tables do not establish real facility coordinates, routing,
retention policy, operational RPS/BROA weights, or approval authority. They do
not create request/transfer projections and never invoke Fabric.

Focused checks are:

```bash
npm run check:database
npm run test:coordination:database
```

The coordination integration uses only the runtime role and proves identical
replay, conflicting replay, disabled algorithm results, and the exact 30-day
purge boundary. The forecasting database integration creates and removes only
its own fixed isolated test database, applies all three migrations from empty,
and refuses to overwrite a pre-existing database with that name.

## 11. Sprint 4 synthetic scan synchronization schema

The Sprint 4 forward migration defined in `docs/SPRINT-04.md` adds
`app.scan_events`, `app.scan_event_attempts`, and `app.inventory_projection`.
The first table is the durable queue and status record, the second is append-only
safe retry evidence, and the third is a query projection of committed Fabric
inventory. Fabric remains authoritative for accepted inventory history.

The runtime role receives table-specific `SELECT`/`INSERT`, only the column-level
`UPDATE` needed for queue leases/status and projection reconciliation, and no
DDL or table deletion. Raw images, unrestricted OCR text, credentials, JWTs,
PHI/PII, and arbitrary payload JSON are prohibited. All rows are synthetic and
simulation-only until a forward migration and approved policy supersede them.

## 12. Sprint 5 synthetic web-access schema

Migration `20260820000000000_create-synthetic-web-access-tables.js` adds the
minimum identity boundary selected by Sprint 5: synthetic institutions, opaque
application users, one explicit six-role assignment per user, and revocable
15-minute sessions. It does not add applications, invitations, onboarding,
verification documents, or real institutional/person records.

Passwords are represented only by a unique salt and a fixed `SCRYPT_V1`
verifier; session rows contain a SHA-256 token digest rather than the signed JWT.
No credential, hash, salt, token, or identity fixture is seeded by the migration.
The runtime role may read the minimum authentication rows, create sessions, and
update only revocation columns. It receives no identity DDL, delete, onboarding,
or user-management privilege.

## 13. Sprint 5 transfer, alert, and audit projections

Migration `20260820010000000_create-transfer-alert-projections.js` adds the
minimum selected read/projection schema for ledger-backed transfer requests and
events, FEFO-selected unit references, versioned synthetic stock thresholds,
derived alerts, per-user acknowledgements, and redacted application audit
events. It reuses `inventory_projection`, `location_evidence`, institutions,
users, and algorithm evidence rather than duplicating their authoritative data.

The migration seeds no thresholds, alerts, transfers, people, institutions, or
credentials. Transfer statuses and the quantity ceiling match
`SYNTHETIC_TRANSFER_V1`; threshold versions remain inert until an approved
synthetic configuration is inserted. BROA/RPS recommendation digests remain
disabled evidence and cannot approve a transfer. Runtime grants allow only the
selected reads, inserts, projection-column updates, acknowledgement inserts,
and redacted audit inserts; no runtime delete or DDL privilege is granted.
