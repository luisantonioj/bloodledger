# Lat → Jopia: Blood Inventory printed-label IDs

Date: 2026-10-15 (Asia/Manila)
Owner requested: Jopia — backend/API and identifier read contract
Frontend follow-up: Lat
Scope: SIMULATION_ONLY retained defense dataset; presentation and authorized reads
Status: frontend ID replacement is pending the backend contract below

## Requested outcome

The user wants the Blood Inventory table to show the blood bag’s recorded printed-label identifier, matching the supplied mockup’s human-readable presentation, instead of a long internal `COMP_…` ID.

Reference: `C:\Users\Yuri\OneDrive\Documents\Bloodledger\Bloodledger Frontend\bloodledger-full-mockup.html`.
The mockup calls its first column **Unit ID**, with examples such as `=)W0381 2509 100023`. This is an illustrative mockup string, not a validated identifier format or an established label value for any retained bag. Do not assign it to a live retained record or assume every issuer uses this format.

## What Lat found

- `services/api/src/v2-routes.ts`, inbound capture: `componentId = generatedId("COMP_", idempotencyKey)`. It is an internal record key, not a blood-bag number.
- The same capture flow derives `donationId` from issuer identity and the encrypted Donation No. lookup HMAC. `DON_…` is also an opaque technical reference, not the printed number.
- The confirmed captured Donation No. is encrypted off chain. Current component list/detail reads do not expose an approved human-readable printed-label identifier.
- `apps/web/src/services/api/v2.ts` defines/parses the component read, and `apps/web/src/features/inventory/v2-inventory-view.tsx` displays `componentId` and uses it to open the real component detail.

Lat has deliberately retained the real IDs. No fake label values, hash-to-label conversion, private population mapping, identifier reseeding or backend decryption were added to the browser.

## Backend work requested

1. Establish which recorded field is the displayed identifier: captured Donation No., a component-specific printed label/product identifier, or another issuer-supported value. Clarify whether one donation can produce several component rows sharing the displayed number and how the UI distinguishes them.
2. Define an approved institution-scoped display read for the component list and detail. Confirm whether full or masked values are permitted for each account/role. Keep existing authentication, custody scope and authorization; the mockup is not authorization for broader access.
3. Return an explicit missing/unavailable outcome for older or unsupported records. Do not fabricate a number from `componentId`, `donationId`, row position or mock fixtures.
4. Keep decryption and issuer-aware formatting on the server. Exclude ciphertext, nonces, lookup HMACs and encryption keys from the public response. Do not add printed numbers to ledger payloads, application logs, error diagnostics or unrelated aggregate/reporting reads.
5. Update `services/api/openapi-v2.json` and the applicable version/compatibility documentation. Specify field types, availability/provenance, issuer handling, formatting rules and the role/scope matrix. Include search and PDF export permissions explicitly.
6. Keep all current `componentId`, `donationId`, reservation references and command/version/idempotency behavior unchanged. Provide the display identity separately; it must not become the mutation key.

### Suggested response shape for discussion

A nullable display field such as `labelDisplayId: string | null` could accompany the existing opaque `componentId`, with a documented availability/provenance indicator if required. This name and shape are a proposal, **not an implemented or accepted API contract**. Jopia should choose the final representation and confirm any contract header/version change before Lat wires it.

Do not call an arbitrary label value “ISBT-128” unless its recorded source and format support that claim. Preserve meaningful issuer prefixes, leading zeros and separators; avoid blindly reformatting all labels to the mock example.

## Lat’s frontend follow-up once the contract is ready

- Show the authorized printed identifier in a **Unit ID** or agreed label column, using the mockup’s compact monospace presentation.
- Keep the underlying `componentId` for row keys, details, deep links and commands. Retain technical identity in component details where appropriate.
- Display a clear fallback when no printable identifier is available. Do not show a copied mock label or an empty value that implies a confirmed ID.
- Update the typed response parser, table, authorized search and PDF output according to the final contract. Older compatible responses must fail safely or use the agreed fallback.
- Verify that two components sharing a donation identifier still open their own correct record, and that issuer-specific numbers remain distinguishable.

## Acceptance checks

- A recorded synthetic captured label renders correctly in its owning/authorized inventory scope and matches the confirmed source value.
- Another institution cannot obtain an unauthorized label via list, detail, deep link, query filtering or export; regulatory aggregates do not gain raw identifiers.
- Missing evidence, missing keys or decryption failure produce the agreed unavailable result without leaking diagnostics or inventing an ID.
- Shared-donation components retain distinct `componentId` references; clicking either displayed label opens the correct component and commands still bind to its exact version.
- Existing retained inventory, reservations, accounts, identities and volumes are preserved. No reset, repopulation, recapture, census rerun or forecast rerun is necessary for this display work.
- OpenAPI, backend authorization/provenance tests and frontend parser/table/browser coverage accompany the change. Use synthetic fixtures; do not commit real label data, secrets or private mappings.

## Related frontend work already completed

Local branch: `codex/official-demo-stock-bands`.
Inventory styling commit: `b02fb64` (`Align inventory expiry dates and badges with table mockup`). These local commits have not been published as a new PR by Lat.

- Actual expiry dates now use `YYYY-MM-DD` in Asia/Manila; full timestamp remains available in details/hover.
- Time/status use mockup-style dot pills, with gray expired elapsed-time badges.
- The mockup’s 3-day/7-day colors are display bands only. They do not resolve RQ-03 or change clinical expiry policy, FEFO, ledger state or usability.
- Label-expired AVAILABLE records show pending expiry evaluation/expired rather than green Available.
- View reservation and its empty Actions column are removed from this table.

Validation for that completed frontend change: web build/type check passed; 246 unit tests across 39 files passed; 10 affected browser tests passed; 2 design-token checks passed after the gray tokens were added. Live inventory reads were checked without submitting domain commands.

## Reply requested from Jopia

Please provide the backend branch/PR and the finalized list/detail contract: display field(s), full/masked access rules, supported issuer formats, unavailable/fallback behavior, shared-donation identity handling, search/export rules and required contract version. Lat can then replace the ID presentation while preserving every technical record reference.
