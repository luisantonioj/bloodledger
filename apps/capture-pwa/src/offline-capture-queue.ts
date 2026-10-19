// TC-S05/TC-O01 remediation: SYNTHETIC_OFFLINE_CAPTURE_V1 (Proposed).
// While offline, an operator-confirmed capture may wait on this device:
// - only the allowlisted confirmed fields, never the label image or raw OCR text;
// - encrypted with AES-GCM under a non-extractable WebCrypto key kept in IndexedDB;
// - at most 20 captures, each purged 24 hours after queuing;
// - sent exactly once on reconnect with its original idempotency key, after the operator re-enters the PIN
//   (the PIN is never stored). The send time becomes the command eventTime; confirmation times stay as recorded.
import type { InboundOcrCapture } from "./types";

export const OFFLINE_CAPTURE_POLICY_VERSION = "SYNTHETIC_OFFLINE_CAPTURE_V1";
export const OFFLINE_CAPTURE_LIMIT = 20;
export const OFFLINE_CAPTURE_RETENTION_MS = 24 * 3_600_000;
const CAPTURE_KEYS = ["bloodType", "bloodTypeEvidence", "captureMethod", "capturePolicyVersion", "capturedAt", "collectedAt", "componentEvidence", "componentType", "confirmedAt", "correlationId", "donationNumber", "eventTime", "expiresAt", "issuerInstitutionId", "ocrEvidence"];

export interface QueuedRecord { id: string; accountId: string; institutionId: string; queuedAt: string; expiresAt: string; iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer; sendEventTime: string | null }
export interface QueuedCapture { idempotencyKey: string; capture: InboundOcrCapture; queuedAt: string; expiresAt: string; sendEventTime: string | null }
export interface OfflineStorage { key(): Promise<CryptoKey>; all(): Promise<QueuedRecord[]>; put(record: QueuedRecord): Promise<void>; remove(id: string): Promise<void> }
type Owner = { accountId: string; institutionId: string };

export class OfflineQueueError extends Error {}

/** Keeps exactly the confirmed capture fields; anything else (image, raw text) is rejected rather than stored. */
export function allowlistedCapture(capture: InboundOcrCapture): InboundOcrCapture {
  const keys = Object.keys(capture).sort();
  if (keys.length !== CAPTURE_KEYS.length || keys.some((key, index) => key !== CAPTURE_KEYS[index])) throw new OfflineQueueError("OFFLINE_CAPTURE_FIELDS_INVALID");
  if (capture.bloodTypeEvidence?.confirmed !== true || capture.componentEvidence?.confirmed !== true) throw new OfflineQueueError("OFFLINE_CAPTURE_UNCONFIRMED");
  return capture;
}

export class OfflineCaptureQueue {
  constructor(private readonly storage: OfflineStorage, private readonly clock: () => Date = () => new Date()) {}

  /** Removes every record past its retention, for any owner. */
  async purgeExpired(): Promise<number> {
    const now = this.clock().getTime(); let removed = 0;
    for (const record of await this.storage.all()) if (Date.parse(record.expiresAt) <= now) { await this.storage.remove(record.id); removed++; }
    return removed;
  }

  async enqueue(owner: Owner, idempotencyKey: string, capture: InboundOcrCapture): Promise<void> {
    await this.purgeExpired();
    const safe = allowlistedCapture(capture), existing = await this.storage.all();
    if (existing.some(record => record.id === idempotencyKey)) return;
    if (existing.length >= OFFLINE_CAPTURE_LIMIT) throw new OfflineQueueError("OFFLINE_CAPTURE_LIMIT_REACHED");
    const iv = crypto.getRandomValues(new Uint8Array(12)), now = this.clock();
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await this.storage.key(), new TextEncoder().encode(JSON.stringify(safe)));
    await this.storage.put({ id: idempotencyKey, accountId: owner.accountId, institutionId: owner.institutionId, queuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + OFFLINE_CAPTURE_RETENTION_MS).toISOString(), iv, ciphertext, sendEventTime: null });
  }

  async count(owner: Owner): Promise<number> { await this.purgeExpired(); return (await this.owned(owner)).length; }

  async list(owner: Owner): Promise<QueuedCapture[]> {
    await this.purgeExpired(); const key = await this.storage.key(); const result: QueuedCapture[] = [];
    for (const record of await this.owned(owner)) {
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv }, key, record.ciphertext);
      result.push({ idempotencyKey: record.id, capture: JSON.parse(new TextDecoder().decode(plain)) as InboundOcrCapture, queuedAt: record.queuedAt, expiresAt: record.expiresAt, sendEventTime: record.sendEventTime });
    }
    return result.sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
  }

  /** Fixes the send time before the first attempt so a lost response is retried with an identical body. */
  async markSending(owner: Owner, id: string, eventTime: string | null): Promise<void> {
    const record = (await this.owned(owner)).find(item => item.id === id); if (!record) throw new OfflineQueueError("OFFLINE_CAPTURE_NOT_FOUND");
    await this.storage.put({ ...record, sendEventTime: eventTime });
  }

  async remove(owner: Owner, id: string): Promise<void> { if ((await this.owned(owner)).some(item => item.id === id)) await this.storage.remove(id); }

  private async owned(owner: Owner) { return (await this.storage.all()).filter(record => record.accountId === owner.accountId && record.institutionId === owner.institutionId); }
}

const DATABASE = "bloodledger-offline-capture-v1";
function request<T>(value: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(new OfflineQueueError("OFFLINE_CAPTURE_STORAGE_FAILED")); }); }
async function open(): Promise<IDBDatabase> {
  const opening = indexedDB.open(DATABASE, 1);
  opening.onupgradeneeded = () => { opening.result.createObjectStore("keys"); opening.result.createObjectStore("captures", { keyPath: "id" }); };
  return request(opening);
}
async function withStore<T>(name: "keys" | "captures", mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open(); try { return await request(run(db.transaction(name, mode).objectStore(name))); } finally { db.close(); }
}

/** IndexedDB storage; the AES-GCM key is generated non-extractable and never leaves the browser. */
export const indexedDbOfflineStorage: OfflineStorage = {
  async key() {
    const stored = await withStore<CryptoKey | undefined>("keys", "readonly", store => store.get("capture-key") as IDBRequest<CryptoKey | undefined>);
    if (stored) return stored;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await withStore("keys", "readwrite", store => store.put(key, "capture-key"));
    return key;
  },
  all: () => withStore<QueuedRecord[]>("captures", "readonly", store => store.getAll() as IDBRequest<QueuedRecord[]>),
  async put(record) { await withStore("captures", "readwrite", store => store.put(record)); },
  async remove(id) { await withStore("captures", "readwrite", store => store.delete(id)); },
};
