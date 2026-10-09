# Lat retained actor validation — 2026-10-08

**Validator:** Lat, Codex-assisted local self-validation. **Classification:**
SIMULATION_ONLY. Technical preparation; no Testing-phase acceptance or UAT.

## Source and preservation

Jopia delivery `6e26606b6e5bdb56f8c772758790eb226646dc11` was fetched from
`codex/lat-retained-actor-mapping`. Its three commits were incorporated with
`cherry-pick -x` into `codex/lat-retained-validation-followup`; incorporated head
`99df429bde99caf651eb5ca4e95d8ab4275e3f7d`. Backend, chaincode, policy and
runbook content matched the delivery before the local correction below.

Corrected backend revision: `d5d9ad1526c372143224d6f78b920c67566a83b4`.
Existing authorized UI edits and the earlier validation note remain uncommitted
and preserved. Browser evidence describes the served editable workspace, not
a claim that those UI edits are part of the corrected backend commit.

Canonical WSL2 checkout, PostgreSQL `bloodledger_dev`, internal/host port 5432,
retained `bloodledger_postgres-data`, and channel `bloodledger-dev` were reused.
A private PostgreSQL backup and full account/assignment snapshot preceded
writes. The peer container was recreated only to repair a stale Docker Desktop
socket bind mount after laptop restart. Ledger/config volumes and identities
were retained. No account provisioning, role change, password replacement,
identity enrollment, reset or volume deletion occurred.

## Reproduced defect and correction

The additive Fabric upgrade installed `persistent-development-v1` at sequence
4 with existing Mediatrix endorsement settings. Both existing ROLE-02
Mediatrix and ROLE-03 synthetic recipient principals passed native and exact
public-wrapper inspection under `PERSISTENT_DEVELOPMENT_CORE_V1`.

The first genuine OCR registration committed VALID to the local ledger, then
projection failed with PostgreSQL SQLSTATE `23514`, constraint
`v2_components_policy`. The previously applied constraint accepted only
`INTERVIEW_DERIVED_CORE_V2` and `INTERVIEW_DERIVED_CORE_V2_1`. Jopia's new actor
policy produced an unsupported projection policy version. The command retained
its receipt as `LEDGER_COMMITTED_PROJECTION_PENDING`.

The [additive migration](../../database/migrations/20261008000000000_allow-retained-development-component-policy.js)
admits exactly the approved development version and both existing versions.
It changes neither accounts nor authorization. Applied migrations increased
from 26 to 27; reapply ran zero migrations. The
[real PostgreSQL regression check](../../tests/database/retained-development-policy.mjs)
accepts those three versions, rejects an unknown version, and rolls back every
test update. The runbook's no-migration statement was corrected.

Resume used the original frozen operational manifest and saved valid receipt;
it did not submit the first registration again.

## Recorded operational and census evidence

- Explicit initial operational date: 2026-10-08 Asia/Manila. Exact public
  wrapper preview recognized nine synthetic labels with genuine Tesseract
  field confidence 90–96 and the selected development policy digest. These
  dates/hashes remained frozen during recovery and replay.
- Public-wrapper resume and independent verify: nine components, all five
  types; six AVAILABLE, one RESERVED, one IN_TRANSIT and one EXPIRED.
- Three PENDING requests and two separate reservations, ACTIVE and IN_TRANSIT.
- Eighteen directly verified VALID local Fabric operations; receipt blocks
  span 164–278, interspersed with the independent historical import.
- Replayed component records and all 18 command/transaction receipts compare
  exactly equal to the recovered run. No duplicate operational commands or stock.
- Public-wrapper operational census: 40 combinations captured at
  `2026-10-08T02:45:42.859Z`, six available/eligible units and 34 verified zeros.
  Historical inventory is excluded. An earlier manually chosen future schedule
  was correctly rejected; the successful capture used actual current UTC time.

## Historical source and V5 review

Buno supplied the original external workbook. Lat independently verified
SHA-256 `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`.
The historical preview matched manifest SHA-256
`7b8c831d37667b1459c2b16707c5bf37cf72fe6cc12b2f24bf17a6ab2449af04`:
fixed source date 2026-10-07, 20 combinations, 486 AVAILABLE, 36 RESERVED and
522 deterministic historical components. Actual apply and replay both verified all 522 local components and 524 VALID
transactions. Direct historical verification after the full ordinary service
restart also passed; all three complete reconciliation reports compare equal.

The unchanged frozen model/image are reused. Public `forecast.sh preview`
prepared a separately scoped retained-target binding/job with origin 2026-10-07
and actual generation time `2026-10-08T02:38:45.038Z`. No forecasts were persisted.
The actual target hash and exact binding/job hashes were submitted in the
[PR #21 approval request](https://github.com/luisantonioj/bloodledger/pull/21#issuecomment-6051059154).
Jopia's separate explicit approval remains required. V4 stays default; calendar
rollover requires a newly reviewed job rather than timestamp edits.

The reproduced projection gap and published fix are in the
[PR #21 defect follow-up](https://github.com/luisantonioj/bloodledger/pull/21#issuecomment-6051154755).

## Checks and private evidence

API 114 tests and pinned-container chaincode 40 tests passed. Database static,
foundation, whitespace and the real migrated-constraint check passed. Gitleaks
history/index/candidate scans passed without leaks. A native chaincode build
encountered Docker-owned generated-file EACCES; the documented container rerun
passed without modifying source or permissions.

Reproduction follows the [updated runbook](../PERSISTENT-DEVELOPMENT-RUNBOOK.md):
`deploy-persistent-development.sh --apply bloodledger-local`, `run.sh inspect`,
`preview --date 2026-10-08`, exact-hash `apply`/`resume`/`verify`, independent
`census`, `historical-inventory/run.sh preview`/`apply`, and `forecast.sh preview`.
The API/web run through the documented retained container recipe on 3000/5174.
The general sync worker stays stopped. Fixture review on 5175 is separate.

Private command logs, frozen manifests, backup, account comparison and reports
are under ignored `build/lat-retained-followup/`. Runtime credentials, cookies,
workbook, original model, detailed target fingerprints and generated artifacts
remain outside Git. No Jopia transaction reference is used as local evidence.

## Populated browser evidence

The probe uses ordinary UI login, real HTTP and official HttpOnly cookies, with
no interception. A private adaptation of the supplied retained-browser probe
uses the restored navigation labels and explicitly checks the approval-gated
V5 UNAVAILABLE state; it does not claim the strict 20-forecast scenario passed.

Before and after ordinary PostgreSQL, orderer, peer, API and frontend restart:
PASS_NONFORECAST. Complete account/password/assignment rows remain identical
for all six accounts. All 522 historical projection rows and 524 import
command/receipt records remain identical across replay/restart. Direct operational
ledger verification after restart preserves the same nine assets and 18 receipts. Inventory V2.1 displays nine components across
all five types, including CRYO. Historical UI displays the fixed source date,
20 counts and pages of 50 generated components; authenticated API pagination
verified all 522 unique components and VALID local references. Dashboard total
is nine operational components, excluding historical stock. Transfers display
three PENDING requests and ACTIVE / IN_TRANSIT reservations with supported
local-release forms retained. Expired evidence and persistent off-chain
acknowledgement are visible. Audit separates 15 source-institution ledger
events from the off-chain acknowledgement; the other three seed operations
belong to the recipient institution. Global 18-operation verification uses
local ledger receipts rather than broadening audit access.

Analytics shows an explicitly selected V5 as UNAVAILABLE with no forecasts,
while independent CURRENT census evidence contains 40 combinations, six
available units and 34 verified zeros. V4 remains the default. All six original
accounts pass ordinary UI login; historical access is denied to ROLE-03–06 and
V2 audit denied to every role except ROLE-02. Recipient cannot read source
inventory; wrong-origin mutation returns 403. Logout returns protected history
to 401 and clears protected frontend controls.

Earlier private probe attempts correctly stopped on the still-incomplete
historical import and on probe expectations for uppercase alert wording and
institution-scoped audit counts. Correcting those probe expectations did not
change application behavior or access permissions.

## Remaining boundaries

V5 binding/job approval and the consequent 20-forecast/replay/browser checks
remain pending. Physical Android OCR, full Fabric-to-browser latency, research
participants/UAT, operational accuracy, reporting policy, V5 activation and
deployment are not completed by these checks. Near-expiry alerts and autonomous
recommendations remain disabled.
