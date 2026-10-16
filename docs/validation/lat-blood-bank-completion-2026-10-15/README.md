# Lat: blood-bank completion integration — 2026-10-15

Classification: **SIMULATION_ONLY**. Lat frontend self-validation and read-only retained-host evidence; no clinical, regulatory, production, institutional-policy or ISBT 128 acceptance.

## Baseline and preservation

PR #67 is merged at main `1d6e4a9` (implementation `36c82bc`). The existing `codex/lat-analytics-activity-layouts` branch was rebased on that main without conflicts. Saved Analytics controls, table layouts, Activity History pagination and the approved requester receipt OCR are preserved. The previous head `d2ea00a` remains on local recovery branch `codex/lat-before-pr67-20261015`; its requester OCR commit became `ab0f1cc` during rebase. The old `3d56bdb` layout baseline is preserved through its replayed commits. PR #66 stays closed. No new PR or teammate message was created.

Sources: repository role skill (Lat), AGENTS, Testing-phase plan, ADR-046/047 and [Jopia’s completion report](../../handoffs/JOPIA-TO-LAT-BLOOD-BANK-COMPLETION-2026-10-15.md); the three original Buno attachments are retained alongside this record: [completion](BUNO-FORECAST-COMPLETION-2026-10-15.md), [expansion proposal](BUNO-FORECAST-EXPANSION-PLAN.md), [coverage CSV](coverage.csv).

The repository CSV copy normalizes CRLF to LF for Git; its values are unchanged. Original attachment SHA-256 is `30be0985e1d90a5903a0167ba6edf76f5215951589e603e94f9a7650621b3be4` (also recorded in the host audit); normalized repository copy SHA-256 is `5f20cfc6fdf02c2d0d1d6ac3b3385bb2a9db32368af0059f1b1e86c0c98ca5b5`. The original Downloads attachment was not modified.

## Integration disposition

| Item | Current result | Limit / next owner |
|---|---|---|
| Bank summary | Complete read wiring: label-current available + reserved total, expired labels separately linked to Inventory, incomingAwaitingDecision count | Expiring Soon remains unavailable, RQ-03. No threshold invented |
| Low Stock | Existing SYNTHETIC_STOCK_CLASSIFICATION_V1 eligible, fresh component evidence; count of Critical/Low product series, labelled Demo bands | Separate from source surplus and clinical stock policy; RQ-16 stays open |
| Network availability | CITY_AGGREGATE read, 0 for absent combinations, per-institution lastProjectedAt | No own-institution relabelling or extra role access |
| Blood Requests | decision_state and reservation_status; any own-bank AWAITING_DECISION request opens existing full-request FEFO approval panel | All request rows retained. Reject, request cancellation and partial offers stay disabled (RQ-18) |
| Outbound Prepare | OCR each reserved label, confirm each, synchronous PIN-bound POST with expectedVersion/key, strict response membership, prefilled evidence ID/digest/time | Implemented/tested with synthetic fixtures only. Migration and live action require Jopia’s separate approval |
| Observed bank demand | Complete date-scoped INCOMING aggregate, sequential inclusive chunks ≤366 days; counts and requested units separately | Departments remain NOT_RECORDED; not receipts/transfusions or complete clinical demand |
| CSV/manual intake | Disabled, RQ-19 | Approved verification policy needed |
| Profile/security | Existing unavailable fields unchanged | RQ-14 / GAP-23 |
| PRC and Activity V2 | Existing connected flows preserved; outdated PRC pending-live audit wording reconciled | Previous PRC authorization is exhausted; no new live action |

New reads use existing guarded read hooks or a single `AUTH_CONTEXT_CHANGED` retry with abort/current-request protection. No mutation is passed to read retry. Outbound ambiguous attempts retain the exact payload/key and original operator for an **explicit** retry, lock preparation and record/tab navigation, and do not poll commands. Error handling displays safe counts rather than arbitrary label-bearing server messages. Evidence is off-chain; preparation still needs its separate ledger command. Typed reviewed evidence remains accepted by the existing backend until enforcement is separately decided.

## Approved API/web-only update

The user explicitly approved a fresh private backup and rebuild/restart of **API and web only**, followed by read-only checks. The guarded worker was running initially; queues and writer lock were all zero. It was stopped, then a private `pg_dump -Fc` and generated-build rollback archive were taken under ignored `build/lat-pr67-private` (0600). The current merged API was built and only `bloodledger-persistent-api` / `bloodledger-persistent-web` restarted. Health `/healthz` returned READY. The guarded worker was restored after another empty-queue check; general sync-worker remains stopped.

Protected contents were fingerprinted before/after: components, donations, commands, census snapshots/counts, algorithm runs, source-surplus evidence, forecast runs/rows and ML inventory snapshots/counts. No protected content changed. Counts remain **532 components, 595 commands, 20 forecasts in one run, two existing PRC requests/five PRC audit events**. No census, forecast or population runner was invoked. The report-census table is empty on this host; the separate 40-cell ML inventory snapshot remains existing evidence. No accounts, passwords, operators or identities were changed.

Before restart, the new summary/network/history routes returned 404 from the old running API. After the approved rebuild, all three return 200. Outbound table `app.v2_outbound_verifications` remains absent: migration `20261016000000000` was **not applied**. `VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY` remains unset in the live web service, so no verification POST can be submitted there.

## Actual host/browser evidence

[Sanitized browser results](HOST-BROWSER-READ.json), [persisted forecast/binding audit](FORECAST-HOST-READ.json).

- Summary: **439 available + 1 reserved = 440 on hand**, **86 label-expired pending evaluation**, **6 awaiting decisions**. These differ from Jopia’s dataset, as expected; no data was normalized to his counts.
- Existing demonstration bands classify **28** product series Critical/Low. Network read returns **17** institution/product rows; selected O+ PRBC shows **16** city-wide available.
- Complete incoming history for Jan 1–Oct 15: **21 requests / 26 requested units**. Transfer read: 6 AWAITING_DECISION and 15 RESERVATION_RECORDED, avoiding the misleading raw PENDING status.
- Existing V5 preview and surplus both CURRENT with 20 series; V4 remains UNAVAILABLE/default. All 20 surplus values match `max(0, floor(E − F − 2 − 10))` using returned persisted fractional forecasts; forecast IDs match, with no two-decimal UI values used in calculations.
- Preserved Analytics component selection renders four supported positive groups per component. Negative-group forecasts remain unsupported, not zero. Mobile Analytics has no viewport overflow. No V2 domain POST was issued by the read-only browser check.
- Private screenshots are under ignored `build/lat-pr67-evidence`: dashboard.png, analytics.png, requests.png. They are local inspection evidence, not public Git artifacts.

The original selected-model file hash and canonical-parameter hash match Buno’s report. Persisted binding ID `V5_BIND_PERSISTENT_DEVELOPMENT` and binding hash match the existing run lineage; this verifies an existing synthetic binding and grants no new binding approval. All 20 mappings match Buno’s coverage CSV **after the database’s numeric(12,6) quantization**. This is not full-precision equality: existing storage keeps six decimal places, and frontend display keeps two. No schema/model change was made. Jopia/Buno should retain this precision limit in calculation evidence.

Buno’s 119 forecasting / 183 API / 21 coordination tests are **his reported self-validation**, not tests rerun by Lat. His added test/audit-helper branch was not supplied as a merged patch here. The required pinned image `sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1` **does exist on Lat’s host**, checked by exact image ID. The full isolated producer/database probe remains **NOT_RUN in this follow-up**; Jopia owns that independent integration follow-up. Existing host read evidence does not replace it. No model rerun, training, expanded-group model, binding creation or activation was performed.

## Checks

Node 24.17.0; synthetic fixtures only for mutations. Browser commands pass `--workers=1` directly to the workspace command (the root nested npm wrapper consumes that option).

| Command | Result |
|---|---|
| `npm run check:web` | PASS; existing Vite >500 kB chunk advisory |
| `npm run test:web` | PASS, 392 tests / 45 files; includes design-token checks |
| `npm run test:e2e --workspace @bloodledger/web -- blood-bank-completion.spec.ts blood-bank-pages.spec.ts defense-analytics.spec.ts dashboard-inventory-overview.spec.ts institution-inventory-first-load.spec.ts prc-supply.spec.ts uat-workflows.spec.ts bank-table-columns.spec.ts expiry-wiring.spec.ts --workers=1` | PASS, 95 tests, one worker |
| `npm run test:e2e --workspace @bloodledger/web -- --config playwright-outbound.config.ts --workers=1` | PASS, 1 test; real local OCR, PIN, frozen explicit replay, navigation lock, evidence prefilling; no prepare/dispatch |
| Live authenticated GET/browser checks | PASS; no domain writes |
| `git diff --check` | PASS |

The separate outbound Playwright configuration enables the gate only for its isolated synthetic web build. It does not change the live service environment. Earlier browser runs exposed incomplete fixtures for intake/summary/transfer-summary reads; fixtures were completed and assertions retained or updated to the new contract (a failed current summary clears its count). An initial root-wrapper run did not honor one worker and is not the acceptance run.
