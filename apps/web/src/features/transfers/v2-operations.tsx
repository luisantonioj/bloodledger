import { useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { humanizeCode } from "../../components/ui/display";
import { CommandStatusCard } from "../commands/command-status-card";
import { useCommandStatus } from "../commands/use-command-status";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";
import {
  V2_BLOOD_TYPES,
  V2_COMPONENT_TYPES,
  submitV2LocalRelease,
  submitV2Transfer,
  type V2BloodType,
  type V2ComponentType,
} from "../../services/api/v2";

function resourceId(prefix: "TRF_WEB_" | "REL_WEB_", keys: MutationKeys): string {
  return prefix + keys.correlationId.slice("CORR_".length);
}

function V2TransferRequest({ principal, onRefresh }: { principal: Principal; onRefresh: () => void }) {
  const [bloodType, setBloodType] = useState<V2BloodType>("A_POSITIVE");
  const [componentType, setComponentType] = useState<V2ComponentType>("PACKED_RED_BLOOD_CELLS");
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState("ROUTINE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ keys: MutationKeys; payload: Record<string, unknown> & { componentType: V2ComponentType } } | undefined>(undefined);
  const status = useCommandStatus(onRefresh);
  const locked = busy || status.command !== undefined;

  function changed(action: () => void) {
    action();
    attempt.current = undefined;
    status.clear();
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const current = attempt.current ?? (() => {
      const keys = newMutationKeys();
      const eventTime = new Date().toISOString();
      return {
        keys,
        payload: {
          transferId: resourceId("TRF_WEB_", keys),
          sourceInstitutionId: "INST_MEDIATRIX",
          destinationInstitutionId: principal.institutionId,
          bloodType,
          componentType,
          quantity,
          urgency,
          requestTime: eventTime,
          eventTime,
          correlationId: keys.correlationId,
        },
      };
    })();
    attempt.current = current;
    try {
      status.accept(await submitV2Transfer(current.payload, current.keys));
      attempt.current = undefined;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The V2 transfer command was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="v2-operation-card">
    <header><div><p className="eyebrow">INTERVIEW_DERIVED_CORE_V2</p><h3>Request blood from Mediatrix</h3><p>Source is fixed by contract; destination is the authenticated institution.</p></div><span>ROLE-03</span></header>
    <form className="v2-operation-form" onSubmit={(event) => void submit(event)}>
      <label>Blood type<select disabled={locked} value={bloodType} onChange={(event) => changed(() => setBloodType(event.target.value as V2BloodType))}>{V2_BLOOD_TYPES.map((value) => <option key={value} value={value}>{humanizeCode(value)}</option>)}</select></label>
      <label>Component<select disabled={locked} value={componentType} onChange={(event) => changed(() => setComponentType(event.target.value as V2ComponentType))}>{V2_COMPONENT_TYPES.map((value) => <option key={value} value={value}>{humanizeCode(value)}</option>)}</select></label>
      <label>Quantity<input disabled={locked} type="number" min="1" value={quantity} onChange={(event) => changed(() => setQuantity(Number(event.target.value)))}/></label>
      <label>Urgency<select disabled={locked} value={urgency} onChange={(event) => changed(() => setUrgency(event.target.value))}><option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option><option value="CRITICAL">Critical</option></select></label>
      <div className="v2-submit"><button className="button primary" disabled={locked}>{busy ? "Submitting…" : status.command ? "Command accepted" : error ? "Retry same request" : "Submit V2 request"}</button>{error && <span role="alert">{error}</span>}</div>
    </form>
    {status.command && <CommandStatusCard command={status.command} pollError={status.pollError} onClear={status.clear}/>}
  </section>;
}

function V2LocalRelease({ onRefresh }: { onRefresh: () => void }) {
  const [bloodType, setBloodType] = useState<V2BloodType>("A_POSITIVE");
  const [componentType, setComponentType] = useState<V2ComponentType>("PACKED_RED_BLOOD_CELLS");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ keys: MutationKeys; payload: Record<string, unknown> & { componentType: V2ComponentType } } | undefined>(undefined);
  const status = useCommandStatus(onRefresh);
  const locked = busy || status.command !== undefined;

  function changed(action: () => void) {
    action();
    attempt.current = undefined;
    status.clear();
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const current = attempt.current ?? (() => {
      const keys = newMutationKeys();
      const eventTime = new Date().toISOString();
      return {
        keys,
        payload: {
          releaseId: resourceId("REL_WEB_", keys),
          bloodType,
          componentType,
          quantity,
          eventTime,
          correlationId: keys.correlationId,
        },
      };
    })();
    attempt.current = current;
    try {
      status.accept(await submitV2LocalRelease(current.payload, current.keys));
      attempt.current = undefined;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The local-release command was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="v2-operation-card">
    <header><div><p className="eyebrow">Human-controlled reservation</p><h3>Start local release</h3><p>No patient, donor, diagnosis, crossmatch, or transfusion data is collected.</p></div><span>ROLE-01 / ROLE-02</span></header>
    <form className="v2-operation-form" onSubmit={(event) => void submit(event)}>
      <label>Blood type<select disabled={locked} value={bloodType} onChange={(event) => changed(() => setBloodType(event.target.value as V2BloodType))}>{V2_BLOOD_TYPES.map((value) => <option key={value} value={value}>{humanizeCode(value)}</option>)}</select></label>
      <label>Component<select disabled={locked} value={componentType} onChange={(event) => changed(() => setComponentType(event.target.value as V2ComponentType))}>{V2_COMPONENT_TYPES.map((value) => <option key={value} value={value}>{humanizeCode(value)}</option>)}</select></label>
      <label>Quantity<input disabled={locked} type="number" min="1" value={quantity} onChange={(event) => changed(() => setQuantity(Number(event.target.value)))}/></label>
      <div className="v2-submit"><button className="button primary" disabled={locked}>{busy ? "Submitting…" : status.command ? "Command accepted" : error ? "Retry same release" : "Queue local release"}</button>{error && <span role="alert">{error}</span>}</div>
    </form>
    {status.command && <CommandStatusCard command={status.command} pollError={status.pollError} onClear={status.clear}/>}
  </section>;
}

function BlockedWorkflow({ title, detail }: { title: string; detail: string }) {
  return <section className="v2-blocked-workflow"><span aria-hidden="true">!</span><div><strong>{title}</strong><p>{detail}</p></div><b>NOT CONNECTED</b></section>;
}

export function V2Operations({ principal, onRefresh }: { principal: Principal; onRefresh: () => void }) {
  const recipient = principal.roleId === "ROLE-03";
  const sourceOperator = ["ROLE-01", "ROLE-02"].includes(principal.roleId);
  if (!recipient && !sourceOperator) return null;
  return <div className="v2-operations">
    <div className="v2-workflow-disclosure"><strong>Sprint 6 command workflows</strong><span>Acceptance is not ledger commitment. Every state remains visible until committed, failed, or conflicted.</span></div>
    {recipient && <V2TransferRequest principal={principal} onRefresh={onRefresh}/>}
    {sourceOperator && <V2LocalRelease onRefresh={onRefresh}/>}
    <BlockedWorkflow title="Canonical reservation actions unavailable" detail="The backend exposes mutation actions but no permission-scoped reservation list/detail read for the frontend. Prepare, dispatch, transit, receive, cancel, compromise, and completion remain disabled rather than guessing an ID or version."/>
    {sourceOperator && <BlockedWorkflow title="Reconciliation reason policy unavailable" detail="A command route exists, but the approved reason-code list is still an external decision. The frontend will not invent a reason code."/>}
  </div>;
}
