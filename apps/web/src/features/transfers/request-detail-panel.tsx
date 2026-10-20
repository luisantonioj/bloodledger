import { useEffect, useState } from "react";
import { ApiRequestError } from "../../services/api/client";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";
import { formatManilaDateTime } from "../../components/ui/display";
import { DOCUMENT_KIND_LABEL, DOCUMENT_KINDS, deleteRequestDocument, readDocumentFile, readRequestDetails, requestDocumentPath, updateRequestDetails, uploadRequestDocuments, utcToManilaLocal, type RequestDetailView, type RequestDocumentKind } from "../../services/api/request-details";
import { EMPTY_REQUESTER_FIELDS, RequesterRequestFields, requesterDetails, type RequesterFields } from "./requester-request-fields";

// GAP-09 with PA-REQ-01..04: permitted request details and document references for the requesting institution
// and the chosen supplying bank. Only the requester edits, and only before the supplier decides.
function fieldsFrom(view: RequestDetailView): RequesterFields {
  return { ...EMPTY_REQUESTER_FIELDS, requestingPerson: view.requestingPerson, staffId: view.staffId ?? "", attendingPhysician: view.attendingPhysician ?? "", requiredLocal: utcToManilaLocal(view.requiredAt), pickupRepresentative: view.pickupRepresentative ?? "", pickupAuthorizationReference: view.pickupAuthorizationReference ?? "", notes: view.notes ?? "" };
}
const show = (value: string | null) => value ?? "Not provided";

export function RequestDetailPanel({ transferId }: { transferId: string }) {
  const [view, setView] = useState<RequestDetailView>();
  const [state, setState] = useState<"loading" | "ready" | "none" | "failed">("loading");
  const [editing, setEditing] = useState<RequesterFields>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  // A failed write keeps its keys so "Try again" is a retry of the same command, not a second one.
  const [pending, setPending] = useState<{ action: string; keys: MutationKeys }>();
  useEffect(() => {
    let active = true;
    setState("loading");
    readRequestDetails(transferId).then(result => { if (active) { setView(result); setState("ready"); } })
      .catch(reason => { if (active) setState(reason instanceof ApiRequestError && reason.status === 404 ? "none" : "failed"); });
    return () => { active = false; };
  }, [transferId, retry]);

  async function write(action: string, run: (keys: MutationKeys) => Promise<RequestDetailView>) {
    const keys = pending?.action === action ? pending.keys : newMutationKeys();
    setPending({ action, keys }); setBusy(true); setError("");
    try { setView(await run(keys)); setPending(undefined); return true; }
    catch (reason) {
      if (reason instanceof ApiRequestError && reason.code === "STALE_STATE") { setPending(undefined); setRetry(value => value + 1); }
      if (reason instanceof ApiRequestError && reason.status === 400) setPending(undefined);
      setError(reason instanceof Error ? reason.message : "The change was not saved.");
      return false;
    } finally { setBusy(false); }
  }
  async function save() {
    if (!view || !editing) return;
    const mapped = requesterDetails(editing);
    if (!mapped.details) { setError(mapped.problem ?? "Check the request details."); return; }
    const details = mapped.details;
    if (await write(`details:${view.version}:${JSON.stringify(details)}`, keys => updateRequestDetails(view.transferId, view.version, details, keys))) setEditing(undefined);
  }
  async function attach(kind: RequestDocumentKind, file: File | undefined) {
    if (!view || !file) return;
    try { const upload = await readDocumentFile(kind, file); await write(`upload:${upload.contentSha256}:${kind}`, keys => uploadRequestDocuments(view.transferId, [upload], keys)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The document could not be read."); }
  }

  if (state === "loading") return <section className="request-detail-panel" aria-label="Requester details"><p role="status">Loading request details…</p></section>;
  if (state === "none") return <section className="request-detail-panel" aria-label="Requester details"><h3>Requester details</h3><p>No requester details were recorded with this request.</p></section>;
  if (state === "failed" || !view) return <section className="request-detail-panel" aria-label="Requester details"><div role="alert"><p>Request details are unavailable.</p><button className="button compact" onClick={() => setRetry(value => value + 1)}>Retry details</button></div></section>;
  const canEdit = view.editable && view.viewerRole === "REQUESTER";
  return <section className="request-detail-panel" aria-labelledby="request-detail-heading">
    <header><h3 id="request-detail-heading">Requester details</h3><span className="requester-placeholder-tag">Version {view.version}</span></header>
    {editing ? <>
      <RequesterRequestFields fields={editing} disabled={busy} onChange={next => { setEditing({ ...next, files: {} }); setError(""); }} hideDocuments/>
      <div className="requester-submit-actions"><button className="button compact" type="button" disabled={busy} onClick={() => { setEditing(undefined); setError(""); }}>Cancel</button><button className="button primary compact" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save details"}</button></div>
    </> : <dl>
      <dt>Requesting person</dt><dd>{view.requestingPerson}</dd>
      <dt>Staff ID</dt><dd>{show(view.staffId)}</dd>
      <dt>Attending physician</dt><dd>{show(view.attendingPhysician)}</dd>
      <dt>Required</dt><dd>{formatManilaDateTime(view.requiredAt)}</dd>
      <dt>Patient / case reference</dt><dd>Not collected (RQ-20)</dd>
      <dt>Pickup representative</dt><dd>{show(view.pickupRepresentative)}</dd>
      <dt>Authorization reference</dt><dd>{show(view.pickupAuthorizationReference)} <small>(stated, not verified)</small></dd>
      <dt>Notes</dt><dd className="request-detail-notes">{show(view.notes)}</dd>
    </dl>}
    {canEdit && !editing && <button className="button compact" type="button" disabled={busy} onClick={() => setEditing(fieldsFrom(view))}>Edit details</button>}
    <h4>Supporting documents</h4>
    {view.documents.length === 0 ? <p>No documents attached.</p> : <ul className="request-detail-documents">{view.documents.map(document => <li key={document.documentId}>
      <a href={requestDocumentPath(view.transferId, document.documentId)} download={document.displayName}>{document.displayName}</a> <small>{DOCUMENT_KIND_LABEL[document.kind]} · {(document.sizeBytes / 1024).toFixed(0)} KB</small>
      {canEdit && <button className="button compact" type="button" disabled={busy} onClick={() => void write(`delete:${document.documentId}`, keys => deleteRequestDocument(view.transferId, document.documentId, keys))}>Remove {document.displayName}</button>}
    </li>)}</ul>}
    {canEdit && view.documents.length < 3 && <div className="request-detail-attach">{DOCUMENT_KINDS.map(kind => <label key={kind} className="button compact">Add {DOCUMENT_KIND_LABEL[kind]}<input className="sr-only" type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" disabled={busy} onChange={event => { void attach(kind, event.target.files?.[0]); event.target.value = ""; }}/></label>)}</div>}
    {!view.editable && view.viewerRole === "REQUESTER" && <p>Details are locked because the supplying blood bank has decided on this request.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
