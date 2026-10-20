import { ActionButton } from "../../components/ui/action-button";
import { InformationHelp } from "../../components/ui/information-help";
import { RequestFormHelp } from "./request-form-help";
import { EMPTY_REQUESTER_FIELDS, RequesterRequestFields, requesterDetails, type RequesterFields } from "./requester-request-fields";
import { useEffect, useRef, useState } from "react";
import { AVAILABILITY_BAND_LABEL, readDocumentFile, readEligibleSuppliers, type EligibleSupplier, type RequestDocumentKind } from "../../services/api/request-details";
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
  submitV2Transfer,
  type V2BloodType,
  type V2ComponentType,
} from "../../services/api/v2";

function resourceId(prefix: "TRF_WEB_", keys: MutationKeys): string {
  return prefix + keys.correlationId.slice("CORR_".length);
}

function RequestDropdown({ styled, children }: { styled: boolean; children: React.ReactNode }) {
  return styled ? <span className="requester-select">{children}</span> : children;
}

export function V2TransferRequest({ principal, onRefresh, requesterPresentation = false, onCancel, initialBloodType, initialComponentType }: { principal: Principal; onRefresh: () => void; requesterPresentation?: boolean; onCancel?: () => void; initialBloodType?: V2BloodType; initialComponentType?: V2ComponentType }) {
  // PA-REQ-05: primary requester accounts choose from banks with projected available stock for the product.
  const supplierChoice = requesterPresentation && Boolean(principal.accountId);
  const [bloodType, setBloodType] = useState<V2BloodType>(initialBloodType ?? "A_POSITIVE");
  const [componentType, setComponentType] = useState<V2ComponentType>(initialComponentType ?? "PACKED_RED_BLOOD_CELLS");
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState("ROUTINE");
  const banks = [{id:"INST_MEDIATRIX",name:"Mediatrix"},{id:"INST_SYNTH_MEDIX",name:"Medix"},{id:"INST_SYNTH_NLVILLA",name:"N.L. Villa"}].filter(bank => bank.id !== principal.institutionId);
  const [source, setSource] = useState(supplierChoice ? "" : principal.accountId ? banks[0]?.id ?? "INST_MEDIATRIX" : "INST_MEDIATRIX");
  const sourceChosen = useRef(false);
  const [suppliers, setSuppliers] = useState<{ state: "loading" | "ready" | "failed"; rows: EligibleSupplier[] }>({ state: "loading", rows: [] });
  const [fields, setFields] = useState<RequesterFields>(EMPTY_REQUESTER_FIELDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requiresCorrection, setRequiresCorrection] = useState(false);
  const timeRejections = useRef(0);
  const attempt = useRef<{ keys: MutationKeys; payload: Record<string, unknown> & { componentType: V2ComponentType } } | undefined>(undefined);
  const status = useCommandStatus(onRefresh);
  const locked = busy || status.command !== undefined;
  const [supplierRetry, setSupplierRetry] = useState(0);
  useEffect(() => {
    if (!supplierChoice || !Number.isSafeInteger(quantity) || quantity < 1) return;
    let active = true;
    setSuppliers(current => ({ state: "loading", rows: current.rows }));
    const timer = setTimeout(() => {
      readEligibleSuppliers(bloodType, componentType, quantity).then(result => {
        if (!active) return;
        setSuppliers({ state: "ready", rows: result.suppliers });
        // Keep a still-eligible choice; otherwise preselect the first listed bank for the requester to confirm.
        setSource(current => sourceChosen.current && result.suppliers.some(row => row.institutionId === current) ? current : result.suppliers[0]?.institutionId ?? "");
      }).catch(() => { if (active) setSuppliers({ state: "failed", rows: [] }); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [supplierChoice, bloodType, componentType, quantity, supplierRetry]);
  const routingUnavailable = supplierChoice && (suppliers.state !== "ready" || !suppliers.rows.some(row => row.institutionId === source));

  function changed(action: () => void) {
    action();
    attempt.current = undefined;
    status.clear();
    setError("");
    setRequiresCorrection(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (locked || requiresCorrection || routingUnavailable) return;
    let extra: Record<string, unknown> = {};
    if (requesterPresentation && !attempt.current) {
      const mapped = requesterDetails(fields);
      if (!mapped.details) { setError(mapped.problem ?? "Check the request details."); return; }
      extra = { details: mapped.details };
      const selected = Object.entries(fields.files) as Array<[RequestDocumentKind, File]>;
      if (selected.length) {
        try { extra.documents = await Promise.all(selected.map(([kind, file]) => readDocumentFile(kind, file))); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "The document could not be read."); return; }
      }
    }
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
          ...extra,
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

  const submitButton = <ActionButton className="button primary compact" disabled={locked || requiresCorrection || routingUnavailable} unavailableReason={routingUnavailable?"Choose an available supplying blood bank before submitting.":requiresCorrection?"Correct the request details before submitting again.":busy?"The request is being submitted. Please wait.":"This request already has an accepted command. Review its status before starting another request."} title={routingUnavailable ? "No supplying blood bank is selected." : undefined}>{busy ? "Submitting…" : status.command ? "Command accepted" : requiresCorrection ? "Correct request before submitting" : error && attempt.current ? "Retry same request" : requesterPresentation ? "Submit request" : "Submit"}</ActionButton>;

  return <section className={requesterPresentation ? "requester-request-form" : "v2-operation-card"}>
    <header><div><h3>{requesterPresentation ? "Create Blood Request" : principal.accountId ? "Request blood" : "Request blood from Mediatrix"}</h3></div>{requesterPresentation ? <RequestFormHelp label="Create Blood Request">Enter the basic details of the requested blood supply.</RequestFormHelp> : <InformationHelp label="Request blood">Request a blood product for the authenticated institution using the supported command. The supplying bank and requested product remain subject to the recorded workflow; command acceptance is not approval or ledger commitment.</InformationHelp>}</header>
    <form className={requesterPresentation ? "requester-request-fields" : "v2-operation-form"} onSubmit={(event) => void submit(event)}>
      {supplierChoice ? <div className="requester-routing-field">
        <div className="requester-routing-label"><label htmlFor="requester-supplier-routing">Supplying blood bank</label><RequestFormHelp label="Supplying blood bank" id="requester-supplier-routing-help">Blood banks that currently show available stock for this product, most available first. Confirm or change the preselected bank. Availability is not approval: the chosen bank still reviews, approves or rejects the request.</RequestFormHelp></div>
        <RequestDropdown styled={true}><select id="requester-supplier-routing" aria-describedby="requester-supplier-routing-help" disabled={locked || suppliers.state !== "ready" || suppliers.rows.length === 0} value={source} onChange={event => changed(() => { sourceChosen.current = true; setSource(event.target.value); })}>
          {suppliers.rows.length === 0 && <option value="">{suppliers.state === "loading" ? "Loading available blood banks…" : suppliers.state === "failed" ? "Blood banks unavailable" : "No blood bank shows available stock"}</option>}
          {suppliers.rows.map(row => <option key={row.institutionId} value={row.institutionId}>{row.displayName} · {AVAILABILITY_BAND_LABEL[row.availabilityBand]}{row.meetsRequestedQuantity ? "" : " (less than requested)"}</option>)}
        </select></RequestDropdown>
        {suppliers.state === "failed" && <button className="button compact" type="button" onClick={() => setSupplierRetry(value => value + 1)}>Retry blood banks</button>}
      </div> : principal.accountId && <label>Source blood bank<RequestDropdown styled={true}><select disabled={locked} value={source} onChange={event => changed(() => setSource(event.target.value))}>{banks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></RequestDropdown></label>}
      <label>Blood type<RequestDropdown styled={true}><select aria-label="Blood type" disabled={locked} value={bloodType} onChange={(event) => changed(() => setBloodType(event.target.value as V2BloodType))}>{V2_BLOOD_TYPES.map((value) => <option key={value} value={value}>{formatBloodType(value)}</option>)}</select></RequestDropdown></label>
      <label>Component<RequestDropdown styled={true}><select disabled={locked} value={componentType} onChange={(event) => changed(() => setComponentType(event.target.value as V2ComponentType))}>{V2_COMPONENT_TYPES.map((value) => <option key={value} value={value}>{componentLabel(value)}</option>)}</select></RequestDropdown></label>
      <label>Quantity<input disabled={locked} type="number" min="1" value={quantity} onChange={(event) => changed(() => setQuantity(Number(event.target.value)))}/></label>
      <label>Urgency<RequestDropdown styled={true}><select disabled={locked} value={urgency} onChange={(event) => changed(() => setUrgency(event.target.value))}><option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option><option value="CRITICAL">Critical</option></select></RequestDropdown></label>
      {requesterPresentation && <RequesterRequestFields fields={fields} disabled={locked} onChange={next => changed(() => setFields(next))}/>}
      {requesterPresentation ? <div className="v2-submit requester-submit-footer">
        <small>Submitted for {principal.institutionDisplayName}. The selected blood bank reviews your request; an accepted command is queued, not yet approved.</small>
        <div className="requester-submit-actions">{onCancel && <button className="button compact" type="button" disabled={locked} onClick={onCancel}>Cancel</button>}{submitButton}</div>
        {error && <span role="alert">{error}</span>}
      </div> : <div className="v2-submit"><div className="requester-submit-actions">{onCancel&&<button className="button compact" type="button" disabled={locked} onClick={onCancel}>Cancel</button>}{submitButton}</div>{error && <span role="alert">{error}</span>}</div>}
    </form>
    {status.command && <CommandStatusCard command={status.command} pollError={status.pollError} onClear={status.clear}/>}
  </section>;
}

export function V2Operations({ principal, onRefresh, showRequest=true, onCancelRequest, initialBloodType, initialComponentType }: { principal: Principal; onRefresh: () => void;showRequest?:boolean;onCancelRequest?:()=>void;initialBloodType?:V2BloodType;initialComponentType?:V2ComponentType }) {
  const recipient = principal.accountId ? canAct(principal, "transfer:request") : principal.roleId === "ROLE-03";
  if (!recipient || !showRequest) return null;
  return <div className="v2-operations">
    <V2TransferRequest principal={principal} onRefresh={onRefresh} onCancel={onCancelRequest} initialBloodType={initialBloodType} initialComponentType={initialComponentType}/>
  </div>;
}
