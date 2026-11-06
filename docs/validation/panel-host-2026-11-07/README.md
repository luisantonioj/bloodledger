# Panel revisions on the Jopia host: deployment and two-hospital partial approval (2026-11-07)

SIMULATION_ONLY. Jopia role, Jopia laptop. Reviewer of Lat's PR #109 (Lat authored the frontend;
Jopia is a different person, so the frontend review is independent). Not clinical, regulatory or
production evidence.

## Why the host was updated

The demo API (`bloodledger-public-api`) runs `node services/api/build/src/server.js` from the main
checkout. A Docker Desktop restart reloaded a panel-revision build that needed migration
`20261103000000000`, which the live database did not have yet, so reservation reads would fail. On
the owner's instruction ("do what Lat needs today"), the host was brought forward to the reviewed code
instead of rolled back.

| Step | Result |
|---|---|
| Code | Lat's PR #109 head `a8c6021` (on integration `540ceee`): API tests 253/253, web unit tests 508/508, web type-check clean. Full Playwright not re-run here (Lat: 267 passed, 7 skipped) |
| Backup | `pg_dump -Fc` of `bloodledger_dev` before any change (private, `build/panel-deploy-20261107/`, 66 table-data entries, SHA-256 recorded) |
| Migration | Only `20261103000000000_add-partial-approval-and-receipt-discrepancy` was pending. Applied with order checks off (host history quirk from 2026-10-19); 43 applied / 0 pending. Components 1,067, commands 1,704, reservations 61 and transfers 43 were unchanged |
| Rebuild/restart | Web `npm run build`; `docker restart bloodledger-public-api` (same container, environment and mounts); V2 worker started; peer `docker start` after the `docker.sock` mount failure |
| Checks | `/healthz` READY; `/api/v2/dashboard/stock-counts` routed (401 without a session) |

After restart the accepted scheduled expiry evaluator (PA-TC-03) began ledger-evaluating 546 units
whose labels had expired while the worker was off.

## Two-hospital partial approval (Dean Cherrie #2, PA-REV-01)

Synthetic accounts from the private six-digit credential package; operator PIN verification on every
command; no secret recorded.

| Step | Actor | Ledger transaction | Block | Validation |
|---|---|---|---:|---|
| SUBMIT_TRANSFER `TRF_PANEL_06261708`: 3 units O+ packed red cells, URGENT | Metro Lipa (ROLE-03) | `7ca017d830793f2bdb79e4dcf4c57ab1f9223f869ebfd1f43715562663238dc8` | 2409 | VALID |
| RESERVE_COMPONENTS `RES_PANEL_06261708`: approve 2 of 3 (FEFO), reason `LOCAL_RESERVE_PROTECTED` | Mary Mediatrix (ROLE-02) | `7917fbac327259f5a7e86d4f9d13fcb2e5853a5a67b9e36c2b1dea20acacba08` | 2410 | VALID |

Reservation read from each hospital's own account:

| Field | Mediatrix (supplier) | Metro Lipa (requester) |
|---|---|---|
| requestedQuantity / approvedQuantity / shortfallQuantity | 3 / 2 / 1 | 3 / 2 / 1 |
| partialApproval | `LOCAL_RESERVE_PROTECTED`, `SYNTHETIC_PARTIAL_APPROVAL_REASONS_V1` | same |
| Reserved units / status | 2 / ACTIVE | 2 / ACTIVE |

**Both views match.** The reservation stays ACTIVE for a later request-to-receipt walkthrough.

## Findings that block final screenshots

- **Stock has expired.** The V5 population is dated around 2026-10-21. On 2026-11-07, Mediatrix has
  10 label-current units (7 available, 3 reserved); 479 more were awaiting ledger expiry evaluation and
  567 were already EXPIRED. The last unit expires 2026-12-01. Medix has none usable and N.L. Villa has
  no recorded stock. Final stock and dashboard figures need a new dated synthetic population (a separate
  decision; Buno scenario plus Jopia runner).
- **Browser access.** The API accepts only its configured web origin (the 2026-10-21 tunnel address,
  secure cookies). The tunnel is down, so browser sign-in at `http://127.0.0.1:3000` fails. A browser
  walkthrough needs the tunnel re-created (`build/defense-demo/go-live.sh`; VPN or hotspot) or a
  local-origin API configuration.
