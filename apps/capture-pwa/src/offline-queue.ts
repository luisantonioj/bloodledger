import type { LocalScanEvent } from "./types";

const DATABASE_NAME = "bloodledger-synthetic-capture-v1";
const STORE_NAME = "scan-events";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED"));
  });
}

async function database(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "idempotencyKey" });
  return requestResult(request);
}

export async function saveLocalEvent(event: LocalScanEvent): Promise<void> {
  const db = await database();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(event);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED"));
      transaction.onabort = () => reject(new Error("CAPTURE_LOCAL_STORAGE_FAILED"));
    });
  } finally {
    db.close();
  }
}

export async function listLocalEvents(): Promise<LocalScanEvent[]> {
  const db = await database();
  try {
    return (await requestResult(db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll()))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } finally {
    db.close();
  }
}
