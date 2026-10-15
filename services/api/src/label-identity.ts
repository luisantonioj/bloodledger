import { decryptDonationNumber, type DonationKeyring } from "./donation-crypto.js";

// Read-only display of the recorded printed-label Donation No. for components the caller's
// institution currently holds. It is never a mutation key, ledger field, log value or report field.
export const LABEL_IDENTITY_POLICY_VERSION = "LABEL_IDENTITY_READ_V1";

export interface SealedDonationNumber {
  ciphertext: string;
  nonce: string;
  authTag: string;
  encryptionKeyVersion: string;
  captureMethod: string | null;
}

export type LabelIdentity =
  | { status: "AVAILABLE"; kind: "DONATION_NUMBER"; value: string; source: "CONFIRMED_OCR_CAPTURE" | "LEGACY_REGISTRATION"; unavailableReason: null; policyVersion: typeof LABEL_IDENTITY_POLICY_VERSION }
  | { status: "UNAVAILABLE"; kind: "DONATION_NUMBER"; value: null; source: null; unavailableReason: LabelUnavailableReason; policyVersion: typeof LABEL_IDENTITY_POLICY_VERSION };

// NOT_COMMITTED is used only by unit history, for an uncommitted event on a unit the caller does not hold.
export type LabelUnavailableReason = "NOT_RECORDED" | "TEMPORARILY_UNAVAILABLE" | "NOT_COMMITTED";

export function unavailableLabel(unavailableReason: LabelUnavailableReason): LabelIdentity {
  return { status: "UNAVAILABLE", kind: "DONATION_NUMBER", value: null, source: null, unavailableReason, policyVersion: LABEL_IDENTITY_POLICY_VERSION };
}

// Returns the exact recorded value without reformatting; key and decryption failures stay generic.
export function resolveLabelIdentity(sealed: SealedDonationNumber | undefined, keyring: DonationKeyring | undefined, readFailed = false): LabelIdentity {
  if (readFailed) return unavailableLabel("TEMPORARILY_UNAVAILABLE");
  if (!sealed) return unavailableLabel("NOT_RECORDED");
  if (!keyring) return unavailableLabel("TEMPORARILY_UNAVAILABLE");
  try {
    const value = decryptDonationNumber(sealed, keyring);
    return { status: "AVAILABLE", kind: "DONATION_NUMBER", value, source: sealed.captureMethod === "OCR" ? "CONFIRMED_OCR_CAPTURE" : "LEGACY_REGISTRATION", unavailableReason: null, policyVersion: LABEL_IDENTITY_POLICY_VERSION };
  } catch {
    return unavailableLabel("TEMPORARILY_UNAVAILABLE");
  }
}
