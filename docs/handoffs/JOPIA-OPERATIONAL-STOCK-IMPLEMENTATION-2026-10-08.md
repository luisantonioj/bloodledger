# Jopia operational-stock implementation evidence — 2026-10-08

Classification: **SIMULATION_ONLY**. Jopia technical self-validation, not Lat
retained-host acceptance, human UAT, clinical validation or deployment.
Implementation contract: [controlled population](../OPERATIONAL-STOCK-POPULATION.md).
The initial attempt was **BLOCKED for live population**. The user's subsequent
blocker-repair instruction and verified account/service/archive recovery are
recorded in [the follow-up evidence](JOPIA-STOCK-HOST-RECOVERY-2026-10-08.md).
Population still requires its exact OCR manifest confirmation and local receipts.

## Ancestry and review disposition

Implementation branch: `codex/jopia-operational-stock-population`, isolated from
the user's unchanged `codex/lat-retained-actor-mapping` checkout. Base is retained
integration `954f170b840fce1a346bb3bd393748a731be1913`; verified ancestry includes
`639d600a53db4867ca943caa8afae36452ad348b`, PR25's
`8b2df89a1f2ddf78d91f1557f8f5bac33a76dfa8` and gateway/seed fix
`6c72c6e4d9570936ffc265fa70d66e7eed531e13`. Main was not used.

Buno's generator `7e29fd98f7dcd7d7f137c7a9721827b05b66aa74` and evidence
`17e22d1edb853fd6964b2edecddaad05c6a55383` are incorporated as cherry-picks
`fe576cd` and `6926c15`. Implementation commit IDs are returned on PR27 after
publication; this record is versioned with those commits.

The user's accepted plan selects TP-STOCK-01 technical implementation, genuine
OCR/explicit confirmation under ADR-035, Mediatrix issuer/custodian and Medix
transfer destination subject to actual target/artifact/global-FEFO checks.
No direct bulk-import exception was introduced. The fixed Oct8 16:00–Oct9 08:00
Manila population window and Oct9 08:00–16:00 verification window remain
unchanged and exclusive at their upper bounds. Approval of this implementation
does not approve an execution hash, a different target or V5 persistence.

## Artifact evidence

The already-held original workbook was independently read. Its SHA-256 is
`5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`.
Exact reproduction using Buno's revision and `2026-10-08T06:46:27Z` generation
instant passed his verifier against that workbook:

- Manifest file: `4ad33820481b1e331e71ac03bbf37ed719096a3fc33c6321829a73d7e3b5fe70`.
- Canonical manifest: `311395e58126cc7af9e72ad8ecc5cf7708e868531eadb0c1924743901e8f8fc8`.
- 20 source series, including AB+ platelet zero; 522 singleton donation groups;
  24 reservations covering 18 TRANSFER and 18 LOCAL_RELEASE units.
- 13 transfer reservations/requests and 11 local reservations produce 559
  planned commands: 522 intakes, 13 destination requests and 24 reservations.

The supplied Drive reference resolves through the Google Drive plugin to
`buno-operational-stock-522-v1.zip`, 15,853 bytes. Its authenticated streamed
download returns HTTP 403. Expected ZIP SHA-256
`cf94af36cbc672d58377b13c0e3e9ebbd922289e464f15e9214e03d4abb2c206`
is **UNVERIFIED**. Manifest reproduction is verified; ZIP delivery/receipt is
**BLOCKED**, not falsely marked passed. The runner requires the actual ZIP
bytes and independently verifies its hash before preview.

## Checks and reproducible commands

WSL Bash/Python 3 and Docker were used. Native Node is absent; Node 24.17.0/
npm 11.13.0 ran from `node:24.17.0`. OCR used the existing development tools
image built from Playwright 1.61.1 Noble and pinned Node, Tesseract.js 7.0.0
and the existing parser/language assets. PostgreSQL integration used 17.10.
All raw artifacts, recognized fields, signed envelopes and logs are external
private files; none are committed or attached to the PRs.

| Check | Result | Evidence/limits |
| --- | --- | --- |
| Buno generator/source verifier | PASS | 31 tests; exact bytes/canonical hash and all 20 source series |
| Development-data planner/client/recovery | PASS | 22 tests; hashes, dates, OCR boundaries, FEFO/ties, owner drift, late recovery, preservation, forty-series census |
| API unit/authorization/contracts | PASS | 125 tests; local FEFO versions, CRYO, immutable replay and wire descriptions included |
| Chaincode | PASS | 41 deterministic/transition tests; lint/type/static boundaries passed |
| Disposable PostgreSQL | PASS | Stock writer lock, official grant/intake, journal privileges, saved envelope, projection failure/retry, replay, linked local reservation and preservation |
| Existing institution integration | PASS | 150 assertions, including isolated cookie browser checks, retirement, institution scope, PIN expiry and onboarding regression |
| Full genuine OCR diagnostic | PASS | 522/522 labels, five types; minimum field confidence 90; no raw images/unrestricted text saved |
| Format/workspace/versions/env/database/ignore | PASS | Repository checks; host Git paths used for worktree-aware ignore/static checks |
| API/web types and web build | PASS | Existing wire names preserved |
| Dependency audit | PASS | Zero vulnerabilities with `--omit=dev --audit-level=high` |
| Gitleaks | PASS | Full history, index and candidate content; pinned 8.30.1 image |
| Live runner prerequisite refusal | PASS | `STOCK_ACCOUNT_MIGRATION_REQUIRED`, before sessions/commands/mutations |
| Delivered ZIP bytes | BLOCKED | Authenticated download HTTP 403 |
| Reviewed target/global FEFO/backup/preview/confirmation | BLOCKED | Current host differs from Lat's retained account/service baseline |
| Live apply/resume/Fabric transactions/API 531/census/T0 | NOT_RUN | No stock population or acceptance claim |
| Ordinary retained service/infrastructure restart | NOT_RUN | Requires actual accepted target and saved execution |
| Independent Lat browser 5174 → 3000 | NOT_RUN | Isolated browser fixtures are not this acceptance |

Full OCR diagnostic evidence digest:
`e12497970ee523abf9c538339c6d0dfd2e03b1a149124013bde193527e462e89`.
This identifies one genuine diagnostic run with capture times and fixture
label IDs. It is **not** a live preview/confirmation/execution hash.
Database recovery tests deliberately use fabricated signed-envelope/transaction
fixtures, clearly labeled `FABRICATED_TEST_EVIDENCE`; they prove recovery logic
and never count as VALID Fabric evidence.

```bash
python3 -m unittest discover -s scripts/operational-scenario -p 'test*.py'
python3 scripts/operational-scenario/verify.py --workbook "$PRIVATE/source.xlsx" \
  --manifest "$PRIVATE/scenario.json" \
  --sha256 4ad33820481b1e331e71ac03bbf37ed719096a3fc33c6321829a73d7e3b5fe70
docker run --rm -v "$PWD:/workspace" -w /workspace node:24.17.0 npm run test:development-data
docker run --rm -v "$PWD:/workspace" -w /workspace node:24.17.0 npm run test:api
docker run --rm -v "$PWD:/workspace" -w /workspace node:24.17.0 npm run test:inventory-contract
bash tests/accounts/postgres-integration.sh
bash tests/chaincode/static-inventory-contract.sh
bash tests/repository/ignore-paths.sh
docker run --rm -v "$PWD:/workspace" -w /workspace node:24.17.0 \
  sh -ec 'npm run check:format && npm run check:workspace && npm run check:versions && npm run check:env && npm run check:database && npm run check:web && npm audit --omit=dev --audit-level=high'
bash scripts/scan-secrets.sh
# Builds/prepare OCR first, then runs only isolated recognition:
docker build -t bloodledger-development-tools:local \
  -f scripts/development-data/Dockerfile scripts/development-data
docker run --rm --init --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -v "$PRIVATE:/private" -w /workspace \
  bloodledger-development-tools:local node tests/development-data/stock-ocr-probe.mjs \
  /private/scenario.json /private/new-ocr-diagnostic.json
```

The exact controlled backup/preview/confirm/apply/resume/verify commands and
private primary/operator configuration are in the implementation contract.
Those live commands remain untested on a valid retained target. The API static
boundary passed with host ripgrep mounted into the Node container. Initial
test defects were fixed and rerun: canonical key ordering, missing PostgreSQL
command digest on replay, disposable foreign-key cleanup order and JSON
formatter differences. No scan allowlist or authorization rule was weakened.

## Current host and preservation

The current Jopia-host PostgreSQL contains **two ACTIVE older accounts** and
**26 applied migrations**, with no applied six-primary-account migration.
The Fabric peer is stopped with exit 127; retained API/web services are also
stopped. This does not match Lat's six-account/thirty-migration/sequence-5
baseline. The previously published target fingerprint
`3ddfcfd9398fc720822ac25acd6524dff8098335513301728ca84520eda5f074`
was not treated as live approval. No missing accounts were provisioned,
identities reenrolled, migrations applied to the retained database, volumes
reset or old data changed to force a match.

Read-only private preservation evidence covers 46 application tables and 110
generated identity/configuration files plus retained PostgreSQL/peer mounts.
Before-evidence file digest:
`03a58b3e7989c4edaaceadc4c48f714cac18ec372a885ec63946bd2d7216667e`.
After-evidence file digest:
`e73e76c2a898bca081307faf6e26038f2fbd6336d524ea13364045b8f441b26b`.
All 46 table fingerprints, 110 generated-file fingerprints and canonical
volume/mount mappings compare **PASS**. Raw Docker mount array order changed;
sorting by container/volume/source/destination resolves that representation
difference without ignoring any mount or content change. This proves retained
preservation during implementation, not population/replay/restart acceptance.
The existing nine operational units remain six AVAILABLE, one RESERVED, one
IN_TRANSIT and one EXPIRED. Historical components remain 522. Actual account
and ledger acceptance on the intended six-account host is still pending.

| Population | AVAILABLE | RESERVED | IN_TRANSIT | EXPIRED | Total | Disposition |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Current actual operational baseline | 6 | 1 | 1 | 1 | 9 | Read-only verified counts |
| New scenario | 486 | 36 | 0 | 0 | 522 | Verified source/plan, not applied |
| Combined if baseline preserved | 492 | 37 | 1 | 1 | 531 | Conditional target, not actual acceptance |

There are no new local Fabric receipts, execution hash or accepted census to
publish. Once ZIP receipt and the actual reviewed host are available, Jopia
must execute the contract, publish exact 559 receipt identities/block evidence,
baseline comparisons, all twenty source reconciliations (including the zero
row), forty operational census/API combinations and exact replay/restart
evidence. A missed V1 window requires Buno's new version and review.

## Remaining Lat integration

Use the component/reservation/navigation contract in the implementation
document and OpenAPI. Component reads expose `inventoryStatus`,
`inventoryVersion`, `reservationVersion`, issuer/custodian, dates and IDs.
Purpose is sourced from reservation reads. Match `transferId` against scoped
`/api/v2/transfers` entries' existing `transfer_id`; local release uses
reservation detail, `localReleaseId` and members. No standalone local-release
detail endpoint exists. Null/denied/missing references retain safe scoped
behavior; Donation No. values remain private. Alerts/audit must use existing
authenticated reads; near-expiry remains disabled.

After Jopia's accepted population, Lat independently verifies ordinary primary
cookies and real API calls on 5174 → 3000: six-account login/isolation,
531-vs-522 count distinction, CRYO, details/reservation/workflow links,
QUEUED/SUBMITTING/projection-pending/COMMITTED/retry/failed/conflict displays,
safe missing/denied behavior, logout and ordinary restart. Intercepted fixtures
or 5175 do not count. Keep unknown historical dates/purposes unchanged.
V4 remains default. V5 binding/job persistence, yesterday's Manila origin and
actual generation instant need their separate review; no model reconstruction,
retraining, activation, physical OCR, full latency, UAT, clinical or deployment
gate is closed by this evidence.
