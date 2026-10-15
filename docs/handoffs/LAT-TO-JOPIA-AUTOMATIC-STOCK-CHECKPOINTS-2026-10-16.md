# Lat → Jopia: automatic morning/afternoon stock records — 2026-10-16

Classification: **SIMULATION_ONLY**. User-requested workflow: save an immutable institution stock record at **09:00 and 16:00 Asia/Manila**, even if no browser is open. Each checkpoint card copies its own saved eight-blood-group × five-component matrix. This request does not establish institutional/DOH format acceptance or clinical policy.

## Frontend completed

Removed Capture Snapshot and the date/selected-time footer. Each morning/afternoon card has a right-aligned Copy button. It reads the corresponding saved snapshot, validates metadata and all forty counts, and copies tab-separated columns: Blood type, Whole Blood, PRBC, FFP, Platelets, Cryo, Total. Zero cells are included; missing cells are rejected. This is clipboard text, not an official DOH export or verified/submitted report.

Copy requires complete discovery, one unambiguous own-institution record for today's exact Manila checkpoint, an already reached checkpoint with coherent capture time, `reportAvailability=EXPORT_AVAILABLE`, and a complete five-component snapshot. It never substitutes current inventory, yesterday's record, an internal ML snapshot, or a partial four-component report. The main stock matrix stays current inventory. Snapshot reads use guarded context-change retry; account/unmount changes invalidate pending copy. No browser capture POST or clipboard copy runs automatically. Discovery polls every 30 seconds while visible and outside an active copy, plus on visibility return; polling is not capture.

## Backend/runtime work needed

`CensusWorker.runSlot/runDueSlots` and `PostgresCensusStore` exist in `services/api/src/census-worker.ts`, but no executable server/worker scheduler invokes them. The running guarded UAT worker processes commands; it is not a checkpoint scheduler. `readDohReportPolicy` disables capture/copy when the report format is not enabled. Lat has not changed that configuration, started a scheduler, captured a report or backfilled a missed slot. Existing protected data and workers are unchanged.

Please decide and publish the following, then provide a separately authorized rollout:

1. **Policy/contract:** approved synthetic report-policy version and institution scope; all eight groups and all **five** components, including cryoprecipitate. Do not silently repurpose an institutional format or the internal ML snapshot. Publish scheduler/readiness status so the UI can accurately distinguish inactive, awaiting, saved, late and failed checkpoints.
2. **Count definition:** current bank table excludes label-expired stock; existing report capture counts all AVAILABLE/RESERVED units. Decide explicitly whether checkpoints retain that existing report definition or need a new immutable policy version. Do not quietly change old snapshots to match the current table.
3. **Durable scheduling:** dedicated server-side runtime, Asia/Manila checkpoints, explicitly approved institution set, startup/shutdown/error handling and persistence. Keep command-worker/general sync-worker settings independent. No page timer or account login may create the record.
4. **Idempotency:** one record per institution/date/slot/policy. Existing `capture` computes a new digest before checking an existing record and can conflict when stock changes; repeated polling must return the already saved immutable record rather than recapture or overwrite. Handle concurrent scheduler instances safely.
5. **Missed/late slots:** never label stock captured after an outage as if it were observed at 9 AM/4 PM. Keep `scheduledFor` and actual `capturedAt` separate; publish late/missed status and agreed recovery behavior. Do not reconstruct an exact missed checkpoint from current stock or activate blanket historical catch-up.
6. **Discovery/copy compatibility:** expose the authoritative active checkpoint record/policy when multiple policy versions exist. Existing component TSV route uses the four-component vocabulary; the UI's whole-matrix copy instead uses strict full snapshot reads. Confirm five-component coverage, authorization, disabled-format behavior and backward compatibility.
7. **Evidence/rollout:** synthetic scheduler tests (before/at/after both checkpoints, restarts, concurrent runs, changed stock after first capture, outages, missing cells, negative groups, cryo and cross-institution scope). Back up before an approved retained-host rollout. Record protected before/after counts and exact new checkpoint writes; no reset, population, forecast rerun, model/binding change or account change.

Verification states/actions and official PDF remain separate gaps. These checkpoint records do not imply verified inventory, DOH submission, forecast input approval or transfer authorization.

Lat will connect scheduler/readiness fields when the reviewed backend contract is available. Until then, the UI is ready for saved records; **automatic saving is not claimed active**.
