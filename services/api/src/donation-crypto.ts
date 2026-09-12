import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export interface EncryptedDonationNumber {
  ciphertext: string;
  nonce: string;
  authTag: string;
  encryptionKeyVersion: string;
  lookupHmac: string;
}

export interface DonationKeyring {
  encryptionKey: Buffer;
  lookupKey: Buffer;
  encryptionKeyVersion: string;
}

const MAX_DONATION_NUMBER_LENGTH = 64;

function decodeKey(raw: string | undefined, name: string): Buffer {
  if (!raw) throw new Error("V2_KEYS_UNAVAILABLE");
  const value = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (value.length !== 32) throw new Error(`V2_${name}_KEY_INVALID`);
  return value;
}

export function keyringFromEnvironment(environment: NodeJS.ProcessEnv = process.env): DonationKeyring {
  return {
    encryptionKey: decodeKey(environment.BLOODLEDGER_DONATION_ENCRYPTION_KEY, "ENCRYPTION"),
    lookupKey: decodeKey(environment.BLOODLEDGER_DONATION_LOOKUP_KEY, "LOOKUP"),
    encryptionKeyVersion: environment.BLOODLEDGER_DONATION_ENCRYPTION_KEY_VERSION ?? "v1",
  };
}

export function validateDonationNumber(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > MAX_DONATION_NUMBER_LENGTH || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error("DONATION_NUMBER_INVALID");
  }
}

export function encryptDonationNumber(value: string, keyring: DonationKeyring): EncryptedDonationNumber {
  validateDonationNumber(value);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyring.encryptionKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const lookupHmac = createHmac("sha256", keyring.lookupKey).update(value, "utf8").digest("hex");
  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: authTag.toString("base64"),
    encryptionKeyVersion: keyring.encryptionKeyVersion,
    lookupHmac,
  };
}

export function decryptDonationNumber(encrypted: Omit<EncryptedDonationNumber, "lookupHmac">, keyring: DonationKeyring): string {
  if (encrypted.encryptionKeyVersion !== keyring.encryptionKeyVersion) throw new Error("DONATION_KEY_VERSION_UNAVAILABLE");
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyring.encryptionKey, Buffer.from(encrypted.nonce, "base64"));
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
    const value = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, "base64")), decipher.final()]).toString("utf8");
    validateDonationNumber(value);
    return value;
  } catch {
    throw new Error("DONATION_DECRYPTION_FAILED");
  }
}
