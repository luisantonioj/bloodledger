import { retryAfterContextChange } from "../../services/api/client";
import { useEffect, useRef, useState } from "react";
import { mutationError } from "../../services/api/mutation-error";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";
import { readCommandByKey, type V2Command } from "../../services/api/v2";
import { useCommandStatus } from "./use-command-status";

interface Attempt { keys: MutationKeys; payload: Record<string, unknown>; resourceType: V2Command["resourceType"]; resourceId: string }
export function useUatCommand(onRefresh: () => void) {
  const status = useCommandStatus(onRefresh);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const attempt = useRef<Attempt | undefined>(undefined);
  const timeRejections = useRef(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [requiresCorrection, setRequiresCorrection] = useState(false), [ambiguous, setAmbiguous] = useState(false);
  async function submit(build: (keys: MutationKeys) => Omit<Attempt, "keys">, send: (payload: Record<string, unknown>, keys: MutationKeys) => Promise<V2Command>) {
    if (busy || status.command || requiresCorrection) return;
    setBusy(true); setError("");
    try {
      const keys = attempt.current?.keys ?? newMutationKeys();
      const current = attempt.current ?? { keys, ...build(keys) };
      attempt.current = current;
      const command = await send(current.payload, current.keys);
      if (command.resourceType !== current.resourceType || command.resourceId !== current.resourceId || command.correlationId !== current.keys.correlationId) throw new Error("Accepted command identity is inconsistent. Recover or retry the same attempt.");
      attempt.current = undefined; setAmbiguous(false); status.accept(command);
      if (["COMMITTED", "FAILED", "CONFLICT"].includes(command.status)) onRefresh();
    } catch (reason) {
      const failure = mutationError(reason, timeRejections.current);
      if (failure.timeRejected) timeRejections.current++;
      if (failure.discardAttempt) attempt.current = undefined;
      setAmbiguous(attempt.current !== undefined); setRequiresCorrection(failure.requiresCorrection); setError(failure.message);
    } finally { setBusy(false); }
  }
  // A rejected attempt may be corrected. An ambiguous attempt remains frozen.
  function correct() { if (!attempt.current) { setRequiresCorrection(false); setError(""); } }
  async function recover() {
    const current = attempt.current;
    if (!current || busy || status.command) return;
    setBusy(true); setError("");
    try {
      const active = () => mounted.current && attempt.current === current;
      const command = await retryAfterContextChange(() => readCommandByKey(current.keys.idempotencyKey), active);
      if (!active()) return;
      if (!command) throw new Error("No accepted command was found for this attempt. Nothing was resubmitted; acceptance remains unverified.");
      if (command.resourceType !== current.resourceType || command.resourceId !== current.resourceId || command.correlationId !== current.keys.correlationId) throw new Error("V2_COMMAND_IDENTITY_MISMATCH");
      attempt.current = undefined; setAmbiguous(false); status.accept(command);
      if (["COMMITTED", "FAILED", "CONFLICT"].includes(command.status)) onRefresh();
    } catch (reason) {if (mounted.current) setError(reason instanceof Error ? reason.message : "Command lookup unavailable. Nothing was resubmitted.");}
    finally {if (mounted.current) setBusy(false);}
  }
  return { ...status, busy, error, requiresCorrection, ambiguous, submit, correct, recover, pendingKey: attempt.current?.keys.idempotencyKey, locked: busy || ambiguous || !!status.command };
}
