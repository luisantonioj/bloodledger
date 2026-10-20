import { describe, expect, it } from "vitest";
import { OFFLINE_CAPTURE_LIMIT, OfflineCaptureQueue, type OfflineStorage, type QueuedRecord } from "./offline-capture-queue";
import type { InboundOcrCapture } from "./types";

function memory(): OfflineStorage & { records: Map<string, QueuedRecord> } {
  const records = new Map<string, QueuedRecord>(); let key: CryptoKey | undefined;
  return { records, async key() { return key ??= await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); }, async all() { return [...records.values()]; }, async put(record) { records.set(record.id, record); }, async remove(id) { records.delete(id); } };
}
const capture = (n = 1): InboundOcrCapture => ({ captureMethod: "OCR", capturePolicyVersion: "INBOUND_OCR_V1", issuerInstitutionId: "INST_MEDIATRIX", donationNumber: `MM26-10-${String(n).padStart(4, "0")}`, bloodType: "O_POSITIVE", bloodTypeEvidence: { source: "OCR_LABEL", confirmed: true }, componentType: "PACKED_RED_BLOOD_CELLS", componentEvidence: { source: "OCR_LABEL", confirmed: true }, collectedAt: "2026-10-18T00:00:00.000Z", expiresAt: "2026-11-18T00:00:00.000Z", capturedAt: "2026-10-19T00:00:00.000Z", confirmedAt: "2026-10-19T00:00:01.000Z", eventTime: "2026-10-19T00:00:01.000Z", correlationId: "CORR_OFFLINE_0001", ocrEvidence: { engine: "TESSERACT_JS", engineVersion: "7.0.0", fieldConfidence: { donationNumber: 99, bloodType: 99, collectedAt: 99, expiresAt: 99 } } } as InboundOcrCapture);
const owner = { accountId: "ACC_SYNTH", institutionId: "INST_MEDIATRIX" };

describe("offline capture queue (TC-S05/TC-O01, SYNTHETIC_OFFLINE_CAPTURE_V1)", () => {
  it("stores ciphertext only and round-trips the confirmed fields for the same owner", async () => {
    const storage = memory(), queue = new OfflineCaptureQueue(storage, () => new Date("2026-10-19T00:00:00.000Z"));
    await queue.enqueue(owner, "IDEM_INBOUND_A", capture());
    const raw = [...storage.records.values()][0]!;
    expect(new TextDecoder().decode(new Uint8Array(raw.ciphertext)).includes("MM26-10-0001")).toBe(false);
    expect((await queue.list(owner))[0]).toMatchObject({ idempotencyKey: "IDEM_INBOUND_A", capture: { donationNumber: "MM26-10-0001" } });
    expect(await queue.count({ ...owner, accountId: "ACC_OTHER" })).toBe(0);
  });
  it("is idempotent per key, enforces the 20-capture limit and rejects extra fields", async () => {
    const queue = new OfflineCaptureQueue(memory());
    await queue.enqueue(owner, "IDEM_INBOUND_A", capture()); await queue.enqueue(owner, "IDEM_INBOUND_A", capture());
    expect(await queue.count(owner)).toBe(1);
    for (let i = 2; i <= OFFLINE_CAPTURE_LIMIT; i++) await queue.enqueue(owner, "IDEM_INBOUND_" + i, capture(i));
    await expect(queue.enqueue(owner, "IDEM_INBOUND_OVER", capture(99))).rejects.toThrow("OFFLINE_CAPTURE_LIMIT_REACHED");
    await expect(new OfflineCaptureQueue(memory()).enqueue(owner, "IDEM_X", { ...capture(), image: "data:" } as unknown as InboundOcrCapture)).rejects.toThrow("OFFLINE_CAPTURE_FIELDS_INVALID");
  });
  it("purges after 24 hours and keeps a fixed send time for retries", async () => {
    let now = new Date("2026-10-19T00:00:00.000Z"); const storage = memory(), queue = new OfflineCaptureQueue(storage, () => now);
    await queue.enqueue(owner, "IDEM_INBOUND_A", capture());
    await queue.markSending(owner, "IDEM_INBOUND_A", "2026-10-19T05:00:00.000Z");
    expect((await queue.list(owner))[0]!.sendEventTime).toBe("2026-10-19T05:00:00.000Z");
    now = new Date("2026-10-20T00:00:00.000Z");
    expect(await queue.count(owner)).toBe(0);
    expect(storage.records.size).toBe(0);
  });
});
