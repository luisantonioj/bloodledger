# Sprint 4 Node.js middleware

This workspace implements the `SIMULATION_ONLY` HTTP intake and reconciliation
boundary selected in `docs/SPRINT-04.md`. `openapi.json` is the authoritative
HTTP contract; the Sprint 4 migration is the authoritative persistence
contract.

The API validates a short-lived synthetic session, accepts exact confirmed
capture objects, and returns only after PostgreSQL durably queues the event. It
does not submit to Fabric in the request path. The separate worker claims queue
rows, reuses chaincode idempotency, records ledger evidence, and then updates
the read projection. A failed projection remains visibly pending and never
causes the ledger mutation to be resubmitted.

Focused checks run from the repository root:

```bash
npm run check:api
npm run test:api
npm run test:api:database
```

Required runtime settings are documented in `.env.example`; actual credentials
and Fabric identity material remain untracked.

After migrations, `npm run provision:web-account` creates one development-only
synthetic web identity from untracked `SPRINT5_DEV_*` values. It never prints or
commits the password, salt, or verifier and refuses conflicting replay.
