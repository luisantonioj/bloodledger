# Lat local automatic stock checkpoints — 2026-10-20

SIMULATION_ONLY. User explicitly requested fixing/enabling automatic stock records while acting as Jopia. Agent implementation and self-validation, no independent review claimed.

Root cause: both reporting activation settings were absent on the retained API. The implementation was also tied to a command worker which must previously be restarted by hand after API restarts. There were zero retained census records before activation.

Added a dedicated off-chain scheduler entry point with policy gating, per-bank failure isolation, one-minute ticks and a file-based heartbeat. Added `stock-checkpoints` API workspace command and a `dedicated` worker mode to avoid running checkpoint scheduling inside the ledger worker. Existing 09:00/16:00 Manila slots, 30-minute windows, unexpired AVAILABLE/RESERVED inclusion, four V2 components, first-capture immutability and no-backfill behavior are preserved. No endpoint, schema, migration, threshold or forecast changed.

Fresh private custom-format backup validated; SHA-256: `058247ad13342a325085fd927f3c0eca390e324a12868dfd8a03b0f0ae97cce7`. Ignored private evidence/config/builds are under `build/stock-checkpoint-private-20261020/`. API/web were quiesced after empty queue/lock checks, recreated with the existing flags plus reporting activation and dedicated mode, and started normally. Stopped previous API/web containers remain available. The checkpoint container uses only app database/policy settings, pinned Node 24.17.0, normal-user execution and restart policy `unless-stopped`; API/web also now restart unless explicitly stopped. General sync worker remains stopped, guarded UAT worker restored, expiry evaluator remains off. No identities, volumes or ledger state were changed in this checkpoint rollout.

Validation:

- API suite: 243 passed, including three new scheduler tests.
- Disposable PostgreSQL 17.10: 41 migrations; three empty banks, morning and afternoon captures = six records with 192 zero-filled cells. Copy TSV, duplicate immutability, inactive/requester exclusion and closed-window no-backfill passed. The disposable database was separate from retained data.
- Actual scheduler tick: healthy, three active banks, zero failures, zero captures outside the allowed window. A normal container restart produced a new healthy heartbeat.
- Actual ordinary bank logins and GET census index: 200, `EXPORT_AVAILABLE`, zero records for all three banks. No live domain writes were sent.
- Existing protected database fingerprints matched before/after; 535 components, 598 committed commands, 27 reservations and all other existing records unchanged. 41 migrations / 0 pending, no pending commands/population lock.
- Local frontend 5174 HTTP 200 and API/database READY.

At activation it was already after the October 20 afternoon window. Next scheduled slot: October 21, 2026 at 09:00 Asia/Manila, then 16:00. No past record was invented and no retained off-schedule capture was executed. The next real scheduled capture is not yet observed; the persistence behavior was validated in the disposable database. Keep the laptop awake with Docker running during capture windows. No claim that sleeping/offline hours can be captured.

All code/docs are saved locally, not committed/pushed for this task. Preserve other uncommitted requester, form-fill and layout work when preparing a later commit.

## Publication follow-through

The local-only statements above describe the state at each validation checkpoint.
This work is included in the combined `lat-sync-20261020` delivery; use
[the final handoff](../../handoffs/LAT-TO-JOPIA-COMPLETE-EVENING-UPDATE-2026-10-20.md) for its source commit, consolidated results
and current cross-host instructions. Private runtime files and credentials
remain outside Git.
