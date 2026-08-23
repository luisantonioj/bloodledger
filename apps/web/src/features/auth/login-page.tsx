import { useState } from "react";
import type { Principal } from "../../auth/permissions";
import { requestJson } from "../../services/api/client";

export function LoginPage({ onAuthenticated }: { onAuthenticated: (principal: Principal) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await requestJson<{ principal: Principal }>("/api/v1/auth/session", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }, "Authentication unavailable.");
      onAuthenticated(result.principal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication unavailable.");
    }
  }

  return <main className="login"><section className="login-panel"><div className="brand"><span className="mark">BL</span>BloodLedger</div><p className="eyebrow">Controlled research prototype</p><h1>Sign in to your workspace</h1><p className="subtitle">Role and institution scope are assigned by the server.</p><form onSubmit={event => void submit(event)}><label>Username<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></label>{error && <p className="error" role="alert">{error}</p>}<button className="button primary">Sign in</button></form></section><aside className="login-visual">Trusted inventory and custody evidence, with explicit scope and freshness.</aside></main>;
}
