/** Versioned opt-in transition. Existing hosts retain the eight-digit baseline until credentials are rotated. */
export function operatorPinLength(environment: NodeJS.ProcessEnv = process.env): 6 | 8 {
  const version = environment.BLOODLEDGER_OPERATOR_PIN_POLICY_VERSION;
  if (!version || version === "OPERATOR_PIN_8_V1") return 8;
  if (version === "SYNTHETIC_OPERATOR_PIN_6_V1") return 6;
  throw new Error("OPERATOR_PIN_POLICY_UNSUPPORTED");
}
export function validOperatorPin(value: unknown, environment: NodeJS.ProcessEnv = process.env): value is string {
  return typeof value === "string" && new RegExp(`^[0-9]{${operatorPinLength(environment)}}$`).test(value);
}
