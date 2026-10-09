import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Principal } from "./permissions";
import { eligibleOperators } from "./operator-actions";
import { requestJson, setCommandVerifier, type VerificationRequest } from "../services/api/client";

export function OperatorVerification({principal, children}: {principal: Principal; children: ReactNode}) {
  const [pending, setPending] = useState<VerificationRequest>();
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const awaiting = useRef<{resolve: (id: string) => void; reject: (error: Error) => void} | undefined>(undefined);
  const generation = useRef(0);
  useEffect(() => {
    if (!principal.verificationRequired) return;
    setCommandVerifier(request => new Promise((resolve, reject) => {
      if (awaiting.current) return reject(new Error("Finish the current operator verification first."));
      const operators = eligibleOperators(principal.operators ?? [], request.action);
      if (!operators.length) return reject(new Error("No authorized operator is available for this action."));
      awaiting.current = {resolve, reject};
      setOperatorId(operators[0].operatorId); setPin(""); setError(""); setPending(request);
    }));
    return () => { generation.current++; setCommandVerifier(); awaiting.current?.reject(new Error("The account session ended.")); awaiting.current = undefined; };
  }, [principal]);
  function cancel() { generation.current++; awaiting.current?.reject(new Error("Operator verification cancelled. The command was not sent.")); awaiting.current = undefined; setPin(""); setPending(undefined); setBusy(false); }
  async function verify(event: React.FormEvent) {
    event.preventDefault(); if (!pending) return;
    const current = generation.current; setBusy(true); setError("");
    const privatePin = pin; setPin("");
    try {
      const result = await requestJson<{verificationId: string}>("/api/v2/auth/operator-verifications", {method: "POST", body: JSON.stringify({...pending, operatorId, pin: privatePin})});
      if (current !== generation.current) return;
      awaiting.current?.resolve(result.verificationId); awaiting.current = undefined; setPending(undefined);
    } catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : "Verification failed."); }
    finally { if (current === generation.current) setBusy(false); }
  }
  return <>{children}{pending && <div className="preview-modal-backdrop"><section className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="operator-verification-title"><header><div><h2 id="operator-verification-title">Verify operator</h2><p>{principal.institutionDisplayName} · Authorize this action</p></div><button aria-label="Cancel verification" onClick={cancel}>×</button></header><form className="preview-modal-body auth-form" onSubmit={event => void verify(event)}><label>Operator<select aria-label="Operator" value={operatorId} disabled={busy} onChange={event => setOperatorId(event.target.value)}>{eligibleOperators(principal.operators ?? [], pending.action).map(operator => <option key={operator.operatorId} value={operator.operatorId}>{operator.roleId} · {operator.operatorId}</option>)}</select></label><label>Operator PIN<input type="password" inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} autoComplete="off" value={pin} disabled={busy} onChange={event => setPin(event.target.value)} required/></label><p>Your PIN authorizes this command only and is never saved in the browser.</p>{error && <p role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? "Verifying…" : "Verify and submit"}</button><button className="button" type="button" onClick={cancel}>Cancel</button></form></section></div>}</>;
}
