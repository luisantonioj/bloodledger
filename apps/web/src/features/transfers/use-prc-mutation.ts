import { useEffect, useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { ApiRequestError, requestJson } from "../../services/api/client";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";
import { parsePrcMutation, prcSupplyError, prcDefiniteRejection, type PrcSupplyRequest } from "../../services/api/prc-supply";

type Attempt = {path: string; payload: object; keys: MutationKeys; requestId?: string; uncertain: boolean};
export function usePrcMutation(principal: Principal, onRecorded: (row: PrcSupplyRequest) => void) {
  const attempt = useRef<Attempt | undefined>(undefined), active = useRef(false), locked = useRef(false);
  const [busy, setBusy] = useState(false), [ambiguous, setAmbiguous] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  useEffect(() => {active.current = true; return () => {active.current = false;};}, []);
  async function send(current: Attempt) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setNotice("");
    try {
      // Synchronous off-chain result; never use V2 command polling or automatic POST retries.
      const row = parsePrcMutation(await requestJson(current.path, {method: "POST", headers: {"Idempotency-Key": current.keys.idempotencyKey}, body: JSON.stringify(current.payload)}), principal, current.requestId);
      if (!active.current || attempt.current !== current) return;
      attempt.current = undefined; setAmbiguous(false); setNeedsRefresh(false);
      setNotice(row.replayed ? "Previously recorded off-chain result confirmed." : "PRC supply update recorded off-chain.");
      onRecorded(row);
    } catch (reason) {
      if (!active.current || attempt.current !== current) return;
      if (reason instanceof Error && reason.message === "Operator verification cancelled. The command was not sent.") {
        if (current.uncertain) {setAmbiguous(true);setError("Verification cancelled. The earlier result remains unconfirmed.");}
        else {attempt.current = undefined; setAmbiguous(false); setError("Operator verification cancelled. Nothing was submitted.");} return;
      }
      if (reason instanceof Error && reason.message === "The original PRC operator is no longer authorized. Review the request before continuing.") {
        setAmbiguous(true); setError(reason.message); return;
      }
      const wasUnconfirmed = current.uncertain, rejected = prcDefiniteRejection(reason, wasUnconfirmed);
      if (rejected) attempt.current = undefined; else current.uncertain = true;
      setAmbiguous(!rejected); setNeedsRefresh(reason instanceof ApiRequestError && [404, 409].includes(reason.status)); setError((wasUnconfirmed ? "The earlier result remains unconfirmed. Review existing PRC requests before creating a replacement. " : "") + prcSupplyError(reason));
    } finally {locked.current = false; if (active.current) setBusy(false);}
  }
  function run(path: string, build: (correlationId: string) => object, requestId?: string) {
    if (locked.current || attempt.current || needsRefresh) return;
    const keys = newMutationKeys(), current = {path, payload: build(keys.correlationId), keys, requestId, uncertain: false};
    attempt.current = current; void send(current);
  }
  return {busy, ambiguous, error, notice, needsRefresh, locked: busy || ambiguous, run, retry: () => {if (attempt.current) void send(attempt.current);}, refreshed: () => {if (!attempt.current) {setNeedsRefresh(false);setError("");}}};
}
