import type { Principal } from "../../auth/permissions";
import { humanizeCode } from "../../components/ui/display";

export function ProfileView({principal}:{principal:Principal}) {
  return <div className="profile-grid"><article><span>Authenticated user</span><strong>{principal.displayName}</strong><small className="mono">{principal.userId}</small></article><article><span>Institution scope</span><strong>{principal.institutionDisplayName}</strong><small className="mono">{principal.institutionId}</small></article><article><span>Assigned role</span><strong>{principal.roleDisplayName}</strong><small>{principal.roleId}; assigned by the server</small></article><article><span>Data classification</span><strong>{humanizeCode(principal.classification)}</strong><small>Controlled synthetic research access only</small></article><section><h3>Effective permissions</h3>{principal.permissions.length===0?<p>No application permissions are assigned.</p>:<ul>{principal.permissions.map(permission=><li className="mono" key={permission}>{permission}</li>)}</ul>}<p>Role and institution cannot be changed from this browser session.</p></section></div>;
}
