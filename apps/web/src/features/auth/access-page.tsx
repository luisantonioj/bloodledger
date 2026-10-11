import { SyntheticApplication } from "./synthetic-application";
import { useState, type FormEvent } from "react";
import type { Principal } from "../../auth/permissions";
import { requestJson } from "../../services/api/client";

type AccessMode = "signin" | "apply";
export function AccessPage({ onAuthenticated }: { onAuthenticated: (principal: Principal) => void }) {
  const [mode, setMode] = useState<AccessMode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await requestJson<{ principal: Principal }>("/api/v1/auth/session", {
        method: "POST", body: JSON.stringify({ username, password }),
      }, "Authentication unavailable.");
      onAuthenticated(result.principal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className={`auth-page ${mode === "apply" ? "application-mode" : ""}`}>
    <aside className="auth-hero" aria-label="BloodLedger prototype context">
      <div className="auth-hero-brand"><span className="mark auth-mark">BL</span><span><strong>Blood<em>ledger</em></strong><small>Controlled research prototype</small></span></div>
      <div className="auth-hero-message"><p className="eyebrow">Accountable inventory evidence</p><h1>One ledger.<br/>Clear custody.<br/><em>Every unit accounted for.</em></h1><p>Authenticated inventory and custody workflows with explicit institution scope, freshness, and simulation-only evidence.</p></div>
      <div className="auth-hero-signature"><span aria-hidden="true">◆</span><span>Fabric-backed evidence</span><span aria-hidden="true">·</span><span>Synthetic data only</span></div>
    </aside>
    <section className="auth-pane">
      <div className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "apply"} className={mode === "apply" ? "active" : ""} onClick={() => setMode("apply")}>Apply for access</button>
        </div>
        {mode === "apply" ? <SyntheticApplication /> : <>
          <div className="auth-card-heading"><p className="eyebrow">Welcome back</p><h2>Sign in to BloodLedger</h2><p>Use your institution email and privately supplied password.</p></div>
          <form className="auth-form" onSubmit={event => void submit(event)}>
            <label htmlFor="login-username">Institution email or username<input id="login-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="bloodbank@mmc.bloodledger" required/></label>
            <label htmlFor="login-password">Password<input id="login-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" required/></label>
            <div className="auth-form-options"><label><input type="checkbox" />Keep me signed in on this trusted device</label><button type="button" disabled title="Password recovery is not implemented">Forgot password?</button></div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button primary auth-submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>
          </form>
          <div className="auth-scope-note"><strong>Server-assigned access</strong><span>Your role and institution scope cannot be selected or changed from this screen.</span></div>
        </>}
      </div>
      <footer className="auth-footer">Permissioned access for authorized synthetic participants only.</footer>
    </section>
  </main>;
}
