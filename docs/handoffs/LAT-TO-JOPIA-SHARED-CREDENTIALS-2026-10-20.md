# Lat → Jopia: shared development credentials

2026-10-20, Asia/Manila. SIMULATION_ONLY. User-authorized credential maintenance;
self-validation only. No independent teammate review or production claim.

## Current state

Lat's retained host now uses six distinct institution-account passwords, **exactly 12 characters each**, and
twelve distinct six-digit operator PINs. Each identity is intended to have the
same credential on both laptops; this is not one password/PIN for all identities.
Existing account IDs, role assignments, institution identities and blood records
were preserved. All former account sessions and operator grants were revoked.
The earlier long account passwords are superseded; the six-digit PINs from
the first shared package remain unchanged.

Jopia's host has NOT been changed. Matching credentials require importing the
same private package there, after deploying the accompanying PIN-policy code.
The initial credential operation was local-only. Its code is now included in
the combined `lat-sync-20261020` delivery; use [the final handoff](LAT-TO-JOPIA-COMPLETE-EVENING-UPDATE-2026-10-20.md)
for the published source commit. The private credential-only patch is a fallback,
not a replacement for the complete source update; do not reapply it over code
already obtained through Git.

## Private transfer

Prepared locally, not uploaded or sent:

- `build/accounts/shared-credentials.json`: canonical immutable package (0600).
- `build/accounts/bloodledger-shared-credentials-transfer-20261020.zip`: private
  transfer package containing that file, a credential-only source patch,
  instructions and a checksum manifest. It contains plaintext secrets.
- `build/accounts/LOCAL-ACCOUNT-ACCESS.txt`: local readable derivative.
- `build/accounts/private.json`: compatibility symlink to the canonical package.

None belongs in Git, PR text, chat, a public link or an evidence attachment.
Transfer privately; independently verify the package checksum:
`28e83ae9c2a601c37865a66ec7d70088a6807f22aa639429554f81b7312a80ea`.

Follow [the import procedure](../../scripts/institution-accounts/SHARED-CREDENTIALS.md).
Review the source patch and run `git apply --check` first; stop on conflicts.
Do not overwrite unrelated files. Build as the normal user with Node 24.17.0.
Check exact account/operator roster compatibility, quiesce writers, take and
validate a fresh private custom-format backup, then use the explicit import.
Set `BLOODLEDGER_OPERATOR_PIN_POLICY_VERSION=SYNTHETIC_OPERATOR_PIN_6_V1`
only with the matching code and credentials. Verify session `operatorPinLength`
is 6, all logins/PINs work and domain fingerprints remain unchanged.

Do not copy Lat's `.env`, Fabric material, runtime config, database or backup.
Do not regenerate the package on Jopia's host. A roster mismatch is a blocking
coordination issue, not permission to create, reactivate or remap accounts.

## Initial six-digit rollout validation

- API build and 244 API tests passed; web type check and 481 web tests passed.
- Affected synthetic Playwright suite: 9 passed, pinned v1.61.1 container,
  DejaVu fonts, `--workers=1`.
- Isolated restored-database test: rotation and exact replay passed; wrong
  checksum, foreign roster, duplicate PIN and non-private file were rejected.
- Actual retained host: all 6 account logins and 12 PIN verifications passed;
  24 four/eight-digit inputs rejected; the prior session returned 401.
- Actual browser on 5174: six-digit dialog confirmed; confirmation cancelled;
  no domain transaction submitted.
- Identities and domain fingerprints unchanged. Counts: 9 institutions,
  23 users, 1 onboarding application, 535 components, 27 reservations,
  598 commands, 0 census snapshots. Account audit increased 7 → 8 for one
  explicit maintenance event, not a blood transaction.
- API READY; web 5174 running; UAT worker restored with zero pending commands;
  dedicated checkpoint scheduler healthy; general sync worker stays stopped.

Private backup and evidence are in
`build/shared-credentials-rollout-private-20261020/`.
Fresh validated backup SHA-256:
`7898bd090e0024aee3494c94fd8c80417708169af46745125fd4760807ea24b9`.
No migration, account creation, clinical command, census/forecast rerun or Fabric
change was performed. Jopia should report his own backup, preservation checks,
policy, login/PIN results and package checksum before synchronization is closed.

## Twelve-character password adjustment — same day

The user's follow-up replaces the earlier long passwords with exactly 12 random
alphanumeric characters per account, keeping passwords distinct. The new
`SYNTHETIC_ACCOUNT_PASSWORD_12_V1` package has a new bundle ID and supersedes
the earlier package. **Use the updated ZIP and checksum above.** Discard older
transfer copies; preserved evidence/backup copies remain private.

All twelve PIN values, PIN hashes and operator versions were unchanged during
this password-only rotation (`operatorsUpdated: 0`). Jopia can import the revised
package directly whether or not he imported the previous one; matching PINs are
left intact. If he has applied the previous source patch, integrate only the
revised importer/docs instead of blindly applying the whole patch again.

A fresh private custom backup was validated first. Its SHA-256 is:
`5151c0390ef01e8555811523a0dfe44735a064c5b1248490503c90a0a33f5f7d`.
Follow-up private evidence: `build/shared-password12-private-20261020/`.
Isolated tests passed for apply, replay, unchanged complete operator rows and
rejection of 11-/13-character passwords in the new package format. Actual host
checks passed for all 6 account logins, all 12 unchanged PINs, 24 invalid PIN
lengths and old-session rejection. Domain and identity fingerprints matched.
One password-maintenance audit was appended, 8 → 9; domain counts are unchanged.
The API/web code needed no rebuild or change for 12-character passwords. The
running services were restarted on their existing configuration; UAT restored,
general sync off. No domain transaction was submitted. Jopia's import remains
pending. Credentials were never uploaded or committed; subsequent source
publication is recorded in the final combined handoff.
