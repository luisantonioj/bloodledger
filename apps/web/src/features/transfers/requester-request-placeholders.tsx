import { RequestFormHelp } from "./request-form-help";

// Visual reference only: disabled fields have no state, names, uploads, or request payload mapping.
export function RequesterRequestPlaceholders() {
  return <div className="requester-request-placeholders">
    <section className="requester-form-section" aria-labelledby="requester-clinical-heading">
      <header><h4 id="requester-clinical-heading">Requester &amp; clinical details</h4><RequestFormHelp label="Requester and clinical details" id="requester-clinical-pending">Identifies the requester and the request’s clinical authorization. These fields will be available when request-detail support is added. They are not saved or submitted yet.</RequestFormHelp></header>
      <fieldset disabled aria-describedby="requester-clinical-pending"><legend className="sr-only">Requester and clinical details placeholders</legend><div className="requester-placeholder-fields">
        <label>Requesting Person<input placeholder="Full name"/></label>
        <label>Employee / Staff ID<input placeholder="Employee or staff reference"/></label>
        <label>Attending Physician<input placeholder="Physician’s full name"/></label>
        <label>Patient / Case Reference<input placeholder="Case reference"/></label>
        <label>Required Date &amp; Time<input type="datetime-local"/></label>
      </div></fieldset>
    </section>
    <section className="requester-form-section" aria-labelledby="requester-pickup-heading">
      <header><h4 id="requester-pickup-heading">Authorized pickup</h4><RequestFormHelp label="Authorized pickup" id="requester-pickup-pending">The representative authorized to collect the requested units. Pickup details are not saved or submitted yet.</RequestFormHelp></header>
      <fieldset disabled aria-describedby="requester-pickup-pending"><legend className="sr-only">Authorized pickup placeholders</legend><div className="requester-placeholder-fields two">
        <label>Pickup Representative<input placeholder="Representative’s full name"/></label>
        <label>ID / Authorization Reference<input placeholder="ID or authorization reference"/></label>
      </div></fieldset>
    </section>
    <section className="requester-form-section" aria-labelledby="requester-documents-heading">
      <header><h4 id="requester-documents-heading">Supporting documents</h4><RequestFormHelp label="Supporting documents">Request form and pickup authorization attachments. Document uploads are not available yet. No files can be attached or stored.</RequestFormHelp></header>
      <div className="requester-document-placeholders">
        <div><span><strong>Standard Blood Request Form</strong><small>Signed request form · PDF, JPG or PNG</small></span><button className="button compact" type="button" disabled>Attach request form</button></div>
        <div><span><strong>Pickup Authorization / Valid ID</strong><small>Authorization or ID copy · PDF, JPG or PNG</small></span><button className="button compact" type="button" disabled>Attach pickup document</button></div>
      </div>
    </section>
    <section className="requester-form-section" aria-labelledby="requester-notes-heading">
      <header><h4 id="requester-notes-heading">Notes</h4><RequestFormHelp label="Notes">Additional request information. Notes are not saved or submitted yet.</RequestFormHelp></header>
      <label className="requester-placeholder-notes">Request notes<textarea disabled placeholder="Additional notes will be available when supported."/></label>
    </section>
    <section className="requester-form-section requester-authorization-section" aria-labelledby="requester-authorization-heading">
      <header><h4 id="requester-authorization-heading">Operator authorization required</h4><RequestFormHelp label="Operator authorization">For institution accounts, selecting Submit request opens the existing operator and PIN verification dialog. Authorization is checked before the request is sent.</RequestFormHelp></header>
    </section>
  </div>;
}
