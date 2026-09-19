import { V2_BLOOD_TYPES, censusPolicyEnabled, type V2BloodType } from "./census.js";

export const DOH_CENSUS_DISPLAY_POLICY_VERSION = "DOH_CENSUS_COLUMN_ORDER_V1" as const;
export const DOH_CENSUS_DISPLAY_ORDER = ["O_POSITIVE", "A_POSITIVE", "B_POSITIVE", "AB_POSITIVE", "O_NEGATIVE", "A_NEGATIVE", "B_NEGATIVE", "AB_NEGATIVE"] as const satisfies readonly V2BloodType[];

export interface DohReportPolicy { version: string; bloodTypeOrder: readonly V2BloodType[]; copyModeEnabled: boolean; classification: "SIMULATION_ONLY"; }

export function readDohReportPolicy(environment: NodeJS.ProcessEnv = process.env): DohReportPolicy {
  const order = environment.BLOODLEDGER_DOH_BLOOD_TYPE_ORDER?.split(",").map((value) => value.trim()).filter(Boolean) as V2BloodType[] | undefined;
  const version = environment.BLOODLEDGER_DOH_REPORT_POLICY_VERSION ?? "INTERVIEW_REPORT_PENDING";
  const copyModeEnabled = censusPolicyEnabled(order) && version !== "INTERVIEW_REPORT_PENDING" && version !== DOH_CENSUS_DISPLAY_POLICY_VERSION;
  return { version, bloodTypeOrder: copyModeEnabled ? order as readonly V2BloodType[] : V2_BLOOD_TYPES, copyModeEnabled, classification: "SIMULATION_ONLY" };
}
