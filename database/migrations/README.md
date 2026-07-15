# Migration boundary

This directory contains the ordered, forward-only database migrations owned by
`database/`. The Sprint 1 bootstrap creates only schema `app`, its ownership,
and the runtime usage grant. It intentionally creates no domain table or seed.

Once a migration is shared or applied outside an author's disposable local
database, do not edit it. Correct it with a new ordered forward migration.
