import type { Principal } from "../../auth/permissions";
import { humanizeCode } from "../../components/ui/display";

function PlaceholderField({ label, value = "Not available" }: { label: string; value?: string }) {
  return <div className="profile-preview-field"><span>{label}</span><strong>{value}</strong><small>Requires an approved profile or onboarding contract</small></div>;
}

export function ProfilePreview({ principal }: { principal: Principal }) {
  const initials = principal.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "BL";
  return <>
    <div className="profile-identity"><span className="profile-avatar">{initials}</span><div className="profile-identity-copy"><span>Authenticated synthetic participant</span><h2>{principal.displayName}</h2><p className="mono">{principal.userId}</p><div><span className="status">{principal.roleDisplayName}</span><span className="status">{humanizeCode(principal.classification)}</span></div></div><div className="profile-institution"><span>Institution scope</span><strong>{principal.institutionDisplayName}</strong><small>Verified server-assigned scope</small></div></div>
    <div className="profile-preview-layout">
      <div>
        <section className="profile-preview-section"><header><div><h3>Personal information</h3><p>Mockup-derived contact layout; only safe session identity is available.</p></div><button className="button compact" disabled>Edit contact</button></header><div className="profile-preview-fields"><PlaceholderField label="Full name" value={principal.displayName}/><PlaceholderField label="Official position"/><PlaceholderField label="Employee reference"/><PlaceholderField label="Institutional email"/><PlaceholderField label="Contact number"/><PlaceholderField label="Professional license"/></div></section>
        <section className="profile-preview-section"><header><div><h3>Facility information</h3><p>Institution details must eventually come from a verified onboarding record.</p></div></header><div className="profile-preview-fields"><PlaceholderField label="Facility name" value={principal.institutionDisplayName}/><PlaceholderField label="Institution reference" value={principal.institutionId}/><PlaceholderField label="Registered legal name"/><PlaceholderField label="Participation type"/><PlaceholderField label="Facility classification"/><PlaceholderField label="Ownership"/><PlaceholderField label="Complete address"/><PlaceholderField label="Official facility contact"/></div></section>
        <section className="profile-preview-section"><header><div><h3>Licensing and qualification</h3><p>No license or document information is stored by this frontend preview.</p></div></header><div className="profile-preview-fields"><PlaceholderField label="Facility LTO"/><PlaceholderField label="Blood-service license"/><PlaceholderField label="Blood-service category"/><PlaceholderField label="Referral or supplying facility"/></div><div className="profile-document-placeholder"><span aria-hidden="true">≡</span><div><strong>Supporting documents unavailable</strong><p>Document storage, verification, retention, and access controls are not implemented.</p></div></div></section>
      </div>
      <aside>
        <section className="profile-preview-section"><header><div><h3>Credentials and access</h3><p>Safe values returned by the current session.</p></div></header><dl className="profile-kv"><dt>Assigned role</dt><dd>{principal.roleDisplayName}</dd><dt>Role ID</dt><dd className="mono">{principal.roleId}</dd><dt>Institution ID</dt><dd className="mono">{principal.institutionId}</dd><dt>Classification</dt><dd>{humanizeCode(principal.classification)}</dd></dl></section>
        <section className="profile-preview-section"><header><div><h3>Application record</h3><p>Visual parity placeholder.</p></div></header><dl className="profile-kv"><dt>Application ID</dt><dd>Not available</dd><dt>Submitted</dt><dd>Not available</dd><dt>Reviewed</dt><dd>Not available</dd><dt>Application type</dt><dd>Not available</dd></dl></section>
        <section className="profile-preview-section"><header><div><h3>Security</h3><p>Authentication changes require a dedicated secure API.</p></div></header><div className="profile-security-preview"><span aria-hidden="true">◇</span><div><strong>Password</strong><p>Recovery and change workflows are not implemented.</p></div></div><button className="button" disabled>Change password</button></section>
        <div className="profile-preview-note"><span aria-hidden="true">i</span><p>Role and institution cannot be changed from this browser session. Identity, licensing, and application corrections are also unavailable in this visual-only extension.</p></div>
      </aside>
    </div>
  </>;
}
