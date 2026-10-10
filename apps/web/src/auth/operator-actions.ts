import type { OperatorProfile } from "./permissions";

// Visibility only. The API binds and authorizes the actual operator and command.
export function actionCapability(action: string): string | undefined {
  if (action === "POST /api/v2/transfers") return "transfer:request";
  if (action === "POST /api/v2/local-releases") return "inventory:local-release";
  if (action === "POST /api/v2/inbound-captures") return "inventory:capture";
  if (/^POST \/api\/v2\/components\/[^/]+\/expiry$/.test(action)) return "inventory:expiry";
  if (/\/alerts\/[^/]+\/acknowledge$/.test(action)) return "alert:acknowledge";
  if (/\/onboarding\/invitations$/.test(action)) return "onboarding:invite";
  if (/\/onboarding\/operators$/.test(action)) return "operator:create-administrator";
  if (action.includes("/onboarding/operators/")) return "operator:" + action.split("/").at(-1);
  const last = action.split("/").at(-1);
  if (action.includes("/onboarding/applications/")) return "onboarding:" + (last === "reject" ? "approve" : last);
  if (action.includes("/onboarding/institutions/")) return "institution:" + last;
  if (action.includes("/reservations/")) return "transfer:" + last;
  return undefined;
}
export function eligibleOperators(operators: OperatorProfile[], action: string): OperatorProfile[] {
  const capability = actionCapability(action);
  return capability ? operators.filter(operator => operator.actionCapabilities?.includes(capability)) : [];
}
