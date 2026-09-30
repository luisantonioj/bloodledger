import { requestJson } from "./client";

export const ACTIVE_FORECAST_DATASET = "SYNTHETIC_FORECAST_V4_RUNTIME_V1" as const;
export const ACTIVE_FORECAST_MODEL = "bloodledger-weighted-average-7-1.0.0" as const;
export const ACTIVE_FORECAST_BLOOD_TYPES = ["A_POSITIVE", "B_POSITIVE", "AB_POSITIVE", "O_POSITIVE"] as const;
export const ACTIVE_FORECAST_COMPONENTS = [
  "PACKED_RED_BLOOD_CELLS",
  "PLATELETS",
  "FRESH_FROZEN_PLASMA",
  "CRYOPRECIPITATE",
  "WHOLE_BLOOD",
] as const;

export interface ForecastItem {
  runKey: string;
  runId: string;
  institutionId: string;
  bloodType: (typeof ACTIVE_FORECAST_BLOOD_TYPES)[number];
  component: (typeof ACTIVE_FORECAST_COMPONENTS)[number];
  horizonDate: string;
  asOfDate: string;
  pointForecast: number;
  lowerForecast: number | null;
  upperForecast: number | null;
  uncertaintyStatus: "CALIBRATED" | "UNCERTAINTY_UNAVAILABLE";
  uncertaintyNote: string | null;
  datasetVersion: typeof ACTIVE_FORECAST_DATASET;
  modelVersion: string;
  forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE";
  classification: "SIMULATION_ONLY";
  recommendationEligibility: "DISABLED_UNAPPROVED_POLICY";
  generatedAt: string;
  stale: boolean;
}

export interface ForecastResponse {
  businessDate: string;
  status: "CURRENT" | "STALE" | "UNAVAILABLE";
  datasetVersion: typeof ACTIVE_FORECAST_DATASET;
  modelVersion: string | null;
  asOfDate: string | null;
  horizonDate: string | null;
  forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE";
  unavailableReason: string | null;
  forecasts: ForecastItem[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("FORECAST_RESPONSE_INVALID");
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("FORECAST_RESPONSE_INVALID");
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null ? null : string(value);
}

function nullableNumber(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("FORECAST_RESPONSE_INVALID");
  return value;
}

function parseItem(value: unknown): ForecastItem {
  const item = record(value);
  const bloodType = string(item.bloodType) as ForecastItem["bloodType"];
  const component = string(item.component) as ForecastItem["component"];
  if (!ACTIVE_FORECAST_BLOOD_TYPES.includes(bloodType) || !ACTIVE_FORECAST_COMPONENTS.includes(component)) {
    throw new Error("FORECAST_SERIES_UNSUPPORTED");
  }
  if (item.datasetVersion !== ACTIVE_FORECAST_DATASET || item.classification !== "SIMULATION_ONLY" || item.recommendationEligibility !== "DISABLED_UNAPPROVED_POLICY") {
    throw new Error("FORECAST_RESPONSE_INVALID");
  }
  if (item.modelVersion !== ACTIVE_FORECAST_MODEL) {
    throw new Error("FORECAST_MODEL_UNSUPPORTED");
  }
  if (typeof item.pointForecast !== "number" || !Number.isFinite(item.pointForecast) || item.pointForecast < 0 || typeof item.stale !== "boolean") {
    throw new Error("FORECAST_RESPONSE_INVALID");
  }
  const forecastStatus = string(item.forecastStatus) as ForecastItem["forecastStatus"];
  const uncertaintyStatus = string(item.uncertaintyStatus) as ForecastItem["uncertaintyStatus"];
  if (!["AVAILABLE", "STALE", "UNAVAILABLE"].includes(forecastStatus) || !["CALIBRATED", "UNCERTAINTY_UNAVAILABLE"].includes(uncertaintyStatus)) {
    throw new Error("FORECAST_RESPONSE_INVALID");
  }
  return {
    runKey: string(item.runKey),
    runId: string(item.runId),
    institutionId: string(item.institutionId),
    bloodType,
    component,
    horizonDate: string(item.horizonDate),
    asOfDate: string(item.asOfDate),
    pointForecast: item.pointForecast,
    lowerForecast: nullableNumber(item.lowerForecast),
    upperForecast: nullableNumber(item.upperForecast),
    uncertaintyStatus,
    uncertaintyNote: nullableString(item.uncertaintyNote),
    datasetVersion: ACTIVE_FORECAST_DATASET,
    modelVersion: ACTIVE_FORECAST_MODEL,
    forecastStatus,
    classification: "SIMULATION_ONLY",
    recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
    generatedAt: string(item.generatedAt),
    stale: item.stale,
  };
}

export function parseActiveForecast(value: unknown): ForecastResponse {
  const body = record(value);
  if (body.datasetVersion !== ACTIVE_FORECAST_DATASET || !Array.isArray(body.forecasts) || body.forecasts.length > 20) {
    throw new Error("FORECAST_RESPONSE_INVALID");
  }
  const status = string(body.status) as ForecastResponse["status"];
  const forecastStatus = string(body.forecastStatus) as ForecastResponse["forecastStatus"];
  if (!["CURRENT", "STALE", "UNAVAILABLE"].includes(status) || !["AVAILABLE", "STALE", "UNAVAILABLE"].includes(forecastStatus)) {
    throw new Error("FORECAST_RESPONSE_INVALID");
  }
  if (body.modelVersion !== null && body.modelVersion !== ACTIVE_FORECAST_MODEL) {
    throw new Error("FORECAST_MODEL_UNSUPPORTED");
  }
  return {
    businessDate: string(body.businessDate),
    status,
    datasetVersion: ACTIVE_FORECAST_DATASET,
    modelVersion: nullableString(body.modelVersion),
    asOfDate: nullableString(body.asOfDate),
    horizonDate: nullableString(body.horizonDate),
    forecastStatus,
    unavailableReason: nullableString(body.unavailableReason),
    forecasts: body.forecasts.map(parseItem),
  };
}

export function manilaBusinessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

export async function readActiveForecast(businessDate: string): Promise<ForecastResponse> {
  const path = "/api/v1/demand-forecasts?businessDate=" + encodeURIComponent(businessDate);
  const forecast = parseActiveForecast(await requestJson<unknown>(path, {}, "Active V4 forecast data is unavailable."));
  if (forecast.businessDate !== businessDate) throw new Error("FORECAST_RESPONSE_DATE_MISMATCH");
  return forecast;
}
