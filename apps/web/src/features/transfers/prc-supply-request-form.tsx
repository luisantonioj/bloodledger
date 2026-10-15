import { useState } from "react";
import { ActionButton } from "../../components/ui/action-button";
import { InformationHelp } from "../../components/ui/information-help";
import { formatBloodType } from "../../components/ui/display";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "../../services/api/v2";
import { URGENCIES } from "../../services/api/transaction-reads";
import { prcRequiredBy } from "../../services/api/prc-supply";
import { componentLabel } from "./requester-transfer-data";

export interface PrcSupplyDraft {bloodType: string; componentType: string; requestedQuantity: number; urgency: string; requiredBy: string}
export const manilaLocalTime = (time: number) => new Date(time + 8 * 3600000).toISOString().slice(0, 16);
export function PrcSupplyRequestForm({onClose, onSubmit, enabled = false, busy = false}: {onClose: () => void; onSubmit?: (draft: PrcSupplyDraft) => void; enabled?: boolean; busy?: boolean}) {
  const [bloodType, setBloodType] = useState("O_POSITIVE"), [componentType, setComponentType] = useState("WHOLE_BLOOD");
  const [quantity, setQuantity] = useState("1"), [urgency, setUrgency] = useState("ROUTINE");
  const [required, setRequired] = useState(() => manilaLocalTime(Date.now() + 2 * 3600000)), [error, setError] = useState("");
  return <section className="bank-prc-form" aria-label="New PRC Supply Request">
    <header className="bank-section-heading"><h3>New PRC Supply Request</h3><InformationHelp label="PRC supply request">One product per request, 1–10 units, required 1 hour to 30 days ahead. Required By uses Asia/Manila and cannot be edited after submission; cancel and resubmit instead. Free-text notes are not collected in V1 to avoid patient or donor details. A ROLE-02 operator and PIN are required. This is off-chain coordination; supplied units enter only through ordinary OCR intake.</InformationHelp></header>
    <form onSubmit={event => {event.preventDefault(); if (!enabled || busy || !onSubmit) return; try {const requestedQuantity = Number(quantity); if (!Number.isSafeInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > 10) throw Error("Choose 1–10 units."); const requiredBy = prcRequiredBy(required); setError(""); onSubmit({bloodType, componentType, requestedQuantity, urgency, requiredBy});} catch (reason) {setError(reason instanceof Error ? reason.message : "Check the request fields.");}}}>
      <fieldset disabled={!enabled || busy}><div className="bank-prc-fields">
        <label>Blood Type<span className="requester-select"><select aria-label="Blood Type" value={bloodType} onChange={event => setBloodType(event.target.value)}>{V2_BLOOD_TYPES.map(value => <option key={value} value={value}>{formatBloodType(value)}</option>)}</select></span></label>
        <label>Component<span className="requester-select"><select aria-label="Component" value={componentType} onChange={event => setComponentType(event.target.value)}>{V2_COMPONENT_TYPES.map(value => <option key={value} value={value}>{componentLabel(value)}</option>)}</select></span></label>
        <label>Units Needed<input type="number" min="1" max="10" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} required/></label>
        <label>Priority<span className="requester-select"><select aria-label="Priority" value={urgency} onChange={event => setUrgency(event.target.value)}>{URGENCIES.map(value => <option key={value} value={value}>{value}</option>)}</select></span></label>
        <label className="bank-prc-required-time">Required By (Asia/Manila)<input type="datetime-local" value={required} onChange={event => setRequired(event.target.value)} required/></label>
      </div><div className="bank-prc-authorization"><strong>Operator authorization</strong><p>A ROLE-02 operator and PIN verification are required. Free-text notes are not collected in V1.</p></div></fieldset>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" className="button compact" disabled={busy} onClick={onClose}>Close form</button><ActionButton type="submit" className="button primary compact" disabled={!enabled || busy} unavailableReason={busy ? "Finish the current attempt before changing the request." : "The PRC service and an authorized ROLE-02 operator must be available before submission."}>Send to PRC</ActionButton></footer>
    </form>
  </section>;
}
