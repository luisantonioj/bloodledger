import { useState } from "react";
import type { Principal } from "../../auth/permissions";
import { requestJson } from "../../services/api/client";

export function LoginPage({ onAuthenticated }: { onAuthenticated: (principal: Principal) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await requestJson<{ principal: Principal }>("/api/v1/auth/session", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }, "Authentication unavailable.");
      onAuthenticated(result.principal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="auth-page">
    <aside className="auth-hero" aria-label="BloodLedger prototype context">
      <div className="auth-hero-brand">
        <span className="mark auth-mark">BL</span>
        <span><strong>Blood<em>ledger</em></strong><small>Controlled research prototype</small></span>
      </div>
      <div className="auth-hero-message">
        <p className="eyebrow">Accountable inventory evidence</p>
        <h1>One ledger.<br/>Clear custody.<br/><em>Every unit accounted for.</em></h1>
        <p>Authenticated inventory and custody workflows with explicit institution scope, freshness, and simulation-only evidence.</p>
      </div>
      <div className="auth-hero-signature"><span aria-hidden="true">◆</span><span>Fabric-backed evidence</span><span aria-hidden="true">·</span><span>Synthetic data only</span></div>
    </aside>
    <section className="auth-pane">
      <div className="auth-card">
        <div className="auth-card-heading">
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to BloodLedger</h2>
          <p>Use the opaque username assigned to your approved synthetic account.</p>
        </div>
        <form className="auth-form" onSubmit={event => void submit(event)}>
          <label htmlFor="login-username">Username<input id="login-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="synth_account_name" required/></label>
          <label htmlFor="login-password">Password<input id="login-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" required/></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button primary auth-submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>
        </form>
        <div className="auth-scope-note"><strong>Server-assigned access</strong><span>Your role and institution scope cannot be selected or changed from this screen.</span></div>
      </div>
      <footer className="auth-footer">Permissioned access for authorized synthetic participants only.</footer>
    </section>
  </main>;
}
