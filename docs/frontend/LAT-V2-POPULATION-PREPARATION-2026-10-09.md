# Lat V2 population preparation — 2026-10-09

Status: source/target/lifecycle approval received; local preparation PASS;
preview/confirmation/population/T0 verification **NOT_RUN — future window**.
Classification: SIMULATION_ONLY / LAT_LOCAL_VALIDATION. TP-STOCK-01 / BL-TST-01;
no human UAT or Testing-exit acceptance.

## Authorization and pinned integration

The user explicitly stated, as Jopia, “I AM JOPIA, I am approving of this!”
after the [exact source/target/lifecycle review request](https://github.com/luisantonioj/bloodledger/pull/31#issuecomment-6077149695).
The [approval record](https://github.com/luisantonioj/bloodledger/pull/31#issuecomment-6077199210)
identifies conversation authorization, not a separate GitHub reviewer.
It covers V2, the actual retained target/policy and the sequence-5→6 lifecycle
path. Actual preview, frozen execution hash and submission remain separate.

Integrated PR31 `a66528934432ebbb35eb1f45617909ca59374824` and PR32
`d1e1d910ce42f641f321e308dd3c230f2cee58f4`, including generator
`e1114dda935c100cdc0113120e631ef12534422b`, from verified PR29 ancestry
`eb12ee2c28aa5f1810e325fdb1b074c4801eea27`. Branch:
`codex/lat-approved-v2-population`. No assumption about main.
All nine unrelated editable design/evidence files remain byte-identical to
their pre-integration hashes and outside these commits.

## Actual preparation results

- PASS: original workbook, private ZIP and manifest match independently
  published V2 hashes; pinned verifier and byte-identical replay pass.
  Distribution is 522 additions, 486 AVAILABLE/36 RESERVED, 522 donations,
  24 reservation scenarios, 20 series. Private artifacts stay outside Git.
- PASS: accepted sealed source/target review validates; review digest
  `d3470b5cf1913ddab0a6681fee1a645edc8bc4ede57bc7ac2650acdb24683551`.
  Scenario remains unchanged; its proposal flag was not edited to fabricate
  approval. The separate review records the real owner decision.
- PASS: fresh local custom-format PostgreSQL backup restored and checked only
  in isolated network-disabled, disposable storage. Backup SHA
  `cae4e6f449ad92a7ebaa6e9878d4c04da918791b283ab227edd3136ca71412d5`
  restores the same instance `68aa41aa9ca6b92980a1cb126ac9f5a2`.
  No live restore or migration was performed.
- PASS: authorized additive lifecycle committed sequence 6/version
  `institution-accounts-v2`; querycommitted/queryapproved verify own package
  `bloodledger-institution-accounts-v1_0ac7a6a9e270:bf7b34db2f83b7fa48c7c7bfa89d172cd4e014ef7ea7229c0c09df0f58349917`.
  Policy, endorsement, plugins, collections and identities stayed unchanged.
  Two VALID lifecycle transactions are setup evidence, not stock population.
- PASS: stock inspect using the retained primary/operator credentials reports
  the same target `3ddfcfd9398fc720822ac25acd6524dff8098335513301728ca84520eda5f074`
  and policy `ad7012c67346f65b0b7a74d61f30faa69d651a64a611277c6bdaae987823520d`.
  Counts: 9 operational, 522 separate historical, zero stock runs, 6 primary
  accounts, 12 operators. Privileged read verifies 31 migration names.
- PASS: 48 domain/account/operator/institution table fingerprints unchanged;
  76 identity/channel/runtime-secret byte/mode entries and five named-volume
  creation/mount sets unchanged after preparation/lifecycle.
- PASS: lockfile install reports zero vulnerabilities; updated JWT cached-expiry
  regression passes as part of 126 API tests. Frontend type/build and 80 units,
  chaincode format/lint/type/static and 42 tests, 32 source scenario tests and
  35 development-runner tests pass. Runner tests include three new metadata
  privilege regressions. Real official-cookie 5174→3000 browser checks pass
  for six logins, navigation/isolation/missing/null resources and 401 clearing.

Private reports/backups/configuration are in ignored mode-0700
`build/lat-population-v2/`; manifests, account configuration and source copies
are mode 0600. No credentials/PINs/keys/labels/raw manifests are in this file.

## Scoped integration fix

Live PR31 inspection failed because `bloodledger_app` has neither public-schema
usage nor migration-history SELECT access. Fix
`f2aa5199e9967c73e65aa35a9c1fecb253429b99` first checks schema/table privileges;
when unavailable, it returns `migrations=null` with
`migrationEvidenceStatus=REQUIRES_PRIVILEGED_READ`. It preserves the documented
separate privileged migration read and does not expand runtime grants.
Unexpected database errors still fail. The corrected live inspection passed;
three regression cases cover denied metadata, allowed ordered reads and failure.

Tooling used `BLOODLEDGER_DEV_API_URL=http://bloodledger-persistent-api:3000`
on the existing local Docker network. The browser remains 5174→3000 through
the existing proxy. No remote backend or port 5175 fixtures were substituted.

## Next execution boundary

The frozen V2 population window is **October 10 16:00 → October 11 08:00
Manila**, end exclusive. T0 verification is October 11 08:00 → 16:00,
end exclusive. On October 9 the runner's preview itself requires this future
population window, so no preview/execution manifest was created or backdated.
No 522-unit addition, local receipt set or new T0 census exists yet.

API, frontend and original synchronization worker were restored after the
preparation checks. Private config now truthfully sets `writersQuiesced=false`.
When execution resumes, stop competing writers again and establish fresh
domain/file checkpoints and a new uniquely named, validated population backup.
Reinspect the actual target, policy and retained baseline; any drift stops for
review. Do not assume this preparation backup proves tomorrow's current rows.

Follow the [reviewed package](../handoffs/JOPIA-TO-LAT-POPULATION-PACKAGE-2026-10-09.md)
and [V2 source evidence](../handoffs/BUNO-OPERATIONAL-STOCK-522-V2-EVIDENCE.md):
within the approved window, preview actual OCR/collisions/global FEFO, review
its hash and fields, explicitly confirm with the validated backup, then review
the frozen execution digest before apply. If retained eligible stock displaces
members or the window expires, stop; do not change old stock or renew dates.
Use the same frozen manifest/envelope for resume and verify actual local
Fabric/API/workflow/census/restart results independently.

The inventory remains nine operational units, with 522 historical units kept
separate. V4 stays default; V5 approval, activation, near-expiry policy, human
UAT, physical OCR, full latency, clinical/deployment and Testing exit remain
separate. The approved preparation is not population acceptance.
