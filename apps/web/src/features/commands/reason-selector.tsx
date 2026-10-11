import { useEffect, useState } from "react";
import { readReasonPolicy, type ReasonKind, type ReasonPolicy } from "../../services/api/uat-reasons";

export function ReasonSelector({ kind, value, onChange, disabled }: { kind: ReasonKind; value: string; onChange: (code: string) => void; disabled: boolean }) {
  const [policy, setPolicy] = useState<ReasonPolicy>(), [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let closed = false;
    setPolicy(undefined); setError(""); onChange("");
    void readReasonPolicy(kind, controller.signal).then(row => { if (!closed) setPolicy(row); }).catch(reason => { if (!closed) setError(reason instanceof Error ? reason.message : "Reason policy unavailable."); });
    return () => { closed = true; controller.abort(); };
    // Reset selection only when the policy is reloaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, retry]);
  return <div><label>{kind === "compromise" ? "Compromise reason" : "Reconciliation reason"}<select value={value} disabled={disabled || !policy} onChange={event => onChange(event.target.value)} required>
    <option value="">{policy ? "Choose a reason" : "Loading approved reasons…"}</option>
    {policy?.reasons.map(reason => <option key={reason.code} value={reason.code}>{reason.label}</option>)}
  </select></label>{policy && <small>Policy: {policy.policyVersion}</small>}
    {error && <p role="alert">{error} <button type="button" className="button compact" disabled={disabled} onClick={() => setRetry(value => value + 1)}>Reload reason policy</button></p>}
  </div>;
}
