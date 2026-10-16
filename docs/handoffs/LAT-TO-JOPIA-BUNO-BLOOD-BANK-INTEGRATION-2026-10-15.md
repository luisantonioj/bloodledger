# Lat → Jopia / Buno: blood-bank integration result — 2026-10-15

**SIMULATION_ONLY.** [Validation and commands](../validation/lat-blood-bank-completion-2026-10-15/README.md), [host/browser results](../validation/lat-blood-bank-completion-2026-10-15/HOST-BROWSER-READ.json), [forecast/binding audit](../validation/lat-blood-bank-completion-2026-10-15/FORECAST-HOST-READ.json).

Lat rebased `codex/lat-analytics-activity-layouts` on merged #67 (`1d6e4a9`), preserving saved layouts and approved requester OCR. No new PR; #66 stays closed. User authorized API/web-only update: fresh private backup, build/restart only those services, READY health, empty queues, guarded worker restored, general worker stopped. Protected fingerprints unchanged: 532 components / 595 commands, one existing V5 run / 20 forecasts, and two existing PRC requests / five PRC audit events. No live domain write, migration, reset, population, census/forecast rerun or account change.

## Jopia

Connected dashboard summary, CITY_AGGREGATE network availability, request decision/custody states, ordinary full-request FEFO approval panel and complete incoming request-history aggregates (≤366-day chunks). Bank table and shortcut keep all requests. Expiring Soon stays unavailable under RQ-03. Low Stock uses existing demo bands, separately labelled. Request reject/cancel/partial offers remain disabled under RQ-18; CSV/manual intake under RQ-19; extended profile/security under RQ-14/GAP-23.

Outbound Prepare UI is implemented and tested with real OCR on a synthetic image, per-label confirmation, PIN-bound synchronous verification, frozen payload/key/operator on explicit retry, safe mismatch counts and evidence prefilling. Its separate fixture-only Playwright configuration enables the gate; the live gate stays **off**. `app.v2_outbound_verifications` is absent: **do not enable** `VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY=true` until Jopia separately approves/applies migration `20261016000000000`, verifies the private backup/status/counts and approves any live verification. Existing typed preparation evidence remains accepted until enforcement is separately decided. No inherited authorization for prepare/dispatch or another PRC flow.

Lat-host counts differ from your host: summary 439 available / 1 reserved / 86 label-expired pending evaluation; 6 awaiting decisions; 15 requests with reservations; complete incoming history 21 requests / 26 requested units. This is a retained-dataset difference, not a reason to repopulate.

Please review the remaining live outbound migration/enforcement decisions. The exact required forecasting integration image is available on Lat’s host; the full isolated producer/database test remains a separate Jopia follow-up, not a passed test in this record.

## Buno

Reviewed and preserved your two reports and coverage CSV. Verified the existing selected-model file hash, canonical-parameter hash and institution binding hash against the existing run. All 20 persisted series map to your CSV, with one precision qualification: the database stores `numeric(12,6)`, so comparisons match your saved means **after six-decimal quantization**, not full-precision equality. The frontend does not replace calculations with two-decimal display values. Please keep that storage limit visible in calculation evidence; no model/schema change was made.

Actual browser: V5 CURRENT / 20 forecasts, source surplus CURRENT / 20 series, V4 UNAVAILABLE/default; all 20 surplus calculations and forecast IDs match the persisted fractional forecast read. No negative-group or extra-facility forecasts were fabricated. Existing synthetic binding `V5_BIND_PERSISTENT_DEVELOPMENT` points to INST_MEDIATRIX; its hash matches saved lineage, without creating a new authorization. Expansion to 8×5 per approved facility remains your separate proposal, not implemented or activated.

Your 119 forecasting / 183 API / 21 coordination tests remain attributed to your review. The added audit-helper/test branch was not merged or reproduced here. Required image `sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1` exists locally; no substitute image or forecast rerun was used. Coordinate its isolated integration follow-up with Jopia. The new observed-history source is complete incoming request counts/units by Manila date, separate from receipts; departments remain unavailable. No model-training data is derived from a capped transfer list.

## Validation

`check:web` passed; `test:web` passed 392 tests (including design tokens); the affected Playwright selection passed 95 tests with `--workers=1`; the separate enabled outbound OCR/replay/navigation-lock test passed 1/1. Browser mutation flows used synthetic HTTP fixtures only. Live retained-host checks were reads only.

## Shared boundaries

Demo stock bands, forecast-derived snapshot excess and human transfer approval remain distinct. RQ-02, RQ-03, RQ-07, institutional stock policy and other named open decisions remain open. No further deployment, live write, migration, model activation or account change is authorized by this document. Lat will resume requester frontend work when the user requests it and wire later published contracts without replacing the saved layouts.
