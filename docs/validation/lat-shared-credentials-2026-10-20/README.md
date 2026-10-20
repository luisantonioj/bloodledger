# Shared development credentials — Lat host

SIMULATION_ONLY; user authorized 2026-10-20, acting as Jopia.
Self-validation, not independent review.

See [handoff](../../handoffs/LAT-TO-JOPIA-SHARED-CREDENTIALS-2026-10-20.md) and
[procedure](../../../scripts/institution-accounts/SHARED-CREDENTIALS.md).
Secrets, full Docker configuration, backup and private test artifacts remain
ignored under `build/shared-credentials-rollout-private-20261020/`.

Six account passwords and twelve operator PINs rotated transactionally;
six-digit policy selected. Exactly one maintenance audit appended, 7 → 8.
All domain and non-credential identity fingerprints matched before/after and
after runtime restart. Existing sessions/grants revoked. No domain writes,
new account, migration, Fabric change or census/forecast rerun.

| Verification | Result |
| --- | --- |
| API suite / build | 244 passed |
| Web type check / unit suite | passed / 481 passed |
| Focused pinned Playwright, one worker | 9 passed |
| Disposable clone apply/replay | passed, one audit total |
| Invalid hash/roster/duplicate PIN/file mode | rejected without writes |
| Live account/password checks | 6 passed |
| Live operator/PIN checks | 12 passed |
| Wrong-length inputs | 24 rejected |
| Prior session | 401 |
| Actual 5174 PIN dialog | six digits; cancelled without domain submission |
| Build ownership | 0 foreign-owned entries |
| Runtime | READY; web running; UAT zero queue; checkpoint scheduler healthy |

Protected counts remain: institutions 9, users 23, applications 1, components
535, reservations 27, commands 598, census snapshots 0. General sync stays off.
No full-browser or physical-device claim is made. Jopia's host remains pending
private package/source import and host-specific validation. Source edits are
saved locally without a commit, push or PR.

## Follow-up: exactly twelve-character passwords

User requested the same day. New versioned package, six distinct 12-character
passwords, all twelve six-digit PIN values/hashes/operator versions unchanged.
The importer skips already matching PINs. Isolated apply/replay and invalid
11-/13-character package tests passed. Actual API checks: six account logins,
twelve PIN verifications, 24 wrong-length PIN rejections, prior session 401.
Domain and identity fingerprints unchanged. One further maintenance audit,
8 → 9. Fresh validated backup and evidence remain private under
`build/shared-password12-private-20261020/`. Canonical account list, package,
ZIP, source patch and handoff updated; superseded versions archived privately.
No API/web rebuild, migration or domain command. Nothing uploaded or committed.

## Publication follow-through

The local-only statements above describe the state at each validation checkpoint.
This work is included in the combined `lat-sync-20261020` delivery; use
[the final handoff](../../handoffs/LAT-TO-JOPIA-COMPLETE-EVENING-UPDATE-2026-10-20.md) for its source commit, consolidated results
and current cross-host instructions. Private runtime files and credentials
remain outside Git.
