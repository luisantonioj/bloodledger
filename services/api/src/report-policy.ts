import { V2_BLOOD_TYPES, censusPolicyEnabled, type V2BloodType } from "./census.js";

export interface DohReportPolicy { version: string; bloodTypeOrder: readonly V2BloodType[]; copyModeEnabled: boolean; classification: "SIMULATION_ONLY"; }

export function readDohReportPolicy(environment: NodeJS.ProcessEnv = process.env): DohReportPolicy {
  const order = environment.BLOODLEDGER_DOH_BLOOD_TYPE_ORDER?.split(",").map((value) => value.trim()).filter(Boolean) as V2BloodType[] | undefined;
  const copyModeEnabled = censusPolicyEnabled(order);
  return { version: environment.BLOODLEDGER_DOH_REPORT_POLICY_VERSION ?? "INTERVIEW_REPORT_PENDING", bloodTypeOrder: copyModeEnabled ? order as readonly V2BloodType[] : V2_BLOOD_TYPES, copyModeEnabled, classification: "SIMULATION_ONLY" };
}
