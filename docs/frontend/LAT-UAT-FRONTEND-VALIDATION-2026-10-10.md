# Lat UAT frontend integration — 2026-10-10

Classification: **SIMULATION_ONLY**. Owner/evidence: Lat, local automated
validation. These are HTTP-fixture browser results, not real API/Fabric, retained
population, physical OCR, human UAT or operational acceptance.

## Baseline and preservation

Branch: `codex/lat-uat-frontend`. Backend main `bf70eff` was fetched and merged
without conflicts, preserving the existing frontend work. The prepared pages
and J4 expiry implementation were published first at `4715941` in
[PR37](https://github.com/luisantonioj/bloodledger/pull/37). That commit includes
existing page presentation dependencies rather than isolating expiry from the
views it uses. Unrelated local documentation and visual-review changes remain
unstaged. No backend contracts, accounts, credentials, identities, database
records or volumes were changed; no services were redeployed, workers started,
or retained services restarted.

Sources: [Testing phase](../TESTING-PHASE.md),
[PR35 frozen contract](../handoffs/JOPIA-TO-LAT-UAT-BACKEND-CONTRACT-2026-10-09.md),
[OpenAPI](../../services/api/openapi-v2.json), issue #36, and Jopia's direct
handoff in this conversation. The [UAT runbook](../UAT-RUNBOOK.md#1-timeline-asiamanila) records the updated
Sunday review cutoff and unchanged population/T0 deployment hold. This does not approve
TP-G01–G03 or supply their missing decisions.

## Frontend behavior

- Reservation details offer prepare, dispatch, transit, receive, cancel,
  local-release-complete and compromise according to actual operator capability,
  operator role, institution, purpose, state and recorded preparation evidence.
  Each POST uses `expectedVersion` from the current reservation read. Prepare
  stays `ACTIVE`; its evidence enables dispatch or local-release completion.
  Reviewed evidence ID, digest and timezone-qualified preparation date are
  entered explicitly; the UI does not manufacture preparation evidence.
- Compromise options come exclusively from the authenticated four-code policy
  API. Missing, denied, altered, duplicate or unsupported policies fail closed.
  No free text; explicit confirmation describes quarantine pending manual
  review. Received stock remains `RECEIVED`, not usable stock (RQ-10).
- Component details place reconciliation holds using the authenticated seven-code
  policy and exact existing body. There is no release control. No fabricated
  expected-version/event-time fields are added to this request.
- Command IDs and saved request keys recover accepted commands through scoped
  GETs and resume polling. An ambiguous action offers lookup of its retained
  request key without another POST. An empty/mismatched lookup does not imply
  rejection or automatically resubmit. Ambiguous explicit retries preserve the
  exact original body/key; time-window rejection discards them for a fresh
  attempt. Framework 400/413/415 correction errors do not offer unchanged retry.
- Census discovery lists and paginates authenticated snapshot metadata, with
  checked scope and server column order. Scheduled/capture times remain source
  times, not claims of fresh inventory. Census capture/copy/export remain
  disabled. Historical counts are not substituted for operational census.
- Buno's `abc86ea` V4 wording was reviewed. Both versions describe requested
  units, not transfused units or stock. Current V4/V5 date and freshness checks
  remain; old access restrictions were not substituted for current authorization.
- J4 expiry states remain mandatory and fail closed. Pending label-expiry stock
  is not usable; reserved expiry requires the linked cancellation workflow.
  React sibling keys were corrected so refresh cannot duplicate workflow panels
  or discard accepted-command status.

## Automated evidence

From the retained checkout, without changing running services:

```bash
npm run check:web
npm run test:web
npm run test:web:e2e
npm run scan:secrets
git diff --check
```

Web type/build **PASS**; 146 unit tests **PASS**. Full browser suite **PASS**:
138 passed, seven intentionally retired V1 mutation fixtures skipped. Coverage
includes all seven reservation actions and operator-bound exact bodies, current
read version, confirmation, policy failure, reconciliation body/no release,
read-only recovery and lost-acceptance lookup, pending/committed/conflict/failure
states, fresh keys after time rejection, preserved keys after ambiguous failure,
framework correction errors, denied/missing resources, institution isolation,
401/logout clearing and late-response rejection. Census paging and denial
clearing are covered. Fixture success is not live API compatibility evidence.
Secret scan and whitespace checks **PASS**.

## Capture recovery

Capture retains account/institution ownership and now checks operator/command
identity on receipt updates. A terminal receipt's 24-hour clock starts at first
observation, never acceptance or replay. Expired detail is replaced with a
minimal command-ID/owner tombstone, preventing recreation; no OCR text, image,
Donation No., password or PIN is added to persistent storage.

Capture/session generations invalidate late OCR, verification, submission,
polling and restoration results. Clearing capture also clears the native file
input. Time-window rejection uses fresh confirmation keys/time; framework
correction errors clear the rejected capture instead of retrying it unchanged.
The existing compact receipt presentation was preserved.

The initial capture precheck **FAILED** with EACCES on generated OCR assets in
this checkout. Ownership was not changed. Validation ran on a source snapshot
in `/tmp/lat-uat-capture-validation`, with existing installed dependencies and
verified OCR assets; retained capture artifacts were not rebuilt successfully.
Reproduce the checks in that isolated snapshot:

```bash
cd /tmp/lat-uat-capture-validation
npm run check:capture
npm run test:capture
npm run test:capture:e2e
```

Capture type/build **PASS**; 23 unit tests and five browser tests **PASS**.
Browser evidence includes genuine synthetic OCR recognition with local assets,
volatile sensitive values/offline submission denial, one accepted command
polled to commitment without resubmission, owner isolation, observed terminal
retention/tombstones, and delayed recovery after logout. This is desktop browser
synthetic evidence, not physical Android/label accuracy evidence.

## Remaining review and execution dependencies

- Retained-host ordinary-cookie 5174 → 3000 API/Fabric workflows, census/population
  reconciliation, durability/restart and J9 dry run: **NOT_RUN** this turn,
  deliberately deferred until the population/T0 freeze ends and the tagged
  baseline is deployed per the [UAT runbook](../UAT-RUNBOOK.md). Port 5175 and HTTP
  interception do not count as acceptance. No population was performed here.
- Bank receipt uses the existing verified inbound-label flow; reservation
  `receive` is restricted to destination ROLE-03. No bank-role bypass was added.
- Request approval/cancellation/partial offers and requestor automatic supplier
  routing remain unavailable in the consumed contract. Existing disabled
  controls are not reservation actions. Jopia must omit unsupported tasks or
  supply a decision consistent with the frozen contract; no UI substitute was
  invented. Local-release details use their reservation reference and members;
  no nonexistent local-release detail endpoint is requested.
- TP-G01–G03 remain **BLOCKED** pending sanitized execution-window, instrument
  and threshold (3.50/3.51), participant eligibility/consent/facilitator/custodian
  decisions from Lat/Buno. No decisions were inferred from technical test passes.
- V4 remains default; V5 approval separate; near-expiry disabled. With V2 dates,
  new expiry evaluation cannot be demonstrated before October 13; existing
  expired evidence/acknowledgement may be used. Clinical, regulatory,
  production, operational activation and formal Testing exit gates remain open.
