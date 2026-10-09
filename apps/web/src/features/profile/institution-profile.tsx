import type { Principal } from "../../auth/permissions";
import { InstitutionAccountsView } from "../accounts/institution-accounts-view";
export function InstitutionProfile({principal}: {principal: Principal}) {
  return <><div className="profile-identity"><div><h2>{principal.institutionDisplayName}</h2><p>{principal.accountCategory?.replaceAll("_"," ")} · {principal.accountState}</p><p className="mono">{principal.accountId}</p></div></div><InstitutionAccountsView principal={principal}/></>;
}
