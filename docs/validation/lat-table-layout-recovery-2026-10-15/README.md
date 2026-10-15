# Table layout recovery — 2026-10-15

## Current disposition

Table layouts are merged in PR #58; PRC UI/replay fixes are merged in #60/#61.
The remaining approved Analytics design is preserved on the normal review branch
`codex/lat-analytics-product-comparison`, stacked on the handoff/test cleanup
PR #62. The old `codex/lat-prc-with-table-layouts` preview was retired locally and
remotely after [normal design PR #63](https://github.com/luisantonioj/bloodledger/pull/63)
was published. Source comparisons to `c00e789` confirm
all Analytics/chart, coordination and style files are preserved exactly. The
sections below record the earlier recovery and preview evidence.


Classification: SIMULATION_ONLY. Owner/validator: Lat.

The saved table refinements were preserved in `codex/lat-layout-followups-20261015`
(PR #58, head `339350f`). The PRC UI branch (PR #60, head `860c2b1`) did not
include that branch, so switching to it displayed the earlier table layouts.
No saved layout commit was deleted.

`codex/lat-prc-with-table-layouts` combines both branches for the retained local
preview. PRs #58 and #60 remain separate review deliverables. Overlap resolution
keeps PRC reads/actions, table layout tests, compact quantity rows, full-width
Transfers/PRC tables, stacked dates/products and the removed status disclosures.
The connected PRC workspace supersedes the historical unavailable placeholder.
No backend, policy, data or account change.

Validation on the combined tree:

- `npm run check:web`: passed (existing bundle-size advisory).
- `npm run test:web`: 348 passed, including design-token checks.
- `npm exec --workspace @bloodledger/web -- playwright test pr51-table-contracts.spec.ts bank-table-columns.spec.ts activity-history-columns.spec.ts prc-supply.spec.ts --workers=1`: 24 passed.
- Live read-only Mediatrix checks: Transactions, Transfers and Activity History
  render without row status disclosures; Requested/Allocated column gap is 8px;
  no page overflow at 390px. Temporary screenshots were visually reviewed.
  Zero live domain POSTs.
- `git diff --check`: passed.

Historical preview URL: http://127.0.0.1:5174/. Switching branches changes what
the development server displays. The current working preview uses the normal
Analytics review branch above, which includes the merged table/PRC work and
PR #62’s test/docs follow-up.

## PR #61 follow-up — preserved preview

After PR #61 merged, PR #60 was rebased onto main `f26001d`, tested and marked
ready for review at head `8c256f5`. PR #58 (table layouts) and #59 (policy-status
docs) are also merged in that baseline. The delayed-replay finding is resolved;
frozen attempts and same-operator/body/key explicit retries remain intact.

The updated PRC branch was merged into this combined preview. The saved
Analytics source/styles and transaction, transfer-summary and audit components
were compared to design commit `93bbc58`: no changes. Read-only live checks
confirm both Analytics charts/component selection, all three recovered tables,
8px Requested/Allocated spacing and no 390px page overflow. Zero domain POSTs.

Combined-tree validation: check:web passed; 350 unit tests (including design
checks) passed; 41 browser cases passed with one worker (`prc-supply`,
`defense-analytics`, `pr51-table-contracts`). PR #60 separately passed 84 affected
browser cases. No retained API deployment, live PRC action, forecast/census
rerun, account change or data reset was performed in this follow-up.
