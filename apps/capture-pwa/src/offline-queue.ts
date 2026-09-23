import type { StoredCommandReceipt } from "./types";

const DATABASE_NAME = "bloodledger-inbound-command-status-v2";
const STORE_NAME = "command-receipts";
const EXPIRED_STORE = "expired-command-ids";
const LEGACY_DATABASE_NAME = "bloodledger-synthetic-capture-v1";
const TERMINAL_STATES = new Set(["COMMITTED", "FAILED", "CONFLICT"]);
const TERMINAL_RETENTION_MS = 24 * 60 * 60 * 1000;
let activeActorId: string | undefined;
let pending: Promise<unknown> = Promise.resolve();

export function setReceiptActor(actorId: string | undefined): void { activeActorId = actorId; }
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = pending.then(operation, operation);
  pending = next.catch(() => undefined);
  return next;
}
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED")); });
}
function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = transaction.onabort = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED")); });
}
async function database(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE_NAME, 2);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "commandId" });
    if (!request.result.objectStoreNames.contains(EXPIRED_STORE)) request.result.createObjectStore(EXPIRED_STORE, { keyPath: "id" });
  };
  return requestResult(request);
}
function actorRequired(actorId: string): void { if (activeActorId !== actorId) throw new Error("CAPTURE_ACTOR_CHANGED"); }

export function saveStoredCommand(receipt: StoredCommandReceipt): Promise<void> {
  return serial(async () => {
    actorRequired(receipt.actorUserId);
    const db = await database();
    try {
      actorRequired(receipt.actorUserId);
      const transaction = db.transaction([STORE_NAME, EXPIRED_STORE], "readwrite");
      const expired = await requestResult(transaction.objectStore(EXPIRED_STORE).get(`${receipt.actorUserId}:${receipt.commandId}`));
      if (expired) { await completed(transaction); return; }
      transaction.objectStore(STORE_NAME).put({ ...receipt, terminalObservedAt: TERMINAL_STATES.has(receipt.status) ? receipt.terminalObservedAt ?? new Date().toISOString() : undefined });
      await completed(transaction);
    } finally { db.close(); }
  });
}

export function listStoredCommands(actorId: string): Promise<StoredCommandReceipt[]> {
  return serial(async () => {
    actorRequired(actorId);
    const db = await database();
    try {
      actorRequired(actorId);
      const transaction = db.transaction([STORE_NAME, EXPIRED_STORE], "readwrite");
      const receipts = await requestResult(transaction.objectStore(STORE_NAME).getAll()) as StoredCommandReceipt[];
      const visible: StoredCommandReceipt[] = [];
      for (const receipt of receipts) {
        if (receipt.actorUserId !== actorId) { transaction.objectStore(STORE_NAME).delete(receipt.commandId); continue; }
        const observed = Date.parse(receipt.terminalObservedAt ?? "");
        if (TERMINAL_STATES.has(receipt.status) && Number.isFinite(observed) && Date.now() - observed >= TERMINAL_RETENTION_MS) {
          transaction.objectStore(STORE_NAME).delete(receipt.commandId);
          transaction.objectStore(EXPIRED_STORE).put({ id: `${actorId}:${receipt.commandId}` });
        } else visible.push(receipt);
      }
      await completed(transaction);
      return visible.sort((left, right) => left.acceptedAt.localeCompare(right.acceptedAt));
    } finally { db.close(); }
  });
}

export function clearStoredCommands(): Promise<void> {
  return serial(async () => {
    const db = await database();
    try { const transaction = db.transaction([STORE_NAME, EXPIRED_STORE], "readwrite"); transaction.objectStore(STORE_NAME).clear(); transaction.objectStore(EXPIRED_STORE).clear(); await completed(transaction); }
    finally { db.close(); }
  });
}

export async function deleteLegacyCaptureQueue(): Promise<void> {
  await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase(LEGACY_DATABASE_NAME); request.onsuccess = request.onerror = request.onblocked = () => resolve(); });
}
