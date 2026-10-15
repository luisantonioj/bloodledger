# Lat: PR #51 frontend integration evidence — 2026-10-15

Classification: **SIMULATION_ONLY**. Validator: Lat, self-validation on the retained host; independent acceptance belongs to Jopia. Sources: [backend handoff](../../handoffs/JOPIA-TO-LAT-TRANSACTION-TABLES-2026-10-15.md) and [OpenAPI](../../../services/api/openapi-v2.json). Coverage: PA-DEF02–05; PRC remains deferred under RQ-17.

## Scope and preservation

Rebased all 29 unpublished frontend commits onto merged PR #51 (`fb193e4`); recovery branch `codex/lat-before-pr51-20261015` retains their original history. This PR also carries the previously requested dashboard demonstration bands, account switcher, scanner direction screen, automatic redistribution review and mockup presentation work. These are project demonstration behavior, not institutionally validated stock thresholds or autonomous redistribution approval.

The new integration changes only web code, frontend tests and documentation. No backend, OpenAPI, chaincode, migration or scanner submission contract changes. The four earlier Lat contract handoffs are answered by PR #51; PRC remains unavailable.

The retained API initially returned 404 for the new reads because it was running an older compiled build. Built the unchanged merged API inside its existing container, took a fresh private SQL backup, paused the UAT worker, restarted only API/web, checked the empty queue and restored the UAT worker. No census, forecast, reset, recapture or domain command was run. Queue and writer-lock counts were zero; committed commands stayed 595. General sync workers remained stopped. Private backups, runtime credentials and raw verification files remain gitignored.

## Live ordinary-session reads

Origin `http://127.0.0.1:5174` proxies to API port 3000. Ordinary institution login cookies, no intercepted fixtures. These are observations of this host, not assertions that its data equals Jopia's earlier dataset.

| Mediatrix read | Observed | Earlier Jopia handoff |
|---|---:|---:|
| Inventory rows / available exact label identities | 532 / 532 | 530 / 530 |
| Unit history | 536, 11 pages of up to 50 | 537 |
| Transfer summaries | 27, terminal first page | 30 |
| ROLE-02 activity history | 574, 12 pages of up to 50 | 587 |

Each paginated read reached `nextCursor: null`; UI reports All rows loaded. No domain POSTs were made. Mobile viewport 390px had no document overflow. Label values were not printed in verification logs.

**Pending — Jopia host:** Jopia clarified that the private Medix credential file exists only on his host and approved finishing this PR with that live check pending. He will run ordinary ROLE-02 Medix reads against this branch and post the result here: 16 inbound summaries, 2 OCR-matched receipts (1 CONFIRMED, 1 FAILED / Not committed), and 18 activity events. The retired recipient remains retired. ROLE-03 live validation is explicitly waived; backend tests cover its scoping. Different retained datasets explain why this host's counts need not match Jopia's. No accounts, passwords, operators or data were changed.

## Automated validation

Node 24.17.0, npm workspace commands:

- `npm run check:web`: passed type checking and production build; existing bundle-size warning remains.
- `npm run test:web`: 288 tests across 40 files passed.
- `npm exec --workspace @bloodledger/web -- playwright test pr51-table-contracts.spec.ts activity-history-columns.spec.ts bank-table-columns.spec.ts inventory-table-presentation.spec.ts defense-analytics.spec.ts initial-page-layout.spec.ts --workers=1`: 39 passed.
- `npm exec --workspace @bloodledger/web -- playwright test blood-bank-pages.spec.ts --grep "bank inventory|activity type|scanner" --workers=1`: 4 passed.
- `npm exec --workspace @bloodledger/web -- playwright test requester-transfers.spec.ts --workers=1`: 6 passed, including glossary-correct reservation and request labels; legacy assertions use current unavailable-control accessible names and scoped error text.
- `npm exec --workspace @bloodledger/web -- vitest run src/styles/design-tokens.test.ts`: 2 passed (also included in the web unit suite).
- `npm run scan:secrets`: passed Git history, staged index and tracked/candidate content.

Contract tests cover enum rejection, nullable/legacy unavailable fields, exact labels, shared-donation navigation, multi-unit rows sharing one command ID, local releases, requested versus allocated quantities, actor provenance, off-chain/failed status, cursor pagination, search and exact PDF headers. Browser checks include 403/503 refresh clearing and failed Load more preserving prior rows and its cursor for retry. Regulatory audit and requester timeline retain their original sources. Automated browser fixtures are synthetic and isolated from retained port 5174.

## Screenshots

Captured from the live Mediatrix session; only the temporary account-switcher toolbar was hidden. Each screenshot shows the current display page; its loaded-row total covers all fetched pages. Inventory uses a local label search to keep the evidence compact.

- [Inventory](inventory.png)
- [Unit history](unit-history.png)
- [Blood Requests / Priority](blood-requests.png)
- [Transfers](transfers.png)
- [PRC unavailable](prc-unavailable.png)
- [Activity History](activity-history.png)

## Reply prepared for Jopia

PR #51's four web contracts are wired, including exact printed label IDs, cursor reads, glossary-correct request/reservation links, recorded actor provenance and matching PDF columns. All prior unpublished frontend work was preserved. The build/type check, 288 unit tests and 49 browser tests passed. Screenshots and live totals are above.

Remaining gaps: Medix live validation is pending — Jopia host, as agreed; please post your ROLE-02 read-only result on the PR. This host's retained-data counts are documented separately and do not claim to reproduce your database. PRC remains unavailable under RQ-17. `ARCHITECTURE.md` also contains duplicate ADR-036–039 identifiers for older onboarding and newer read-contract decisions; the implementation follows PR #51's machine-readable contract, without silently rewriting the ADR register. No backend workaround, account reactivation or data regeneration was introduced.
