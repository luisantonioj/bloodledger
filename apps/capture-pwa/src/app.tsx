import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  createSession,
  endSession,
  fetchCommandStatus,
  recoverCommands,
  restoreSession,
  submitInboundCapture,
  type CapturePrincipal,
} from "./api-client";
import {
  CAPTURE_POLICY_VERSION,
  ENABLED_ISSUER_INSTITUTION_ID,
  OCR_ENGINE_VERSION,
  contractVersionFor,
} from "./capture-policy";
import { clearStoredCommands, deleteLegacyCaptureQueue, listStoredCommands, saveStoredCommand } from "./offline-queue";
import type { RecognitionResult } from "./recognition";
import type { InboundOcrCapture, StoredCommandReceipt, V2Command } from "./types";

const TERMINAL_COMMAND_STATES = new Set(["COMMITTED", "FAILED", "CONFLICT"]);

function newEvidenceId(prefix: "IDEM_INBOUND_" | "CORR_"): string {
  return prefix + crypto.randomUUID().replaceAll("-", "").toUpperCase();
}

function commandReceipt(command: V2Command, recognition: RecognitionResult, idempotencyKey: string): StoredCommandReceipt {
  return {
    idempotencyKey,
    commandId: command.commandId,
    resourceId: command.resourceId,
    statusUrl: command.statusUrl,
    status: command.status,
    correlationId: command.correlationId,
    acceptedAt: command.acceptedAt,
    safeErrorCode: command.safeErrorCode,
    bloodType: recognition.label.bloodType,
    componentType: recognition.label.componentType,
    issuerInstitutionId: ENABLED_ISSUER_INSTITUTION_ID,
    classification: "SIMULATION_ONLY",
  };
}

export function App() {
  const [principal, setPrincipal] = useState<CapturePrincipal>();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [image, setImage] = useState<File>();
  const [recognition, setRecognition] = useState<RecognitionResult>();
  const [attempt, setAttempt] = useState<{ idempotencyKey: string; correlationId: string; confirmedAt: string }>();
  const [events, setEvents] = useState<StoredCommandReceipt[]>([]);
  const [message, setMessage] = useState("Simulation only — use approved synthetic Mediatrix labels.");
  const [busy, setBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const submissionInFlight = useRef(false);

  const refreshEvents = async () => setEvents(await listStoredCommands());

  useEffect(() => {
    void deleteLegacyCaptureQueue().then(refreshEvents);
    restoreSession()
      .then(setPrincipal)
      .catch(() => undefined)
      .finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    if (!recognition) return;
    const timer = setTimeout(() => {
      setRecognition(undefined);
      setAttempt(undefined);
      setImage(undefined);
      setMessage("Confirmation timed out after 15 minutes. Capture the label again.");
    }, 15 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [recognition]);

  useEffect(() => {
    const timer = setInterval(() => { void refreshEvents(); }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!principal) return;
    let closed = false;
    setRecoveryLoading(true);
    setRecoveryReady(false);
    void (async () => {
      try {
        const existing = await listStoredCommands();
        const server = (await recoverCommands()).filter((command) => command.resourceType === "INBOUND_CAPTURE");
        if (closed) return;
        await clearStoredCommands();
        for (const command of server) {
          if (closed) return;
          const prior = existing.find((item) => item.commandId === command.commandId);
          if (!prior && TERMINAL_COMMAND_STATES.has(command.status) && Date.now() - Date.parse(command.acceptedAt) >= 24 * 60 * 60 * 1000) continue;
          await saveStoredCommand({
            ...(prior ?? {}), commandId: command.commandId, resourceId: command.resourceId,
            statusUrl: command.statusUrl, status: command.status, correlationId: command.correlationId,
            acceptedAt: command.acceptedAt, safeErrorCode: command.safeErrorCode,
            classification: "SIMULATION_ONLY", terminalObservedAt: prior?.terminalObservedAt,
          });
        }
        if (closed) return;
        await refreshEvents();
        setRecoveryReady(true);
      } catch (error) {
        if (closed) return;
        setMessage(error instanceof ApiError && error.status === 401 ? "Session expired. Sign in again." : "Command recovery is unavailable. Check server status before another capture.");
        if (error instanceof ApiError && error.status === 401) { setPrincipal(undefined); setRecognition(undefined); setAttempt(undefined); setImage(undefined); }
      } finally { if (!closed) setRecoveryLoading(false); }
    })();
    return () => { closed = true; };
  }, [principal?.userId, recoveryAttempt]);

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
    if (!principal) return;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const poll = async () => {
      if (closed) return;
      if (!navigator.onLine || document.hidden) {
        timer = setTimeout(() => void poll(), 2_000);
        return;
      }
      try {
        for (const receipt of await listStoredCommands()) {
          if (closed) return;
          if (TERMINAL_COMMAND_STATES.has(receipt.status)) continue;
          const command = await fetchCommandStatus(receipt.statusUrl);
          if (closed) return;
          await saveStoredCommand({
            ...receipt,
            status: command.status,
            safeErrorCode: command.safeErrorCode,
            terminalObservedAt: TERMINAL_COMMAND_STATES.has(command.status) ? receipt.terminalObservedAt ?? new Date().toISOString() : undefined,
          });
        }
        if (closed) return;
        failures = 0;
        await refreshEvents();
      } catch (error) {
        failures += 1;
        if (error instanceof ApiError && error.status === 401) {
          setPrincipal(undefined);
          setRecognition(undefined);
          setAttempt(undefined);
          setImage(undefined);
          setMessage("Session expired. Sign in again to resume command-status checks.");
        } else {
          setMessage("Command status is temporarily unavailable. No intake command was resubmitted.");
        }
      } finally {
        if (!closed) timer = setTimeout(() => void poll(), Math.min(30_000, 2_000 * (2 ** failures)));
      }
    };

    void poll();
    return () => {
      closed = true;
      clearTimeout(timer);
    };
  }, [principal]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const restored = await createSession(username, password);
      setPrincipal(restored);
      setPassword("");
      setMessage("Authenticated as " + restored.displayName + ".");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.code : "AUTH_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setPrincipal(undefined);
    setRecognition(undefined);
    setAttempt(undefined);
    setImage(undefined);
    setRecoveryReady(false);
    await endSession().catch(() => undefined);
    await clearStoredCommands();
    setEvents([]);
    setMessage("Signed out. Volatile OCR values were cleared.");
  }

  async function runRecognition() {
    if (image === undefined) return;
    setBusy(true);
    setRecognition(undefined);
    setAttempt(undefined);
    try {
      const { recognizeInboundLabel } = await import("./recognition");
      setRecognition(await recognizeInboundLabel(image));
      setMessage("Review all five extracted fields. Exact Donation No. remains only in memory.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CAPTURE_RECOGNITION_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAndSubmit() {
    if (!recognition || !principal || !isOnline || !recoveryReady || submissionInFlight.current) return;
    submissionInFlight.current = true;
    const confirmation = attempt ?? {
      idempotencyKey: newEvidenceId("IDEM_INBOUND_"),
      correlationId: newEvidenceId("CORR_"),
      confirmedAt: new Date().toISOString(),
    };
    setAttempt(confirmation);
    const capture: InboundOcrCapture = {
      captureMethod: "OCR",
      capturePolicyVersion: CAPTURE_POLICY_VERSION,
      issuerInstitutionId: ENABLED_ISSUER_INSTITUTION_ID,
      donationNumber: recognition.label.donationNumber,
      bloodType: recognition.label.bloodType,
      bloodTypeEvidence: { source: "OCR_LABEL", confirmed: true },
      componentType: recognition.label.componentType,
      componentEvidence: { source: "OCR_LABEL", confirmed: true },
      collectedAt: recognition.label.collectedAt,
      expiresAt: recognition.label.expiresAt,
      capturedAt: recognition.capturedAt,
      confirmedAt: confirmation.confirmedAt,
      eventTime: confirmation.confirmedAt,
      correlationId: confirmation.correlationId,
      ocrEvidence: {
        engine: "TESSERACT_JS",
        engineVersion: OCR_ENGINE_VERSION,
        fieldConfidence: {
          donationNumber: recognition.fieldConfidence.donationNumber,
          bloodType: recognition.fieldConfidence.bloodType,
          collectedAt: recognition.fieldConfidence.collectedAt,
          expiresAt: recognition.fieldConfidence.expiresAt,
        },
      },
    };

    setBusy(true);
    try {
      const result = await submitInboundCapture(
        confirmation.idempotencyKey,
        capture,
        contractVersionFor(capture.componentType),
      );
      if ("commandId" in result) {
        await saveStoredCommand(commandReceipt(result, recognition, confirmation.idempotencyKey));
        setMessage("Intake accepted as " + result.status + ". It is not committed inventory yet.");
      } else {
        setMessage("Already registered as component " + result.componentId + ". No duplicate was created.");
      }
      setRecognition(undefined);
      setAttempt(undefined);
      setImage(undefined);
      await refreshEvents();
    } catch (error) {
      try {
        const recovered = (await recoverCommands(confirmation.idempotencyKey))[0];
        if (recovered) {
          await saveStoredCommand(commandReceipt(recovered, recognition, confirmation.idempotencyKey));
          setRecognition(undefined);
          setAttempt(undefined);
          setImage(undefined);
          await refreshEvents();
          setMessage("The server accepted this intake command. Its status was recovered without resubmission.");
          return;
        }
      } catch { /* Keep the same in-memory key and payload for explicit retry. */ }
      const code = error instanceof ApiError ? error.code : "API_UNAVAILABLE";
      setMessage(code + ". The confirmed value remains volatile; retry uses the same idempotency key.");
    } finally {
      setBusy(false);
      submissionInFlight.current = false;
    }
  }

  const captureRole = principal && ["ROLE-01", "ROLE-02"].includes(principal.roleId);

  return (
    <main className="capture-app">
      <header className="mobile-header">
        <div className="mobile-brand">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span><strong>Blood<em>ledger</em></strong><small>Inbound OCR Capture</small></span>
        </div>
        <span className={"connection-chip " + (isOnline ? "online" : "offline")}>
          <i aria-hidden="true" />{isOnline ? "Online" : "Offline"}
        </span>
      </header>

      <section className="capture-hero">
        <div>
          <span className="eyebrow">SIMULATION ONLY · INBOUND_OCR_V1</span>
          <h1>Blood Component Intake</h1>
          <p>Scan an approved synthetic label, verify every field, and submit the confirmed V2 intake command.</p>
        </div>
        <div className="privacy-badge"><span aria-hidden="true">⌾</span><strong>Volatile label handling</strong><small>Images, raw text, and Donation No. are not stored</small></div>
      </section>

      {!isOnline && (
        <div className="offline-banner" role="status">
          <span aria-hidden="true">!</span>
          <div><strong>Offline V2 submission is disabled</strong><small>You may inspect the screen, but exact Donation No. cannot be queued or replayed until an approved secure retention rule exists.</small></div>
        </div>
      )}
      {principal && !recoveryReady && !recoveryLoading && <div className="offline-banner" role="alert"><span aria-hidden="true">!</span><div><strong>Command recovery required</strong><small>Check accepted commands before starting another capture.</small><button type="button" onClick={() => setRecoveryAttempt((value) => value + 1)}>Retry recovery</button></div></div>}

      <div className="capture-layout">
        <div className="capture-flow">
          {!principal && !sessionLoading && (
            <form className="card sign-in-card" onSubmit={signIn}>
              <div className="card-heading">
                <span className="step-number">0</span>
                <div><h2>Official review-account sign-in</h2><p>ROLE-01 or ROLE-02 is required. Institution and custody come from the verified session.</p></div>
              </div>
              <div className="form-grid">
                <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
                <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
              </div>
              <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>
          )}

          {principal && !captureRole && (
            <div className="card capture-access-denied" role="alert"><strong>Capture is not permitted for {principal.roleDisplayName}</strong><p>Only ROLE-01 and ROLE-02 may submit inbound OCR intake.</p><button className="secondary" onClick={() => void signOut()}>Sign out</button></div>
          )}

          {captureRole && (
            <section className="card capture-card">
              <div className="card-heading">
                <span className="step-number">1</span>
                <div><h2><span className="visually-hidden">1. </span>Capture printed label</h2><p>Issuer is fixed to {ENABLED_ISSUER_INSTITUTION_ID}; receiving custody is {principal.institutionDisplayName}.</p></div>
                <span className="method-chip">OCR ONLY</span>
              </div>

              <label className={"scanner-view " + (image === undefined ? "empty" : "selected")}>
                <input
                  aria-label="Synthetic inbound label image"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    setImage(event.target.files?.[0]);
                    setRecognition(undefined);
                    setAttempt(undefined);
                  }}
                />
                <span className="scanner-empty-state" aria-hidden="true">
                  <b>⌾</b>
                  <strong>{image === undefined ? "Scan printed label" : "Synthetic label ready"}</strong>
                  <small>{image === undefined ? "Tap to open the camera or choose an approved fixture." : image.name}</small>
                </span>
                <span className="focus-frame" aria-hidden="true">
                  <i className="corner top-left" /><i className="corner top-right" />
                  <i className="corner bottom-left" /><i className="corner bottom-right" />
                  <small>ALIGN LABEL INSIDE FRAME</small>
                </span>
                <span className="scanner-meta" aria-hidden="true"><i />{image === undefined ? "OCR READY" : "IMAGE SELECTED"}</span>
              </label>

              <div className="capture-actions">
                <button type="button" disabled={image === undefined || busy || !recoveryReady} onClick={() => void runRecognition()}>{busy ? "Processing…" : !recoveryReady ? "Recovering commands…" : "Run OCR"}</button>
              </div>
              <p className="privacy-note"><span aria-hidden="true">i</span> Raw image and OCR text stay in volatile memory and are never sent to the API.</p>
              <button className="session-sign-out" type="button" onClick={() => void signOut()}>Sign out {principal.displayName}</button>
            </section>
          )}

          {recognition && captureRole && (
            <section className="card confirmation-card">
              <div className="card-heading">
                <span className="step-number complete">2</span>
                <div><h2><span className="visually-hidden">2. </span>Confirm extracted fields</h2><p>Every field must be correct and at least 90% confidence. Recapture if any value is wrong.</p></div>
                <span className="review-chip">REVIEW REQUIRED</span>
              </div>
              <div className="unit-summary">
                <span className="blood-drop" aria-hidden="true">B</span>
                <div><strong>Donation No. {recognition.label.donationNumber}</strong><small>Volatile display · never stored on device</small></div>
              </div>
              <dl className="field-review">
                {Object.entries(recognition.label).map(([key, value]) => (
                  <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                ))}
              </dl>
              <p className="confirmation-policy">Contract: {contractVersionFor(recognition.label.componentType)}. Fields cannot be edited; recapture if any value is wrong.</p>
              <div className="confirmation-actions"><button type="button" disabled={busy || !isOnline || !recoveryReady} onClick={() => void confirmAndSubmit()}>{busy ? "Submitting…" : attempt ? "Retry same confirmed intake" : "I confirm every field"}</button><button type="button" className="secondary" disabled={busy} onClick={() => { setRecognition(undefined); setAttempt(undefined); setImage(undefined); setMessage("Capture cancelled. Volatile OCR values were cleared."); }}>Cancel capture</button></div>
            </section>
          )}
        </div>

        <aside className="card synchronization-card" aria-live="polite">
          <div className="card-heading compact">
            <div><span className="eyebrow">COMMAND STATUS</span><h2>Synchronization</h2></div>
            <span className={"connection-chip " + (isOnline ? "online" : "offline")}><i aria-hidden="true" />{isOnline ? "Ready" : "Paused"}</span>
          </div>
          <div className="sync-message"><span aria-hidden="true">i</span><p>{message}</p></div>
          <div className="queue-heading"><strong>Recent intake commands</strong><span>{events.length} privacy-safe receipts</span></div>
          {events.length === 0 ? (
            <div className="empty-queue"><span aria-hidden="true">◎</span><strong>No accepted commands yet</strong><small>Only server command IDs and status evidence appear here—never Donation No.</small></div>
          ) : (
            <ul className="events">
              {events.map((event) => (
                <li key={event.commandId}>
                  <span><strong>{event.resourceId}</strong><small>{event.bloodType ?? "Recovered"} · {event.componentType ?? "command"}</small></span>
                  <span className={"event-status status-" + event.status.toLowerCase().replaceAll("_", "-")}>{event.status}</span>
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
