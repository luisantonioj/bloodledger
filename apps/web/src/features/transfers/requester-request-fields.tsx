import { useRef } from "react";
import { RequestFormHelp } from "./request-form-help";
import { AUTHORIZATION_PATTERN, DOCUMENT_ACCEPT, DOCUMENT_KIND_LABEL, DOCUMENT_KINDS, STAFF_ID_PATTERN, manilaLocalToUtc, type RequestDetailInput, type RequestDocumentKind } from "../../services/api/request-details";

// PA-REQ-01..04 (Accepted 2026-10-20; SYNTHETIC_REQUEST_DETAIL_V1). Synthetic values only; the patient/case
// reference stays unavailable until RQ-20 is decided.
export interface RequesterFields {
  requestingPerson: string;
  staffId: string;
  attendingPhysician: string;
  requiredLocal: string;
  pickupRepresentative: string;
  pickupAuthorizationReference: string;
  notes: string;
  files: Partial<Record<RequestDocumentKind, File>>;
}
export const EMPTY_REQUESTER_FIELDS: RequesterFields = { requestingPerson: "", staffId: "", attendingPhysician: "", requiredLocal: "", pickupRepresentative: "", pickupAuthorizationReference: "", notes: "", files: {} };

const optional = (value: string) => value.trim() ? value.trim() : null;
/** Maps form text to the accepted contract; returns the first problem for the user instead of guessing. */
export function requesterDetails(fields: RequesterFields, now = Date.now()): { details?: RequestDetailInput; problem?: string } {
  const requiredAt = manilaLocalToUtc(fields.requiredLocal);
  if (fields.requestingPerson.trim().length < 2) return { problem: "Enter the requesting person (2–80 characters)." };
  if (!requiredAt) return { problem: "Enter the required date and time." };
  if (Date.parse(requiredAt) <= now) return { problem: "The required date and time must be in the future." };
  if (fields.staffId.trim() && !new RegExp(`^${STAFF_ID_PATTERN}$`).test(fields.staffId.trim())) return { problem: "Staff ID must use the synthetic format SYN-STAFF-0000." };
  if (fields.pickupAuthorizationReference.trim() && !new RegExp(`^${AUTHORIZATION_PATTERN}$`).test(fields.pickupAuthorizationReference.trim())) return { problem: "Authorization reference must use the synthetic format SYN-AUTH-XXXXXX." };
  return { details: { requestingPerson: fields.requestingPerson.trim(), staffId: optional(fields.staffId), attendingPhysician: optional(fields.attendingPhysician), requiredAt, pickupRepresentative: optional(fields.pickupRepresentative), pickupAuthorizationReference: optional(fields.pickupAuthorizationReference), notes: optional(fields.notes) } };
}

export function RequesterRequestFields({ fields, disabled, onChange, hideDocuments = false }: { fields: RequesterFields; disabled: boolean; onChange: (next: RequesterFields) => void; hideDocuments?: boolean }) {
  const inputs = useRef<Partial<Record<RequestDocumentKind, HTMLInputElement | null>>>({});
  const set = (key: Exclude<keyof RequesterFields, "files">) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...fields, [key]: event.target.value });
  const setFile = (kind: RequestDocumentKind, file: File | undefined) => {
    const files = { ...fields.files };
    if (file) files[kind] = file; else delete files[kind];
    if (!file && inputs.current[kind]) inputs.current[kind]!.value = "";
    onChange({ ...fields, files });
  };
  return <div className="requester-request-placeholders">
    <section className="requester-form-section" aria-labelledby="requester-clinical-heading">
      <header><h4 id="requester-clinical-heading">Requester &amp; clinical details</h4><RequestFormHelp label="Requester and clinical details" id="requester-clinical-help">Identifies the requester for the supplying blood bank. Use synthetic values only. Patient / Case Reference stays unavailable until decision RQ-20 defines whether it may be collected.</RequestFormHelp></header>
      <fieldset disabled={disabled} aria-describedby="requester-clinical-help"><legend className="sr-only">Requester and clinical details</legend><div className="requester-placeholder-fields">
        <label>Requesting Person<input required minLength={2} maxLength={80} placeholder="Full name" value={fields.requestingPerson} onChange={set("requestingPerson")}/></label>
        <label>Employee / Staff ID<input maxLength={14} pattern={STAFF_ID_PATTERN} placeholder="SYN-STAFF-0000" value={fields.staffId} onChange={set("staffId")}/></label>
        <label>Attending Physician<input minLength={2} maxLength={80} placeholder="Physician’s full name" value={fields.attendingPhysician} onChange={set("attendingPhysician")}/></label>
        <div><label>Patient / Case Reference<input disabled placeholder="Unavailable: RQ-20" aria-describedby="requester-case-reference-pending"/></label><small id="requester-case-reference-pending" className="requester-placeholder-note">Not collected until RQ-20 is decided.</small></div>
        <label>Required Date &amp; Time<input required type="datetime-local" value={fields.requiredLocal} onChange={set("requiredLocal")}/></label>
      </div></fieldset>
    </section>
    <section className="requester-form-section" aria-labelledby="requester-pickup-heading">
      <header><h4 id="requester-pickup-heading">Authorized pickup</h4><RequestFormHelp label="Authorized pickup" id="requester-pickup-help">The representative expected to collect the units and a synthetic authorization reference. This is a stated reference only; BloodLedger does not verify pickup identity.</RequestFormHelp></header>
      <fieldset disabled={disabled} aria-describedby="requester-pickup-help"><legend className="sr-only">Authorized pickup</legend><div className="requester-placeholder-fields two">
        <label>Pickup Representative<input minLength={2} maxLength={80} placeholder="Representative’s full name" value={fields.pickupRepresentative} onChange={set("pickupRepresentative")}/></label>
        <label>ID / Authorization Reference<input maxLength={15} pattern={AUTHORIZATION_PATTERN} placeholder="SYN-AUTH-XXXXXX" value={fields.pickupAuthorizationReference} onChange={set("pickupAuthorizationReference")}/></label>
      </div></fieldset>
    </section>
    {!hideDocuments && <section className="requester-form-section" aria-labelledby="requester-documents-heading">
      <header><h4 id="requester-documents-heading">Supporting documents</h4><RequestFormHelp label="Supporting documents">PDF, PNG or JPEG, up to 5 MB each. Files upload with the request and are visible only to your institution and the supplying blood bank. Attach synthetic documents only.</RequestFormHelp></header>
      <div className="requester-document-placeholders">
        {DOCUMENT_KINDS.map(kind => { const file = fields.files[kind]; const id = `requester-document-${kind.toLowerCase()}`; return <div key={kind}>
          <span><strong>{DOCUMENT_KIND_LABEL[kind]}</strong><small>{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : kind === "REQUEST_FORM" ? "Signed request form · PDF, JPG or PNG" : "Authorization or ID copy · PDF, JPG or PNG"}</small></span>
          <input ref={element => { inputs.current[kind] = element; }} id={id} className="sr-only" type="file" accept={DOCUMENT_ACCEPT} disabled={disabled} aria-label={`${DOCUMENT_KIND_LABEL[kind]} file`} onChange={event => setFile(kind, event.target.files?.[0])}/>
          {file ? <button className="button compact" type="button" disabled={disabled} onClick={() => setFile(kind, undefined)}>Remove</button>
            : <button className="button compact" type="button" disabled={disabled} onClick={() => inputs.current[kind]?.click()}>{kind === "REQUEST_FORM" ? "Attach request form" : "Attach pickup document"}</button>}
        </div>; })}
      </div>
    </section>}
    <section className="requester-form-section" aria-labelledby="requester-notes-heading">
      <header><h4 id="requester-notes-heading">Notes</h4><RequestFormHelp label="Notes">Additional plain-text information for the supplying blood bank, up to 500 characters.</RequestFormHelp></header>
      <label className="requester-placeholder-notes">Request notes<textarea aria-label="Request notes" disabled={disabled} maxLength={500} placeholder="Additional notes" value={fields.notes} onChange={set("notes")}/></label>
    </section>
    {!hideDocuments && <section className="requester-form-section requester-authorization-section" aria-labelledby="requester-authorization-heading">
      <header><h4 id="requester-authorization-heading">Operator authorization required</h4><RequestFormHelp label="Operator authorization">For institution accounts, selecting Submit request opens the existing operator and PIN verification dialog. Authorization is checked before the request is sent.</RequestFormHelp></header>
    </section>}
  </div>;
}
