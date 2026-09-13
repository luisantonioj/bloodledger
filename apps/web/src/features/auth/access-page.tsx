import { useState, type FormEvent } from "react";
import type { Principal } from "../../auth/permissions";
import { requestJson } from "../../services/api/client";

type AccessMode = "signin" | "apply";
type ApplicationType = "blood-bank" | "requestor" | undefined;

const applicationSteps = ["Facility", "Qualification", "Primary account", "Documents"];

function PreviewNotice() {
  return <div className="preview-notice" role="note">
    <span aria-hidden="true">i</span>
    <p><strong>Frontend preview only</strong>This form does not submit, upload, reserve an account, or create an institutional application. Use synthetic information only.</p>
  </div>;
}

function ApplicationFields({ step, applicationType }: { step: number; applicationType: Exclude<ApplicationType, undefined> }) {
  if (step === 1) return <section className="application-section">
    <header><h3>Facility information</h3><p>Legal and operational details represented in the approved mockup.</p></header>
    <div className="application-fields">
      <label>Facility name<input placeholder="Synthetic Facility Alpha" /></label>
      <label>Registered legal name<input placeholder="Synthetic Facility Alpha, Inc." /></label>
      <label>Ownership<select defaultValue="Private"><option>Private</option><option>Government</option></select></label>
      <label>Facility classification<select defaultValue="Level 2 Hospital"><option>Level 1 Hospital</option><option>Level 2 Hospital</option><option>Level 3 Hospital</option><option>Other licensed health facility</option></select></label>
      <label className="wide">Complete address<input placeholder="Synthetic address only" /></label>
      <label>City or municipality<input defaultValue="Lipa City" /></label>
      <label>Province<input defaultValue="Batangas" /></label>
      <label>Official phone<input placeholder="Synthetic contact number" /></label>
      <label>Official facility email<input type="email" placeholder="facility@example.invalid" /></label>
      <label>Facility LTO reference<input placeholder="SYNTH-LTO-0000" /></label>
      <label>LTO expiration<input type="date" /></label>
    </div>
  </section>;

  if (step === 2) return <section className="application-section">
    <header><h3>{applicationType === "blood-bank" ? "Blood Service Facility qualification" : "Requestor receiving capability"}</h3><p>Qualification fields are visual placeholders and are not verified against any licensing source.</p></header>
    <div className="application-fields">
      {applicationType === "blood-bank" && <label>BSF category<select defaultValue="Blood Bank"><option>Blood Bank</option><option>Blood Bank with additional functions</option><option>Blood Center</option></select></label>}
      <label>License or authority reference<input placeholder="SYNTH-AUTH-0000" /></label>
      <label>License expiration<input type="date" /></label>
      {applicationType === "blood-bank" && <label>Head of blood service facility<input placeholder="Synthetic role holder" /></label>}
      <label>Medical technologist-in-charge<input placeholder="Synthetic role holder" /></label>
      <label>Professional license reference<input placeholder="SYNTH-LICENSE-0000" /></label>
      {applicationType === "requestor" && <label className="wide">Referral or supplying facility<input placeholder="Synthetic supplying facility" /></label>}
    </div>
    <div className="qualification-checklist">
      <strong>Applicant capability declaration preview</strong>
      <label><input type="checkbox" /><span>Required blood handling and transfusion procedures are documented.</span></label>
      <label><input type="checkbox" /><span>Personnel, equipment, continuity, and contingency procedures are available.</span></label>
      <label><input type="checkbox" /><span>The facility agrees to future verification under an approved workflow.</span></label>
    </div>
  </section>;

  if (step === 3) return <section className="application-section">
    <header><h3>Authorized primary account</h3><p>This layout previews the proposed initial institutional contact.</p></header>
    <div className="application-fields">
      <label>Full name<input placeholder="Synthetic applicant" /></label>
      <label>Official position<input placeholder="Blood bank administrator" /></label>
      <label>Employee reference<input placeholder="SYNTH-EMP-0000" /></label>
      <label>Institutional email<input type="email" placeholder="applicant@example.invalid" /></label>
      <label>Password<input type="password" placeholder="Not stored in preview" /></label>
      <label>Confirm password<input type="password" placeholder="Not stored in preview" /></label>
    </div>
  </section>;

  return <section className="application-section">
    <header><h3>Documents and declaration</h3><p>Document intake is deliberately unavailable until storage, retention, review, and privacy controls exist.</p></header>
    <div className="document-preview-grid">
      {["Facility license", applicationType === "blood-bank" ? "Blood Service Facility license" : "Blood Station authorization", "Assessment and supporting evidence"].map(label =>
        <div key={label}><span aria-hidden="true">↥</span><strong>{label}</strong><small>Upload unavailable</small><button type="button" disabled>Select document</button></div>)}
    </div>
    <label className="declaration-preview"><input type="checkbox" /><span>I understand this is a non-submitting visual preview using synthetic information.</span></label>
  </section>;
}

function AccessApplication() {
  const [applicationType, setApplicationType] = useState<ApplicationType>();
  const [step, setStep] = useState(1);
  const [complete, setComplete] = useState(false);

  if (complete) return <div className="application-complete">
    <span className="application-complete-mark" aria-hidden="true">✓</span>
    <p className="eyebrow">Preview complete</p>
    <h2>No application was submitted.</h2>
    <p>The visual flow is present for review. Account creation, institutional verification, document handling, and notifications remain unimplemented.</p>
    <button className="button primary" type="button" onClick={() => { setComplete(false); setApplicationType(undefined); setStep(1); }}>Review another application type</button>
  </div>;

  if (!applicationType) return <div className="application-choice">
    <div className="auth-card-heading"><p className="eyebrow">Institution application</p><h2>How will your facility participate?</h2><p>Choose an application layout. This preview does not establish an institution or account.</p></div>
    <div className="application-type-grid">
      <button type="button" onClick={() => setApplicationType("blood-bank")}><span className="application-type-icon">▣</span><strong>Apply as a Blood Bank</strong><p>For a facility represented as supplying, storing, processing, issuing, or redistributing blood.</p><ul><li>Facility and blood-service qualification</li><li>Responsible professional roles</li><li>Assessment-document placeholders</li></ul><b>Start Blood Bank Application →</b></button>
      <button type="button" onClick={() => setApplicationType("requestor")}><span className="application-type-icon requestor">◇</span><strong>Apply as a Requestor</strong><p>For a licensed facility represented as requesting, receiving, storing, and transfusing blood.</p><ul><li>Facility authority information</li><li>Receiving capability declaration</li><li>Authorization-document placeholders</li></ul><b>Start Requestor Application →</b></button>
    </div>
    <PreviewNotice />
  </div>;

  return <form className="application-form" onSubmit={event => { event.preventDefault(); setComplete(true); }}>
    <header className="application-header">
      <button type="button" className="text-button" onClick={() => { setApplicationType(undefined); setStep(1); }}>← Change application</button>
      <p className="eyebrow">{applicationType === "blood-bank" ? "Blood Bank application" : "Requestor application"}</p>
      <h2>Institution qualification</h2><p>Step {step} of 4 · {applicationSteps[step - 1]}</p>
    </header>
    <div className="application-steps" aria-label="Application progress">{applicationSteps.map((label, index) => <div className={step >= index + 1 ? "active" : ""} key={label}><span>{index + 1}</span><b>{label}</b></div>)}</div>
    <PreviewNotice />
    <ApplicationFields step={step} applicationType={applicationType} />
    <footer className="application-footer">
      {step > 1 ? <button className="button" type="button" onClick={() => setStep(value => value - 1)}>Previous</button> : <span />}
      {step < 4 ? <button className="button primary" type="button" onClick={() => setStep(value => value + 1)}>Continue</button> : <button className="button primary" type="submit">Complete visual preview</button>}
    </footer>
  </form>;
}

export function AccessPage({ onAuthenticated }: { onAuthenticated: (principal: Principal) => void }) {
  const [mode, setMode] = useState<AccessMode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await requestJson<{ principal: Principal }>("/api/v1/auth/session", {
        method: "POST", body: JSON.stringify({ username, password }),
      }, "Authentication unavailable.");
      onAuthenticated(result.principal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className={`auth-page ${mode === "apply" ? "application-mode" : ""}`}>
    <aside className="auth-hero" aria-label="BloodLedger prototype context">
      <div className="auth-hero-brand"><span className="mark auth-mark">BL</span><span><strong>Blood<em>ledger</em></strong><small>Controlled research prototype</small></span></div>
      <div className="auth-hero-message"><p className="eyebrow">Accountable inventory evidence</p><h1>One ledger.<br/>Clear custody.<br/><em>Every unit accounted for.</em></h1><p>Authenticated inventory and custody workflows with explicit institution scope, freshness, and simulation-only evidence.</p></div>
      <div className="auth-hero-signature"><span aria-hidden="true">◆</span><span>Fabric-backed evidence</span><span aria-hidden="true">·</span><span>Synthetic data only</span></div>
    </aside>
    <section className="auth-pane">
      <div className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "apply"} className={mode === "apply" ? "active" : ""} onClick={() => setMode("apply")}>Apply for access</button>
        </div>
        {mode === "apply" ? <AccessApplication /> : <>
          <div className="auth-card-heading"><p className="eyebrow">Welcome back</p><h2>Sign in to BloodLedger</h2><p>Use the opaque username assigned to your approved synthetic account.</p></div>
          <form className="auth-form" onSubmit={event => void submit(event)}>
            <label htmlFor="login-username">Username<input id="login-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="synth_account_name" required/></label>
            <label htmlFor="login-password">Password<input id="login-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" required/></label>
            <div className="auth-form-options"><label><input type="checkbox" />Keep me signed in on this trusted device</label><button type="button" disabled title="Password recovery is not implemented">Forgot password?</button></div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button primary auth-submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>
          </form>
          <div className="auth-scope-note"><strong>Server-assigned access</strong><span>Your role and institution scope cannot be selected or changed from this screen.</span></div>
        </>}
      </div>
      <footer className="auth-footer">Permissioned access for authorized synthetic participants only.</footer>
    </section>
  </main>;
}
