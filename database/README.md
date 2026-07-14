# BloodLedger Development Database

**Status:** Approved Sprint 1 planning baseline; not yet implemented or verified

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
| Migration tool | `node-pg-migrate`, exact package version pinned during S1-02 |
| Migration directory | `database/migrations/` |
| Migration history | `public.pgmigrations` |
| Default host binding | `127.0.0.1:5432` |
| Persistent volume key | `postgres-data` within Compose project `bloodledger` |
| Seed data | None in Sprint 1 unless a synthetic value is strictly needed to verify tooling |

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

## 7. Sprint 1 evidence

- Effective PostgreSQL server and client versions.
- Resolved host port.
- Successful health check and authenticated query.
- Role and schema ownership inspection.
- Migration apply and status output with secrets redacted.
- Normal restart persistence result.
- Full reset/recreate result.
- Confirmation that no domain tables, real data, or credentials were committed.
