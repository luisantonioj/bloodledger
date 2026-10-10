import { InformationHelp } from "../../components/ui/information-help";
import { RequestFormHelp } from "./request-form-help";
import { RequesterRequestPlaceholders } from "./requester-request-placeholders";
import { useRef, useState } from "react";
import { canAct, type Principal } from "../../auth/permissions";
import { componentLabel } from "./requester-transfer-data";
import { formatBloodType, humanizeCode } from "../../components/ui/display";
import { CommandStatusCard } from "../commands/command-status-card";
import { useCommandStatus } from "../commands/use-command-status";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";
import { mutationError } from "../../services/api/mutation-error";
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

function RequestDropdown({ styled, children }: { styled: boolean; children: React.ReactNode }) {
  return styled ? <span className="requester-select">{children}</span> : children;
}

export function V2TransferRequest({ principal, onRefresh, requesterPresentation = false, onCancel, initialBloodType, initialComponentType }: { principal: Principal; onRefresh: () => void; requesterPresentation?: boolean; onCancel?: () => void; initialBloodType?: V2BloodType; initialComponentType?: V2ComponentType }) {
  const automaticRoutingPending = requesterPresentation && Boolean(principal.accountId);
  const [bloodType, setBloodType] = useState<V2BloodType>(initialBloodType ?? "A_POSITIVE");
  const [componentType, setComponentType] = useState<V2ComponentType>(initialComponentType ?? "PACKED_RED_BLOOD_CELLS");
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState("ROUTINE");
  const banks = [{id:"INST_MEDIATRIX",name:"Mediatrix"},{id:"INST_SYNTH_MEDIX",name:"Medix"},{id:"INST_SYNTH_NLVILLA",name:"N.L. Villa"}].filter(bank => bank.id !== principal.institutionId);
  const [source, setSource] = useState(principal.accountId ? banks[0]?.id ?? "INST_MEDIATRIX" : "INST_MEDIATRIX");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requiresCorrection, setRequiresCorrection] = useState(false);
  const timeRejections = useRef(0);
  const attempt = useRef<{ keys: MutationKeys; payload: Record<string, unknown> & { componentType: V2ComponentType } } | undefined>(undefined);
  const status = useCommandStatus(onRefresh);
  const locked = busy || status.command !== undefined;

  function changed(action: () => void) {
    action();
    attempt.current = undefined;
    status.clear();
    setError("");
    setRequiresCorrection(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (locked || requiresCorrection || automaticRoutingPending) return;
    setBusy(true);
    setError("");
    const current = attempt.current ?? (() => {
      const keys = newMutationKeys();
      const eventTime = new Date().toISOString();
      return {
        keys,
        payload: {
          transferId: resourceId("TRF_WEB_", keys),
          sourceInstitutionId: source,
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
      timeRejections.current = 0;
    } catch (reason) {
      const failure = mutationError(reason, timeRejections.current);
      if (failure.timeRejected) timeRejections.current++;
      if (failure.discardAttempt) attempt.current = undefined;
      setRequiresCorrection(failure.requiresCorrection);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const submitButton = <button className="button primary compact" disabled={locked || requiresCorrection || automaticRoutingPending} title={automaticRoutingPending ? "Automatic supplier routing is not available yet." : undefined}>{busy ? "Submitting…" : status.command ? "Command accepted" : requiresCorrection ? "Correct request before submitting" : error && attempt.current ? "Retry same request" : requesterPresentation ? "Submit request" : "Submit V2 request"}</button>;

  return <section className={requesterPresentation ? "requester-request-form" : "v2-operation-card"}>
    <header><div><h3>{requesterPresentation ? "Create Blood Request" : principal.accountId ? "Request blood" : "Request blood from Mediatrix"}</h3></div>{requesterPresentation ? <RequestFormHelp label="Create Blood Request">Enter the basic details of the requested blood supply.</RequestFormHelp> : <InformationHelp label="Request blood">Request a blood product for the authenticated institution using the supported command. The supplying bank and requested product remain subject to the recorded workflow; command acceptance is not approval or ledger commitment.</InformationHelp>}</header>
    <form className={requesterPresentation ? "requester-request-fields" : "v2-operation-form"} onSubmit={(event) => void submit(event)}>
      {automaticRoutingPending ? <div className="requester-routing-field">
        <div className="requester-routing-label"><label htmlFor="requester-supplier-routing">Supplier Routing</label><RequestFormHelp label="Supplier Routing" id="requester-supplier-routing-help">BloodLedger will assign an eligible supplying blood bank when automatic routing becomes available. Source selection is not editable. Submission is unavailable until routing is connected.</RequestFormHelp></div>
        <input id="requester-supplier-routing" value="Assign automatically" readOnly aria-describedby="requester-supplier-routing-help"/>
      </div> : principal.accountId && <label>Source blood bank<RequestDropdown styled={true}><select disabled={locked} value={source} onChange={event => changed(() => setSource(event.target.value))}>{banks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></RequestDropdown></label>}
      <label>Blood type<RequestDropdown styled={true}><select aria-label="Blood type" disabled={locked} value={bloodType} onChange={(event) => changed(() => setBloodType(event.target.value as V2BloodType))}>{V2_BLOOD_TYPES.map((value) => <option key={value} value={value}>{formatBloodType(value)}</option>)}</select></RequestDropdown></label>
      <label>Component<RequestDropdown styled={true}><select disabled={locked} value={componentType} onChange={(event) => changed(() => setComponentType(event.target.value as V2ComponentType))}>{V2_COMPONENT_TYPES.map((value) => <option key={value} value={value}>{componentLabel(value)}</option>)}</select></RequestDropdown></label>
      <label>Quantity<input disabled={locked} type="number" min="1" value={quantity} onChange={(event) => changed(() => setQuantity(Number(event.target.value)))}/></label>
      <label>Urgency<RequestDropdown styled={true}><select disabled={locked} value={urgency} onChange={(event) => changed(() => setUrgency(event.target.value))}><option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option><option value="CRITICAL">Critical</option></select></RequestDropdown></label>
      {requesterPresentation && <RequesterRequestPlaceholders/>}
      {requesterPresentation ? <div className="v2-submit requester-submit-footer">
        <small>{automaticRoutingPending ? <>Request for {principal.institutionDisplayName}. Automatic supplier routing is not available yet.</> : <>Submitted for {principal.institutionDisplayName}. The selected blood bank reviews your request.</>}</small>
        <div className="requester-submit-actions">{onCancel && <button className="button compact" type="button" disabled={locked} onClick={onCancel}>Cancel</button>}{submitButton}</div>
        {error && <span role="alert">{error}</span>}
      </div> : <div className="v2-submit"><div className="requester-submit-actions">{onCancel&&<button className="button compact" type="button" disabled={locked} onClick={onCancel}>Cancel</button>}{submitButton}</div>{error && <span role="alert">{error}</span>}</div>}
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
  const [requiresCorrection, setRequiresCorrection] = useState(false);
  const timeRejections = useRef(0);
  const attempt = useRef<{ keys: MutationKeys; payload: Record<string, unknown> & { componentType: V2ComponentType } } | undefined>(undefined);
  const status = useCommandStatus(onRefresh);
  const locked = busy || status.command !== undefined;

  function changed(action: () => void) {
    action();
    attempt.current = undefined;
    status.clear();
    setError("");
    setRequiresCorrection(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (locked || requiresCorrection) return;
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
      timeRejections.current = 0;
    } catch (reason) {
      const failure = mutationError(reason, timeRejections.current);
      if (failure.timeRejected) timeRejections.current++;
      if (failure.discardAttempt) attempt.current = undefined;
      setRequiresCorrection(failure.requiresCorrection);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="v2-operation-card">
    <header><h3>Start local release</h3><InformationHelp label="Start local release">Start a local-release reservation for stock held by your institution. This records the supported reservation command without collecting patient or donor details. A queued command is not a completed release; review its recorded outcome before proceeding.</InformationHelp></header>
    <form className="v2-operation-form" onSubmit={(event) => void submit(event)}>
      <label>Blood type<span className="requester-select"><select disabled={locked} value={bloodType} onChange={(event) => changed(() => setBloodType(event.target.value as V2BloodType))}>{V2_BLOOD_TYPES.map((value) => <option key={value} value={value}>{formatBloodType(value)}</option>)}</select></span></label>
      <label>Component<span className="requester-select"><select disabled={locked} value={componentType} onChange={(event) => changed(() => setComponentType(event.target.value as V2ComponentType))}>{V2_COMPONENT_TYPES.map((value) => <option key={value} value={value}>{componentLabel(value)}</option>)}</select></span></label>
      <label>Quantity<input disabled={locked} type="number" min="1" value={quantity} onChange={(event) => changed(() => setQuantity(Number(event.target.value)))}/></label>
      <div className="v2-submit"><button className="button primary compact" disabled={locked || requiresCorrection}>{busy ? "Submitting…" : status.command ? "Command accepted" : requiresCorrection ? "Correct release before submitting" : error && attempt.current ? "Retry same release" : "Queue local release"}</button>{error && <span role="alert">{error}</span>}</div>
    </form>
    {status.command && <CommandStatusCard command={status.command} pollError={status.pollError} onClear={status.clear}/>}
  </section>;
}

function BlockedWorkflow({ title, detail }: { title: string; detail: string }) {
  return <section className="v2-blocked-workflow"><span aria-hidden="true">!</span><div><strong>{title}</strong><p>{detail}</p></div><b>NOT CONNECTED</b></section>;
}

export function V2Operations({ principal, onRefresh, showRequest=true, onCancelRequest, initialBloodType, initialComponentType }: { principal: Principal; onRefresh: () => void;showRequest?:boolean;onCancelRequest?:()=>void;initialBloodType?:V2BloodType;initialComponentType?:V2ComponentType }) {
  const recipient = principal.accountId ? canAct(principal, "transfer:request") : principal.roleId === "ROLE-03";
  const sourceOperator = principal.accountId ? canAct(principal, "inventory:local-release") : ["ROLE-01", "ROLE-02"].includes(principal.roleId);
  if (!recipient && !sourceOperator) return null;
  return <div className="v2-operations">
    <header className="bank-section-heading"><h2>Facility operations</h2><InformationHelp label="Facility operations">Use the supported request or local-release form available to your operator role. Verification and command status remain part of submission. Accepted commands are tracked until committed, failed or conflicted; they are not immediately confirmed inventory changes.</InformationHelp></header>
    {recipient && showRequest && <V2TransferRequest principal={principal} onRefresh={onRefresh} onCancel={onCancelRequest} initialBloodType={initialBloodType} initialComponentType={initialComponentType}/>}
    {sourceOperator && <V2LocalRelease onRefresh={onRefresh}/>}
    <details className="bank-workflow-availability"><summary>Workflow availability</summary><BlockedWorkflow title="Canonical reservation actions unavailable" detail="The reservation list below is read-only. Prepare, dispatch, transit, receive, cancel, compromise, and completion controls remain unconnected; do not guess an ID or version."/>
    {sourceOperator && <BlockedWorkflow title="Reconciliation reason policy unavailable" detail="A command route exists, but the approved reason-code list is still an external decision. The frontend will not invent a reason code."/>}</details>
  </div>;
}
