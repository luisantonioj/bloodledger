import { InformationHelp } from "../../components/ui/information-help";
import { formatBloodType } from "../../components/ui/display";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "../../services/api/v2";
import { componentLabel } from "./requester-transfer-data";

export function PrcSupplyRequestForm({onClose}: {onClose: () => void}) {
  return <section className="bank-prc-form" aria-label="New PRC Supply Request">
    <header className="bank-section-heading"><h3>New PRC Supply Request</h3><InformationHelp label="PRC supply request">Request replenishment through the PRC coordination channel, separately from facility transfers. Submission and operator authorization will be enabled when the PRC supply service is connected.</InformationHelp></header>
    <form onSubmit={event => event.preventDefault()}>
      <p className="bank-action-note">PRC supply submission is not available yet. These fields show the planned request requirements.</p>
      <fieldset disabled><div className="bank-prc-fields">
        <label>Blood Type<span className="requester-select"><select defaultValue="O_POSITIVE">{V2_BLOOD_TYPES.map(value => <option key={value} value={value}>{formatBloodType(value)}</option>)}</select></span></label>
        <label>Component<span className="requester-select"><select>{V2_COMPONENT_TYPES.map(value => <option key={value} value={value}>{componentLabel(value)}</option>)}</select></span></label>
        <label>Units Needed<input type="number" min="1" placeholder="Units"/></label>
        <label>Priority<span className="requester-select"><select><option>Routine</option><option>Urgent</option><option>Emergency</option></select></span></label>
        <label>Required Date &amp; Time<input type="datetime-local"/></label>
        <label className="bank-prc-note">Coordination Note<textarea placeholder="Handling, pickup or urgency details"/></label>
      </div><div className="bank-prc-authorization"><strong>Operator authorization</strong><p>Authorized operator verification will be required before submission.</p></div></fieldset>
      <footer><button type="button" className="button compact" onClick={onClose}>Cancel</button><button type="submit" className="button primary compact" disabled>Send to PRC Lipa</button></footer>
    </form>
  </section>;
}
