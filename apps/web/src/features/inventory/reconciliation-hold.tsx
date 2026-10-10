import { useState } from "react";
import { canAct, type Principal } from "../../auth/permissions";
import { submitV2Reconciliation, type V2Component } from "../../services/api/v2";
import { CommandStatusCard } from "../commands/command-status-card";
import { ReasonSelector } from "../commands/reason-selector";
import { useUatCommand } from "../commands/use-uat-command";

export function ReconciliationHold({ component, principal, onRefresh }: { component?: V2Component; principal: Principal; onRefresh: () => void }) {
  const command = useUatCommand(onRefresh);
  const [opened, setOpened] = useState(false), [reason, setReason] = useState(""), [confirmed, setConfirmed] = useState(false);
  const eligible = component?.institutionId === principal.institutionId && ["AVAILABLE", "RESERVED"].includes(component.inventoryStatus) && canAct(principal, "inventory:reconcile");
  async function submit() {
    if (!component || (!command.ambiguous && (!eligible || !reason || !confirmed))) return;
    await command.submit(keys => {
      const caseId = "RECON_" + keys.correlationId.slice(5);
      return { resourceType: "RECONCILIATION", resourceId: caseId, payload: { caseId, componentId: component.componentId, correlationId: keys.correlationId, reasonCode: reason } };
    }, (payload, keys) => submitV2Reconciliation(payload, keys, "V2.1"));
  }
  return <section className="v2-operation-card" aria-label="Reconciliation hold">
    {eligible && !opened && <button className="button" onClick={() => setOpened(true)}>Place reconciliation hold</button>}
    {component?.inventoryStatus === "RECONCILIATION_HOLD" && <p>This unit is on reconciliation hold pending manual review.</p>}
    {opened && <form onSubmit={event => {event.preventDefault(); void submit();}}><h3>Place reconciliation hold</h3><p>This places a hold for manual review. Release is unavailable in this application.</p>
      <ReasonSelector kind="reconciliation" value={reason} onChange={value => {setReason(value); setConfirmed(false); command.correct();}} disabled={command.locked}/>
      <label><input type="checkbox" checked={confirmed} disabled={command.locked} onChange={event => {setConfirmed(event.target.checked);}}/>I confirm placing this component on reconciliation hold.</label>
      <button className="button danger" disabled={command.busy || !!command.command || command.requiresCorrection || (!command.ambiguous && (!eligible || !reason || !confirmed))}>{command.busy ? "Submitting hold…" : command.ambiguous ? "Retry same hold command" : "Confirm reconciliation hold"}</button>
    </form>}
    {command.error && <p role="alert">{command.error}</p>}
    {command.ambiguous && <div><p>Saved request key: <code>{command.pendingKey}</code></p><button className="button" disabled={command.busy} onClick={() => void command.recover()}>Recover this attempt without resubmitting</button></div>}
    {command.requiresCorrection && <button className="button" onClick={() => {command.correct(); onRefresh();}}>Refresh component before continuing</button>}
    {command.command && <CommandStatusCard command={command.command} pollError={command.pollError} onClear={() => {command.clear(); setOpened(false); onRefresh();}}/>}
  </section>;
}
