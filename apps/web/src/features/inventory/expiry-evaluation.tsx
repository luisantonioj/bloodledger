import { useEffect, useRef, useState } from "react";
import { canAct, type Principal } from "../../auth/permissions";
import { mutationError } from "../../services/api/mutation-error";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";
import { submitExpiryEvaluation, type V2Component } from "../../services/api/v2";
import { CommandStatusCard } from "../commands/command-status-card";
import { useCommandStatus } from "../commands/use-command-status";

export function ExpiryEvaluation({ component, principal, onRefresh }: { component?: V2Component; principal: Principal; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const attempt = useRef<{ keys: MutationKeys; expectedVersion: number } | undefined>(undefined);
  const status = useCommandStatus(onRefresh);
  const eligible = component?.expiryState === "LABEL_EXPIRED_PENDING_EVALUATION" && component.inventoryStatus === "AVAILABLE" &&
    component.institutionId === principal.institutionId && canAct(principal, "inventory:expiry");
  useEffect(() => {
    if (component) { setRequiresRefresh(false); setError(""); }
  }, [component]);

  async function submit() {
    if (busy || status.command || requiresRefresh || !eligible || !component) return;
    setBusy(true); setError("");
    const current = attempt.current ?? { keys: newMutationKeys(), expectedVersion: component.inventoryVersion };
    attempt.current = current;
    try {
      const command = await submitExpiryEvaluation(component.componentId, current.expectedVersion, current.keys);
      if (command.resourceType !== "COMPONENT" || command.resourceId !== component.componentId || command.correlationId !== current.keys.correlationId) {
        throw new Error("The accepted command identity could not be verified. Retry the same request.");
      }
      status.accept(command); attempt.current = undefined;
      if (["COMMITTED", "FAILED", "CONFLICT"].includes(command.status)) onRefresh();
    } catch (reason) {
      const failure = mutationError(reason);
      if (failure.discardAttempt) attempt.current = undefined;
      setRequiresRefresh(failure.requiresCorrection); setError(failure.message);
    } finally { setBusy(false); }
  }

  return <section>
    {eligible && <button className="button danger" type="button" disabled={busy || status.command !== undefined || requiresRefresh} onClick={() => void submit()}>{busy ? "Submitting expiry evaluation…" : "Evaluate expiry"}</button>}
    {error && <p role="alert">{error}</p>}
    {requiresRefresh && <button className="button" onClick={onRefresh}>Refresh component</button>}
    {component?.expiryState === "LABEL_EXPIRED_PENDING_EVALUATION" && component.inventoryStatus === "RESERVED" && <p>Cancel the active reservation through its authorized workflow before evaluating expiry. Open the linked reservation to review its purpose and members.</p>}
    {status.command && <CommandStatusCard command={status.command} pollError={status.pollError} onClear={status.clear}/>}
    {status.command?.status === "COMMITTED" && <p>The expiry evaluation committed. Check Alerts for the expired component and acknowledgement.</p>}
  </section>;
}
