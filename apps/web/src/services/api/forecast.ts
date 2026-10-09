import { requestJson } from "./client";

export const ACTIVE_FORECAST_DATASET = "SYNTHETIC_FORECAST_V4_RUNTIME_V1" as const;
export const V5_FORECAST_DATASET = "SYNTHETIC_FORECAST_V5_RUNTIME_V1" as const;
export const V5_FORECAST_MODEL = "bloodledger-v5-series-mean-1.0.0" as const;
export type ForecastDataset = typeof ACTIVE_FORECAST_DATASET | typeof V5_FORECAST_DATASET;
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
  forecastId?: string;
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
  datasetVersion: ForecastDataset;
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
  datasetVersion: ForecastDataset;
  modelVersion: string | null;
  asOfDate: string | null;
  horizonDate: string | null;
  forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE";
  unavailableReason: string | null;
  runId: string | null;
  generatedAt: string | null;
  lineage: Record<string, unknown> | null;
  trainingCutoffDate: string | null;
  classification: "SIMULATION_ONLY";
  recommendationEligibility: "DISABLED_UNAPPROVED_POLICY";
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

function parseItem(value: unknown, dataset: ForecastDataset): ForecastItem {
  const model = dataset === V5_FORECAST_DATASET ? V5_FORECAST_MODEL : ACTIVE_FORECAST_MODEL;
  const item = record(value);
  const fields = ["forecastId", "runKey", "runId", "institutionId", "bloodType", "component", "horizonDate", "asOfDate", "pointForecast", "lowerForecast", "upperForecast", "uncertaintyStatus", "uncertaintyNote", "datasetVersion", "modelVersion", "forecastStatus", "classification", "recommendationEligibility", "generatedAt", "stale"];
  if (Object.keys(item).some((key) => !fields.includes(key))) throw new Error("FORECAST_RESPONSE_INVALID");
  if (!/^(RUN|FRUN)_[A-Z0-9_-]{1,56}$/.test(string(item.runId)) || !/^INST_[A-Z0-9_-]{1,59}$/.test(string(item.institutionId)) || (item.forecastId !== undefined && !/^(FC|FCST)_[0-9A-F]{32,40}$/.test(string(item.forecastId)))) throw new Error("FORECAST_RESPONSE_INVALID");
  const bloodType = string(item.bloodType) as ForecastItem["bloodType"];
  const component = string(item.component) as ForecastItem["component"];
  if (!ACTIVE_FORECAST_BLOOD_TYPES.includes(bloodType) || !ACTIVE_FORECAST_COMPONENTS.includes(component)) {
    throw new Error("FORECAST_SERIES_UNSUPPORTED");
  }
  if (item.datasetVersion !== dataset || item.classification !== "SIMULATION_ONLY" || item.recommendationEligibility !== "DISABLED_UNAPPROVED_POLICY") {
    throw new Error("FORECAST_RESPONSE_INVALID");
  }
  if (item.modelVersion !== model) {
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
    ...(item.forecastId === undefined ? {} : { forecastId: string(item.forecastId) }),
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
    datasetVersion: dataset,
    modelVersion: model,
    forecastStatus,
    classification: "SIMULATION_ONLY",
    recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
    generatedAt: string(item.generatedAt),
    stale: item.stale,
  };
}

export function parseActiveForecast(value: unknown, dataset: ForecastDataset = ACTIVE_FORECAST_DATASET): ForecastResponse {
  const model = dataset === V5_FORECAST_DATASET ? V5_FORECAST_MODEL : ACTIVE_FORECAST_MODEL;
  const body = record(value);
  if (dataset !== ACTIVE_FORECAST_DATASET && dataset !== V5_FORECAST_DATASET) throw new Error("FORECAST_RESPONSE_INVALID");
  if (body.datasetVersion !== dataset || !Array.isArray(body.forecasts) || body.forecasts.length > 20) {
    throw new Error("FORECAST_RESPONSE_INVALID");
  }
  const status = string(body.status) as ForecastResponse["status"];
  const forecastStatus = string(body.forecastStatus) as ForecastResponse["forecastStatus"];
  if (!["CURRENT", "STALE", "UNAVAILABLE"].includes(status) || !["AVAILABLE", "STALE", "UNAVAILABLE"].includes(forecastStatus)) {
    throw new Error("FORECAST_RESPONSE_INVALID");
  }
  if (body.modelVersion !== null && body.modelVersion !== model) {
    throw new Error("FORECAST_MODEL_UNSUPPORTED");
  }
  if (body.classification !== "SIMULATION_ONLY" || body.recommendationEligibility !== "DISABLED_UNAPPROVED_POLICY") throw new Error("FORECAST_RESPONSE_INVALID");
  const forecasts = body.forecasts.map((item) => parseItem(item, dataset));
  const keys = forecasts.map((item) => item.bloodType + ":" + item.component);
  if (new Set(keys).size !== keys.length || (status === "UNAVAILABLE" && forecasts.length !== 0)) throw new Error("FORECAST_RESPONSE_INVALID");
  if (forecastStatus !== (status === "CURRENT" ? "AVAILABLE" : status)) throw new Error("FORECAST_RESPONSE_INVALID");
  if (forecasts.some((item) => item.stale !== (status === "STALE"))) throw new Error("FORECAST_RESPONSE_INVALID");
  const dates = [body.businessDate, body.asOfDate, body.horizonDate, body.trainingCutoffDate, ...forecasts.flatMap((item) => [item.asOfDate, item.horizonDate])];
  for (const date of dates) {
    if (date === null) continue;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
      throw new Error("FORECAST_RESPONSE_INVALID");
    }
  }
  for (const timestamp of [body.generatedAt, ...forecasts.map((item) => item.generatedAt)]) {
    if (timestamp !== null && (typeof timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp)))) {
      throw new Error("FORECAST_RESPONSE_INVALID");
    }
  }
  for (const item of forecasts) {
    if (item.uncertaintyStatus === "UNCERTAINTY_UNAVAILABLE" ? item.lowerForecast !== null || item.upperForecast !== null : item.lowerForecast === null || item.upperForecast === null || item.lowerForecast > item.upperForecast) throw new Error("FORECAST_RESPONSE_INVALID");
    if (dataset === V5_FORECAST_DATASET && (!item.forecastId || item.uncertaintyStatus !== "UNCERTAINTY_UNAVAILABLE" || item.runId !== body.runId || item.horizonDate !== body.horizonDate || item.asOfDate !== body.asOfDate || item.generatedAt !== body.generatedAt)) throw new Error("FORECAST_RESPONSE_INVALID");
  }
  if (dataset === V5_FORECAST_DATASET && status !== "UNAVAILABLE") {
    const nextDay = typeof body.asOfDate === "string" ? new Date(body.asOfDate + "T00:00:00.000Z") : null;
    nextDay?.setUTCDate(nextDay.getUTCDate() + 1);
    if (forecasts.length !== 20 || body.modelVersion !== model || body.unavailableReason !== null ||
        body.horizonDate !== nextDay?.toISOString().slice(0, 10) || body.horizonDate !== body.businessDate ||
        body.trainingCutoffDate !== "2025-06-30" || new Set(forecasts.map(item => item.forecastId)).size !== 20 ||
        forecasts.some(item => item.forecastStatus !== forecastStatus || item.runKey !== forecasts[0]?.runKey || item.institutionId !== forecasts[0]?.institutionId)) {
      throw new Error("FORECAST_RESPONSE_INVALID");
    }
  }
  return {
    runId: nullableString(body.runId),
    generatedAt: nullableString(body.generatedAt),
    lineage: body.lineage === null ? null : record(body.lineage),
    trainingCutoffDate: nullableString(body.trainingCutoffDate),
    classification: "SIMULATION_ONLY",
    recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
    businessDate: string(body.businessDate),
    status,
    datasetVersion: dataset,
    modelVersion: nullableString(body.modelVersion),
    asOfDate: nullableString(body.asOfDate),
    horizonDate: nullableString(body.horizonDate),
    forecastStatus,
    unavailableReason: nullableString(body.unavailableReason),
    forecasts,
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

export async function readActiveForecast(businessDate: string, dataset: ForecastDataset = ACTIVE_FORECAST_DATASET): Promise<ForecastResponse> {
  const path = "/api/v1/demand-forecasts?businessDate=" + encodeURIComponent(businessDate) + (dataset === V5_FORECAST_DATASET ? "&datasetVersion=" + dataset : "");
  const data = parseActiveForecast(await requestJson<unknown>(path, {}, "Forecast data is unavailable."), dataset);
  if (data.businessDate !== businessDate) throw new Error("FORECAST_RESPONSE_INVALID");
  return data;
}
