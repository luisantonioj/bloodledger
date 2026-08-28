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
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const refreshEvents = async () => setEvents(await listLocalEvents());
  useEffect(() => { void refreshEvents(); }, []);
  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);


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
    <main className="capture-app">
      <header className="mobile-header">
        <div className="mobile-brand">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span><strong>Blood<em>ledger</em></strong><small>Mobile OCR Scanner</small></span>
        </div>
        <span className={`connection-chip ${isOnline ? "online" : "offline"}`}>
          <i aria-hidden="true" />{isOnline ? "Online" : "Offline"}
        </span>
      </header>

      <section className="capture-hero">
        <div>
          <span className="eyebrow">SIMULATION ONLY · MOBILE WORKFLOW</span>
          <h1>Blood Unit Capture</h1>
          <p>Scan a synthetic label on this device, review every extracted field, and confirm before synchronization.</p>
        </div>
        <div className="privacy-badge"><span aria-hidden="true">⌾</span><strong>On-device processing</strong><small>Images are never uploaded</small></div>
      </section>

      {!isOnline && (
        <div className="offline-banner" role="status">
          <span aria-hidden="true">!</span>
          <div><strong>Offline capture is available</strong><small>Confirmed structured data will remain pending until connectivity returns.</small></div>
        </div>
      )}

      <div className="capture-layout">
        <div className="capture-flow">
          {token === "" && (
            <form className="card sign-in-card" onSubmit={signIn}>
              <div className="card-heading">
                <span className="step-number">0</span>
                <div><h2>Synthetic operator sign-in</h2><p>Authenticate before synchronized intake. Local capture remains simulation-only.</p></div>
              </div>
              <div className="form-grid">
                <label>Operator<input value={SYNTHETIC_OPERATOR} disabled /></label>
                <label>Development credential<input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} required /></label>
              </div>
              <button disabled={busy}>Sign in</button>
            </form>
          )}

          <section className="card capture-card">
            <div className="card-heading">
              <span className="step-number">1</span>
              <div><h2><span className="visually-hidden">1. </span>Capture label</h2><p>Use the rear camera or choose a clear synthetic label image.</p></div>
              <span className="method-chip">OCR PRIMARY</span>
            </div>

            <label className={`scanner-view ${image === undefined ? "empty" : "selected"}`}>
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
              <span className="scanner-empty-state" aria-hidden="true">
                <b>⌾</b>
                <strong>{image === undefined ? "Scan printed label" : "Synthetic label ready"}</strong>
                <small>{image === undefined ? "Tap to open the camera or choose a label image." : image.name}</small>
              </span>
              <span className="focus-frame" aria-hidden="true">
                <i className="corner top-left" /><i className="corner top-right" />
                <i className="corner bottom-left" /><i className="corner bottom-right" />
                <small>ALIGN LABEL INSIDE FRAME</small>
              </span>
              <span className="scanner-meta" aria-hidden="true"><i />{image === undefined ? "OCR READY" : "IMAGE SELECTED"}</span>
            </label>

            <div className="capture-actions">
              <button type="button" disabled={image === undefined || busy} onClick={() => void runRecognition("OCR")}>{busy ? "Processing…" : "Run OCR"}</button>
              <button type="button" className="secondary" disabled={image === undefined || busy} onClick={() => void runRecognition("FALLBACK")}>Use fallback code</button>
            </div>
            <p className="privacy-note"><span aria-hidden="true">i</span> Processing occurs locally. Raw images and unrestricted OCR text are not persisted.</p>
          </section>

          {recognition !== undefined && (
            <section className="card confirmation-card">
              <div className="card-heading">
                <span className="step-number complete">2</span>
                <div><h2><span className="visually-hidden">2. </span>Confirm extracted fields</h2><p>Every field must be correct. Recapture if any value is wrong.</p></div>
                <span className="review-chip">REVIEW REQUIRED</span>
              </div>
              <div className="unit-summary">
                <span className="blood-drop" aria-hidden="true">B</span>
                <div><strong>{recognition.unit.unitId}</strong><small>{recognition.captureMethod} · structured synthetic data</small></div>
              </div>
              <dl className="field-review">
                {Object.entries(recognition.unit).map(([key, value]) => (
                  <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                ))}
              </dl>
              <p className="confirmation-policy">Method: {recognition.captureMethod}. Fields cannot be edited; recapture if any value is wrong.</p>
              <div className="confirmation-actions"><button type="button" onClick={() => void confirmAndQueue()}>I confirm every field</button></div>
            </section>
          )}
        </div>

        <aside className="card synchronization-card" aria-live="polite">
          <div className="card-heading compact">
            <div><span className="eyebrow">DEVICE QUEUE</span><h2>Synchronization</h2></div>
            <span className={`connection-chip ${isOnline ? "online" : "offline"}`}><i aria-hidden="true" />{isOnline ? "Ready" : "Offline"}</span>
          </div>
          <div className="sync-message"><span aria-hidden="true">i</span><p>{message}</p></div>
          <div className="queue-heading"><strong>Recent captures</strong><span>{events.length} on device</span></div>
          {events.length === 0 ? (
            <div className="empty-queue"><span aria-hidden="true">◎</span><strong>No captures yet</strong><small>Confirmed units will appear here with their truthful synchronization state.</small></div>
          ) : (
            <ul className="events">
              {events.map((event) => (
                <li key={event.idempotencyKey}>
                  <span><strong>{event.capture.unit.unitId}</strong><small>{event.capture.captureMethod}</small></span>
                  <span className={`event-status status-${event.status.toLowerCase().replaceAll("_", "-")}`}>{event.status}</span>
                </li>
              ))}
            </ul>
          )}
          <footer><span>Capture policy</span><code>{CAPTURE_POLICY_VERSION}</code></footer>
        </aside>
      </div>
    </main>
  );
}
