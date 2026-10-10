import type { Principal } from "../../auth/permissions";
import { InstitutionAccountsView } from "../accounts/institution-accounts-view";
export function InstitutionProfile({principal}: {principal: Principal}) {
  return <InstitutionAccountsView principal={principal} mode="profile"/>;
}
