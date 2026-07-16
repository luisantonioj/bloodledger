# Disposable health-contract boundary

This Sprint 1 directory contains only the disposable infrastructure health
contract specified in `network/README.md`. It is an npm workspace with exact
dependency pins, TypeScript source, contract tests, a deterministic generated
package area below ignored `build/`, and the smallest Fabric Gateway event and
query validator needed by S1-07.

It is not BloodLedger feature chaincode and must not be moved into or extended
from the Sprint 2 `chaincode/` boundary. Lifecycle commands and the current
channel-policy blocker are documented in `network/README.md` Section 13.
