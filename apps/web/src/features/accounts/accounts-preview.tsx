import { useState } from "react";
import type { Principal } from "../../auth/permissions";

const tabs = ["Overview", "Applications", "Institutions", "User accounts", "Activity"] as const;
type Tab = typeof tabs[number];

const previewApplications = [
  { reference: "APP-SYNTH-0001", institution: "Synthetic Blood Bank Alpha", type: "Blood Bank", status: "Pending review" },
  { reference: "APP-SYNTH-0002", institution: "Synthetic Requestor Beta", type: "Requestor", status: "Needs verification" },
];

function DisabledAction({ children }: { children: string }) {
  return <button className="button compact" type="button" disabled title="Frontend preview only">{children}</button>;
}

function Overview() {
  return <><div className="account-summary">
    <article><span>Applications</span><strong>2</strong><small>Synthetic preview rows</small></article>
    <article><span>Active institutions</span><strong>—</strong><small>API unavailable</small></article>
    <article><span>User accounts</span><strong>—</strong><small>API unavailable</small></article>
    <article><span>Review activity</span><strong>—</strong><small>Audit API unavailable</small></article>
  </div>
  <section className="account-panel"><header><div><h3>Application review queue</h3><p>Mockup-derived table structure with non-persistent synthetic examples.</p></div><span>PREVIEW DATA</span></header><div className="table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Institution</th><th>Type</th><th>Status</th><th>Review</th></tr></thead><tbody>{previewApplications.map(application => <tr key={application.reference}><td className="mono">{application.reference}</td><td><strong>{application.institution}</strong></td><td>{application.type}</td><td><span className="status warning">{application.status}</span></td><td><DisabledAction>Open preview</DisabledAction></td></tr>)}</tbody></table></div></section></>;
}

function Applications() {
  return <section className="account-panel"><header><div><h3>Institution applications</h3><p>Approval, rejection, document verification, and notifications are not connected.</p></div><DisabledAction>Export queue</DisabledAction></header><div className="table-wrap"><table className="data-table"><thead><tr><th>Application</th><th>Institution</th><th>Applicant type</th><th>Submitted</th><th>Decision</th></tr></thead><tbody>{previewApplications.map(application => <tr key={application.reference}><td className="mono">{application.reference}</td><td>{application.institution}</td><td>{application.type}</td><td>Not persisted</td><td className="account-actions"><DisabledAction>Approve</DisabledAction><DisabledAction>Reject</DisabledAction></td></tr>)}</tbody></table></div></section>;
}

function Institutions() {
  return <section className="account-panel"><header><div><h3>Participating institutions</h3><p>Activation and suspension controls are visual placeholders only.</p></div><DisabledAction>Add institution</DisabledAction></header><div className="account-empty"><span aria-hidden="true">⌂</span><strong>No institution-management API</strong><p>The official authenticated institution context remains authoritative. No mock institution records are created here.</p><DisabledAction>Activate institution</DisabledAction></div></section>;
}

function Users() {
  return <section className="account-panel"><header><div><h3>User accounts</h3><p>Provisioning, role assignment, reset, suspension, and deletion require an approved identity workflow.</p></div><DisabledAction>Provision account</DisabledAction></header><div className="account-empty"><span aria-hidden="true">◎</span><strong>No account-management API</strong><p>This preview deliberately contains no names, email addresses, employee identifiers, credentials, or mock password hashes.</p><DisabledAction>Manage account</DisabledAction></div></section>;
}

function Activity() {
  return <section className="account-panel"><header><div><h3>Administration activity</h3><p>Future review and account events must come from the permission-scoped audit contract.</p></div><span>NO RUNTIME FIXTURE</span></header><div className="account-empty"><span aria-hidden="true">≡</span><strong>No administration events</strong><p>A visual empty state is shown instead of fabricated approvals or transaction evidence.</p></div></section>;
}

export function AccountsPreview({ principal }: { principal: Principal }) {
  const [tab, setTab] = useState<Tab>("Overview");
  if (!["ROLE-05", "ROLE-06"].includes(principal.roleId)) return <div className="account-empty"><span aria-hidden="true">!</span><strong>Administration preview unavailable</strong><p>This frontend preview is shown only to the two administrative role compositions. This is not an API authorization boundary.</p></div>;
  return <div className="accounts-preview">
    <div className="preview-disclosure"><span aria-hidden="true">i</span><div><strong>Visual administration workspace</strong><p>Nothing on this page reads or changes accounts, institutions, applications, licenses, documents, or audit records.</p></div><b>FRONTEND ONLY</b></div>
    <div className="account-tabs" role="tablist" aria-label="Administration sections">{tabs.map(value => <button type="button" role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{value}</button>)}</div>
    {tab === "Overview" ? <Overview /> : tab === "Applications" ? <Applications /> : tab === "Institutions" ? <Institutions /> : tab === "User accounts" ? <Users /> : <Activity />}
  </div>;
}
