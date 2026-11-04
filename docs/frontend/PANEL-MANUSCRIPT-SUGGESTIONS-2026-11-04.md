# Lat frontend manuscript suggestions — 2026-11-04

Proposed wording only. Not applied to Google Docs; no suggestion has been accepted.
SIMULATION_ONLY. Target: final IMRAD document
`1--PKwbCks5GUs6Y9JxzWu20QJ8mjg4LymneHhEDi_rQ`.
Use native Suggesting mode before inserting. Jopia retains backend, custody,
algorithm evaluation and test-result text. Do not replace those sections.

## Results: UI paragraph accompanying Figures 15–19

Suggested addition to the existing UI paragraph, after the dashboard description:

> The blood-bank dashboard shows exact available counts by blood group and component, with a visible number on each bar. Its detail view separates available, reserved, in-transit, received, label-expired, expired, held and compromised records. The displayed timestamp identifies the evaluated snapshot; changes awaiting ledger confirmation are reported separately and excluded from the counts. Band colors follow the synthetic demonstration policy and do not authorize allocation.

Suggested addition after the supplier FEFO review description:

> A supplier may approve all or part of a request. The review shows the requested and approved quantities, the selected FEFO units and a required reason for partial approval. Request and transfer details display the closed shortfall separately from the supplied quantity. When scanned receipt labels do not match the incoming reservation, the receiving facility can record a discrepancy. Both institutions can review its count-only status; receipt remains blocked while it is open. A successful recount or compromise resolution is shown separately from receipt confirmation.

## Scope and Limitations: frontend/scanner

Suggested clarification, without changing the account-participation disclaimer:

> The interface uses the authenticated facility's scope for inventory, requests and transfer records. Phone users access the facility-appropriate scanner workflow, while desktop users access the full authorized workspace. OCR suggestions require operator review; supported correction paths retain the original recognition evidence and require operator verification. The interface does not establish reliability for real institutional or handwritten labels, and automated browser tests do not replace physical-camera validation.

## Figure update checklist

- Figure 15: replace the dashboard panel with the exact available-count chart and expired-not-usable card. Retain correctly scoped login and inventory panels.
- Figure 16: replace the supplier review panel with approved quantity, reason and FEFO allocation visible. Retain the current scanner and requester form panels after review.
- Figure 17: show the six-digit operator dialog and requested/approved/shortfall and discrepancy status in the appropriate transfer panel. Keep activity history distinct from receipt verification evidence.
- Figure 18: retain V4 default / explicit V5 preview and simulation disclosures; no forecasting activation or accuracy claim is made by this frontend revision.
- Figure 19: final export heading and replacement images await the team's current DOH template. Do not label an invented heading as the official template.

Screenshots produced by route-mocked browser checks are synthetic UI evidence,
not retained-host transactions or independent institutional validation. Do not
mark all five composite figures refreshed merely because one panel is captured.

## Panel traceability

Dean Cherrie #1: expired-not-usable card. #2: partial approval and outcomes.
#3: exact chart, count table and exports. #4: DOH heading blocked on sample.
#5: per-hospital inbound/outbound presentation checks. Franze Q3: discrepancy
recording and resolution display. Backend enforcement and results remain Jopia's text.
