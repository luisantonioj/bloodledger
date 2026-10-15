# Bank-page hermetic validation — 2026-10-15

Lat; SIMULATION_ONLY. Baseline main `014d862`. No backend, policy or parser change.

## Result

- `blood-bank-pages.spec.ts`: **13/13 passed**, one worker, **no listener on
  127.0.0.1:3000** in the test network namespace.
- Same isolated run including `prc-supply.spec.ts` and
  `pr51-table-contracts.spec.ts`: **34/34 passed**.
- No Vite proxy connection errors and no unexpected fixture API routes.
- `npm run check:web`, `npm run test:web`: passed (**350 unit tests**, including
  design-token coverage); explicit design-token selection: **2 passed**.
- `git diff --check` and repository secret scan: passed before publication.

Retained services were not stopped. A new user/network namespace had only its
own loopback and an isolated virtual interface, with no host/external route.
The interface keeps Chromium's navigator.onLine true; loopback alone makes the
browser report offline and would bypass the inventory reads under test. TCP
connection to port 3000 was verified refused before Playwright started. This
proves backend independence without changing retained services or data.

## Fixture and assertion audit

| Surface | Repair / preserved checks |
|---|---|
| Scanner iframe | `/capture/?layout=receipt` gets explicit inert synthetic HTML. Tests still open, verify the exact frame URL, change direction and close it. OCR functionality is not claimed; no request reaches the Vite capture proxy. |
| Optional coordination | Source surplus, redistribution and request priority receive explicit 503 synthetic unavailable envelopes. Unexpected API paths fail afterEach rather than silently using a real API or a generic success. |
| Inventory export | Supplies genuine labelIdentity-shaped synthetic printed labels. PDF must contain only the selected label, exclude the other label, both technical component IDs and donation ID, and retain its filename/PDF signature. |
| Disabled import/export | Assert current accessible "… unavailable" trigger is aria-disabled and the real native button remains disabled. No enabled fallback or removed disabled-action assertion. |
| Transfer filters | Inspect pending ledger state in the actual request detail. Keep request/reservation separation, exact record IDs, independent filters, empty result, hidden commands and mobile checks. Empty wording is the current "loaded records" wording. |
| Transactions | Stub UNIT_HISTORY_READ_V1 inbound/outbound rows instead of the obsolete audit-only source. Keep two-row/filter counts, PDF inclusion/exclusion, scanner frame and mobile assertions. |
| Inventory/detail/error states | Keep component filters, unavailable label, current expiry evidence, fixed headers, failed/empty reads, disabled export and responsive checks. |

Every API request has a synthetic fixture or named unavailable response.
The catch-all returns an error and records an unexpected path; afterEach requires
that list to be empty. Mutation guards and existing assertions are retained.
The capture fixture is navigation-only; it never imports a live scanner bundle.

## Reproduction used on Lat host

Dependencies and browser binaries were already installed; no network install.
From the repository root, Node 24.17.0 on PATH:

```bash
export PATH=/home/yuri/.nvm/versions/node/v24.17.0/bin:/usr/local/bin:/usr/bin:/bin
unshare --user --map-root-user --net bash <<'ISOLATED'
set -e
ip link set lo up
ip link add fixture0 type veth peer name fixture1
ip addr add 192.0.2.1/24 dev fixture0
ip link set fixture0 up
ip link set fixture1 up
node <<'PROBE'
const net = require('node:net');
const socket = net.connect(3000, '127.0.0.1');
socket.on('connect', () => process.exit(1));
socket.on('error', error => {
  if (error.code !== 'ECONNREFUSED') throw error;
  console.log('Confirmed: no listener on 127.0.0.1:3000');
});
PROBE
npm exec --workspace @bloodledger/web -- playwright test \
  blood-bank-pages.spec.ts prc-supply.spec.ts pr51-table-contracts.spec.ts --workers=1
ISOLATED
```

On a host that already has no API on port 3000, the ordinary Playwright command
is sufficient. The namespace is only how Lat proved that condition while
preserving its retained API. No live domain/PRC action, reset, repopulation,
account/operator change, census or forecast run occurred.
