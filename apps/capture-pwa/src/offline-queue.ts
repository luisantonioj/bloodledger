import type { StoredCommandReceipt } from "./types";
import { retainedReceipt, type ReceiptEntry } from "./receipt-retention";

const DATABASE_NAME = "bloodledger-inbound-command-status-v2";
const STORE_NAME = "command-receipts";
const LEGACY_DATABASE_NAME = "bloodledger-synthetic-capture-v1";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED"));
  });
}

async function database(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME, { keyPath: "commandId" });
    }
  };
  return requestResult(request);
}

export async function saveStoredCommand(receipt: StoredCommandReceipt, isCurrent = () => true): Promise<void> {
  const db = await database();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const lookup = store.get(receipt.commandId);
    lookup.onsuccess = () => {
      if (!isCurrent()) return;
      try {store.put(retainedReceipt(receipt, lookup.result as ReceiptEntry | undefined));}
      catch {transaction.abort();}
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED"));
      transaction.onabort = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED"));
    });
  } finally {
    db.close();
  }
}

export async function listStoredCommands(owner: {accountId: string; institutionId: string}): Promise<StoredCommandReceipt[]> {
  const db = await database();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite"), store = transaction.objectStore(STORE_NAME);
    const receipts = await new Promise<StoredCommandReceipt[]>((resolve, reject) => {
      const result: StoredCommandReceipt[] = [], request = store.getAll();
      request.onsuccess = () => {
        for (const entry of request.result as ReceiptEntry[]) {
          if (entry.accountId !== owner.accountId || entry.institutionId !== owner.institutionId || "expired" in entry) continue;
          const retained = retainedReceipt(entry, entry);
          store.put(retained);
          if (!("expired" in retained)) result.push(retained);
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = transaction.onabort = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED"));
    });
    return receipts.sort((left, right) => left.acceptedAt.localeCompare(right.acceptedAt));
  } finally {
    db.close();
  }
}

/** Remove the retired V1 queue so no obsolete capture payload remains on device. */
export async function deleteLegacyCaptureQueue(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(LEGACY_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
