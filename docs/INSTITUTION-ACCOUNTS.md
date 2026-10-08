# Institution accounts — Jopia delivery

Status: implementation in progress. Classification: SIMULATION_ONLY.
Authorized by Jopia on 2026-10-08 in response to PR #24.
Branch: `codex/jopia-institution-accounts`; retained base: `daf4ada29b5a0346a804815817fde64f4893a390`.
Jopia owns backend/database/Fabric; Lat owns frontend integration and independent rerun.

## Decisions

ADR-036–039 and PA-ACCOUNT-01/02 supersede login-equals-role, selected
Medix/N.L. Villa application restrictions and PRC read-only administration.
One Fabric organization remains. All evidence is synthetic; RQ-14 real-data
retention and RQ-09/10/12/15 operational decisions remain open.

## Migration mapping

ROLE01/ROLE02 retained principals become Mediatrix operators without standalone
interactive access. ROLE03/ROLE04/ROLE06 retain original institutions/history
and lose interactive access. ROLE05 remains internal maintenance. New primary
accounts use the six supplied email identifiers. Existing inventory, donations,
commands, receipts, historical rows and institution IDs are never reassigned.

## Evidence

NOT_RUN: implementation validation, retained migration, browser integration,
Lat's independent rerun. No completion or deployment claim.
