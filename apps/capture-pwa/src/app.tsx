import { useEffect, useState } from "react";
import { ApiError, createSession, fetchScanStatus, submitCapture } from "./api-client";
import { CAPTURE_POLICY_VERSION, OCR_ENGINE_VERSION } from "./capture-policy";
import { listLocalEvents, saveLocalEvent } from "./offline-queue";
import type { RecognitionResult } from "./recognition";
import type { ConfirmedCapture, LocalScanEvent } from "./types";

const SYNTHETIC_OPERATOR = "USR_SYNTH_CAPTURE";

function newIdempotencyKey(): string {
  return `IDEM_SCAN_${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
}

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("bloodledger-synthetic-token") ?? "");
  const [credential, setCredential] = useState("");
  const [image, setImage] = useState<File>();
  const [recognition, setRecognition] = useState<RecognitionResult>();
  const [events, setEvents] = useState<LocalScanEvent[]>([]);
  const [message, setMessage] = useState("Simulation only — use synthetic labels.");
  const [busy, setBusy] = useState(false);

  const refreshEvents = async () => setEvents(await listLocalEvents());
  useEffect(() => { void refreshEvents(); }, []);

  useEffect(() => {
    if (token === "") return;
    let syncing = false;
    const synchronize = async () => {
      if (syncing || !navigator.onLine) return;
      syncing = true;
      try {
        for (const localEvent of await listLocalEvents()) {
          if (localEvent.status === "FAILED" || localEvent.status === "CONFLICT" || localEvent.status === "COMMITTED") continue;
          try {
            const remote = localEvent.eventId
              ? await fetchScanStatus(token, localEvent.eventId)
              : await submitCapture(token, localEvent.idempotencyKey, localEvent.capture);
            await saveLocalEvent({ ...localEvent, ...remote, safeErrorCode: remote.safeErrorCode });
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              sessionStorage.removeItem("bloodledger-synthetic-token");
              setToken("");
              setMessage("Session expired. Sign in to continue synchronization.");
              break;
            }
            await saveLocalEvent({
              ...localEvent,
              safeErrorCode: error instanceof ApiError ? error.code : "API_UNAVAILABLE",
            });
          }
        }
        await refreshEvents();
      } finally {
        syncing = false;
      }
    };
    const timer = window.setInterval(() => void synchronize(), 2_000);
    window.addEventListener("online", synchronize);
    void synchronize();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", synchronize);
    };
  }, [token]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const sessionToken = await createSession(SYNTHETIC_OPERATOR, credential);
      sessionStorage.setItem("bloodledger-synthetic-token", sessionToken);
      setToken(sessionToken);
      setCredential("");
      setMessage("Synthetic operator authenticated.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.code : "AUTH_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function runRecognition(method: "OCR" | "FALLBACK") {
    if (image === undefined) return;
    setBusy(true);
    setRecognition(undefined);
    try {
      const { decodeSyntheticFallback, recognizeSyntheticLabel } = await import("./recognition");
      const result = method === "OCR"
        ? await recognizeSyntheticLabel(image)
        : await decodeSyntheticFallback(image);
      setRecognition(result);
      setMessage("Review all extracted fields, then confirm.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CAPTURE_RECOGNITION_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAndQueue() {
    if (recognition === undefined) return;
    const now = new Date().toISOString();
    const capture: ConfirmedCapture = {
      captureMethod: recognition.captureMethod,
      capturePolicyVersion: CAPTURE_POLICY_VERSION,
      capturedAt: now,
      confirmedAt: now,
      unit: recognition.unit,
      ocrEvidence: recognition.fieldConfidence === null ? null : {
        engine: "TESSERACT_JS",
        engineVersion: OCR_ENGINE_VERSION,
        fieldConfidence: recognition.fieldConfidence,
      },
    };
    const localEvent: LocalScanEvent = {
      idempotencyKey: newIdempotencyKey(),
      capture,
      dataClassification: "SYNTHETIC_DATA",
      status: "LOCAL_PENDING",
      createdAt: now,
    };
    await saveLocalEvent(localEvent);
    if (token !== "") {
      try {
        const accepted = await submitCapture(token, localEvent.idempotencyKey, capture);
        await saveLocalEvent({ ...localEvent, ...accepted });
        setMessage("Capture durably accepted by the middleware.");
      } catch (error) {
        const code = error instanceof ApiError ? error.code : "API_UNAVAILABLE";
        await saveLocalEvent({ ...localEvent, safeErrorCode: code });
        setMessage("Saved locally; synchronization will be retried.");
      }
    } else {
      setMessage("Saved locally. Sign in to synchronize.");
    }
    setRecognition(undefined);
    setImage(undefined);
    await refreshEvents();
  }

  return (
    <main>
      <header>
        <span className="eyebrow">SIMULATION ONLY</span>
        <h1>BloodLedger Capture</h1>
        <p>On-device OCR. Confirmed fields only. Images are never uploaded.</p>
      </header>

      {token === "" && (
        <form className="card" onSubmit={signIn}>
          <h2>Synthetic operator sign-in</h2>
          <label>Operator<input value={SYNTHETIC_OPERATOR} disabled /></label>
          <label>Development credential<input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} required /></label>
          <button disabled={busy}>Sign in</button>
        </form>
      )}

      <section className="card">
        <h2>1. Capture label</h2>
        <input
          aria-label="Synthetic label image"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            setImage(event.target.files?.[0]);
            setRecognition(undefined);
          }}
        />
        <div className="actions">
          <button type="button" disabled={image === undefined || busy} onClick={() => void runRecognition("OCR")}>Run OCR</button>
          <button type="button" className="secondary" disabled={image === undefined || busy} onClick={() => void runRecognition("FALLBACK")}>Use fallback code</button>
        </div>
      </section>

      {recognition !== undefined && (
        <section className="card">
          <h2>2. Confirm extracted fields</h2>
          <dl>
            {Object.entries(recognition.unit).map(([key, value]) => (
              <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <p>Method: {recognition.captureMethod}. Fields cannot be edited; recapture if any value is wrong.</p>
          <button type="button" onClick={() => void confirmAndQueue()}>I confirm every field</button>
        </section>
      )}

      <section className="card" aria-live="polite">
        <h2>Synchronization</h2>
        <p>{message}</p>
        <ul className="events">
          {events.map((event) => <li key={event.idempotencyKey}><strong>{event.capture.unit.unitId}</strong><span>{event.status}</span></li>)}
        </ul>
      </section>
    </main>
  );
}
