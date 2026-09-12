import assert from "node:assert/strict";
import test from "node:test";
import { decryptDonationNumber, encryptDonationNumber, keyringFromEnvironment, validateDonationNumber } from "../src/donation-crypto.js";

const environment = {
  BLOODLEDGER_DONATION_ENCRYPTION_KEY: "11".repeat(32),
  BLOODLEDGER_DONATION_LOOKUP_KEY: "22".repeat(32),
  BLOODLEDGER_DONATION_ENCRYPTION_KEY_VERSION: "v7",
};

test("encrypts exact Donation No. with authenticated ciphertext and keyed lookup", () => {
  const keyring = keyringFromEnvironment(environment);
  const encrypted = encryptDonationNumber("MMMC-2026/0007", keyring);
  assert.equal(encrypted.encryptionKeyVersion, "v7");
  assert.notEqual(encrypted.ciphertext, "MMMC-2026/0007");
  assert.equal(decryptDonationNumber(encrypted, keyring), "MMMC-2026/0007");
  assert.notEqual(encryptDonationNumber("MMMC-2026/0007", keyring).lookupHmac, "");
});

test("refuses missing keys and control characters without changing the reference", () => {
  assert.throws(() => keyringFromEnvironment({}), /V2_KEYS_UNAVAILABLE/);
  assert.throws(() => validateDonationNumber("BAD\nNUMBER"), /DONATION_NUMBER_INVALID/);
});
