import type { StoredCommandReceipt } from "./types";

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

export async function saveStoredCommand(receipt: StoredCommandReceipt): Promise<void> {
  const db = await database();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(receipt);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED"));
      transaction.onabort = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED"));
    });
  } finally {
    db.close();
  }
}

export async function listStoredCommands(): Promise<StoredCommandReceipt[]> {
  const db = await database();
  try {
    return (await requestResult(db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll()))
      .sort((left, right) => left.acceptedAt.localeCompare(right.acceptedAt));
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
