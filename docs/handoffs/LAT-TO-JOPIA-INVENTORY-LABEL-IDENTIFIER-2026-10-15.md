# Inventory printed-label identifier read gap

User requests the Blood Inventory ID column match the supplied HTML mockup's printed unit identifiers, such as `=)W0381 2509 100023`. These are illustrative mockup strings; they are not established label values for retained inventory.

Current V2 inventory reads provide opaque `componentId` and `donationId` values. Inbound intake creates component IDs from the idempotency key (`generatedId("COMP_", idempotencyKey)`), encrypts the confirmed Donation No. off chain, and returns no printed Donation No. in the inventory component read. Existing ID values are retained; replacing them with mock identifiers would break traceability and misrepresent labels. No private population mapping is embedded in the frontend and no encrypted field is exposed by this change.

Jopia: define an authorized institution-scoped printed-label display contract, including whether a masked or full identifier is approved, exact field/format, source provenance, uniqueness across components from the same donation, and search/export permissions. The frontend can then display that field while keeping `componentId` as the technical record/action key. Do not derive a purported ISBT/printed identifier from hashes or copy mock label IDs onto unrelated retained units.

Frontend work completed separately: actual Manila expiry dates formatted YYYY-MM-DD; mockup dot pills for time/status; gray expired elapsed-time pills; View reservation and its Actions column removed. Mockup 3/7-day visual bands do not resolve RQ-03 or modify component expiry policy, expiry evaluations, FEFO or availability. Label-expired AVAILABLE records display a nonusable pending/expired label rather than a green Available badge.
