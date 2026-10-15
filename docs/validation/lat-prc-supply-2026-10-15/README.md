# Lat PRC supply UI validation — 2026-10-15

Classification: **SIMULATION_ONLY**. Lat validates frontend integration against
merged backend `797377e`, PA-DEF-06 (`SYNTHETIC_PRC_SUPPLY_V1`) and ADR-044.
Requirements and `services/api/openapi-v2.json` remain authoritative. This is
not PRC or Mediatrix policy; no clinical, regulatory, production or ISBT claim.
RQ-02 remains open. Layout follow-ups and policy-status documentation are
separate PRs #58 and #59.

## Connected interface

- Uses published `PrcSupply*` shapes, cursor list, scoped detail/history and
  synchronous mutation results. No command polling or automatic POST retry.
- Blood-bank ROLE-02 submits/cancels with capability and PIN verification;
  ROLE-01 has a read-only entry. PRC responds. Requester/DOH have no PRC reads
  or actions. Read parsers check institution scope, enums and policy provenance.
- Six table/PDF headers, loaded-row counts/search, Load more, Manila dates,
  null-reference explanation, decline reason and fulfilled-of-requested units.
- Required By and quantity validation, cryoprecipitate, no free-text notes.
  Existing-record actions send `expectedVersion`; the published submission
  schema does not contain that field. All actions use correlation/idempotency
  keys and the existing verification flow.
- Off-chain coordination stays separate from inventory, custody, ledger events
  and general Activity History. Supplied units require normal OCR intake.
- Failed/unavailable reads keep submission disabled. Lost-response attempts
  retain their intent and original operator; explicit retries require PIN again.

## Authorized Lat-host migration and runtime checks

User relayed Jopia's explicit authorization to migrate this retained host.
Jopia's own migration was not treated as evidence that Lat's database was ready.

1. Created a fresh private `pg_dump` backup with restrictive permissions under
   gitignored `build/lat-prc-supply-private/`; raw evidence is not committed.
2. Migration status was **31 applied, 1 pending**. Confirmed the only pending
   migration was `20261015000000000_create-prc-supply-requests`.
3. Checked V1/V2 queues empty and writer lock zero, then stopped the guarded
   UAT worker. General sync-worker stayed stopped.
4. Ran the documented `npm run migrate:up --workspace @bloodledger/database`
   with private runtime environment and Node 24.17.0. Status became
   **32 applied, 0 pending**. Migrator reported applied timestamp
   `2026-10-15T03:01:28.127Z`.
5. Compared every pre-existing `app` table count before/after: unchanged.
   Local counts: **532 components, 595 commands, 1 account-audit row**. The new
   PRC request table is empty. These differ from Jopia's host and are recorded
   as local evidence, not a failure.
6. Built the unchanged merged API sources and restarted the persistent API;
   health returned **READY**. Restored the guarded UAT worker after queue
   check; 595 commands remained committed. Restarted the web container to
   restore its shared API network namespace. General sync-worker stays stopped.

No reset, repopulation, identity/account changes, census or forecast reruns.

## Read-only live UI evidence

Ordinary account sign-in at `http://127.0.0.1:5174/`:

| Account | List | Scope | Rows | Next cursor | Missing detail |
|---|---|---|---|---|---|
| Mediatrix blood bank, ROLE-02 | 200 | INSTITUTION | 0 | null | 404 PRC_SUPPLY_NOT_FOUND |
| PRC account, ROLE-04 | 200 | PRC_ALL | 0 | null | 404 PRC_SUPPLY_NOT_FOUND |

Desktop and 390px mobile views checked without horizontal page overflow.
Missing-detail checks used a valid-format synthetic nonexistent ID. Positive
populated detail validation is **NOT RUN**: no retained PRC requests exist and
live submissions are not authorized. All live PRC mutation counts are **zero**.
Fixture tests, rather than live writes, cover every action and history flow.

Screenshots contain no credentials or PINs:

- [Mediatrix empty list](mediatrix-empty.png)
- [PRC empty list](prc-empty.png)
- [Unsubmitted bank form](bank-form.png)

## Automated validation

- `npm run check:web`: passed; existing large-bundle advisory remains.
- `npm run test:web`: **348 passed**, 42 files.
- `npm exec --workspace @bloodledger/web -- vitest run src/styles/design-tokens.test.ts`: **2 passed** (also included above).
- Final affected browser suite: **82 passed**, one worker:

```bash
npm exec --workspace @bloodledger/web -- playwright test \
  prc-supply.spec.ts pr51-table-contracts.spec.ts bank-table-columns.spec.ts \
  institution-inventory-first-load.spec.ts defense-analytics.spec.ts \
  uat-workflows.spec.ts requester-transfers.spec.ts expiry-wiring.spec.ts --workers=1
```

- PRC-specific cases: **14 passed**, included in the 82. Covers all actions,
  roles, error/unavailable states, loaded search/PDF, same-key replay, original
  operator binding, stale version, deadline rejection and cancelled verification.
- Two affected bank-tab/form navigation cases: **2 passed**, separately:

```bash
npm exec --workspace @bloodledger/web -- playwright test blood-bank-pages.spec.ts \
  --grep 'bank row selection|bank request forms' --workers=1
```

- `git diff --check` and `npm run scan:secrets`: passed before publication.

## PR #61 follow-up and remaining evidence

Rebased PR #60 onto merged main `f26001d` (includes PRs #61, #58 and #59).
[Delayed replay finding](../../handoffs/LAT-TO-JOPIA-PRC-DELAYED-REPLAY-2026-10-15.md)
is **resolved by PR #61**, merge `4bdf8b0`. Source review confirms body parsing
precedes replay lookup, while the moving deadline check only runs for a new
write. Same-key changed-body conflict remains. No frontend retry policy changed.

The synthetic lost-response browser case advances the clock 61 minutes and
confirms that explicit retry inside the one-hour boundary returns the stored
result with identical operator, body, correlation and idempotency key. Cancelled
verification still preserves the earlier attempt. A hypothetical late rejection
also remains covered defensively. Browser mutations stay intercepted fixtures.

PR #61 also preserves real timestamp milliseconds and cursor precision. Added
parser coverage accepts `.722Z` unchanged in PRC/history, unit history, transfer
summaries and activity; frontend never decodes or regenerates server cursors.
Jopia's reported backend probe (61 assertions, 4/4 runs) is attributed to Jopia;
Lat did not repeat it against retained data.

Follow-up checks on the rebased tree:

- `npm run check:web`: passed (existing bundle-size advisory).
- `npm run test:web`: **350 passed**, 42 files, including design-token checks.
- The same eight-spec affected browser selection above: **82 passed**, one worker.
- The two bank-tab/form cases above: **2 passed**. Total **84 browser cases**.
- `git diff --check` and `npm run scan:secrets`: passed before publishing.

Original live-read and migration evidence above predates the #61 rebase. No
retained API deployment or live PRC mutation is part of this follow-up.
Populated live reads and all live actions remain unvalidated; live actions
require Jopia's explicit go-ahead. No external PRC integration is claimed.

## Post-merge live plan — awaiting approval

Main `014d862` includes #58–#61. The replay finding is resolved and #60 is merged.
The [minimal live plan](LIVE-PLAN.md) is prepared **only**; no action in that plan
has been executed. It requires Jopia’s explicit go-ahead for the named host and
five persistent coordination writes. PRC remains excluded from Activity History
V1; the [coordinated V2 proposal](../../handoffs/LAT-TO-JOPIA-PRC-ACTIVITY-V2-PROPOSAL-2026-10-15.md)
is not a parser, policy or contract change.
