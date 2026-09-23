import { describe, expect, it } from "vitest";
import { ACTIVE_FORECAST_DATASET, ACTIVE_FORECAST_MODEL, manilaBusinessDate, parseActiveForecast } from "./forecast";

function response(overrides: Record<string, unknown> = {}) {
  return {
    businessDate: "2026-09-18",
    status: "CURRENT",
    datasetVersion: ACTIVE_FORECAST_DATASET,
    modelVersion: ACTIVE_FORECAST_MODEL,
    asOfDate: "2026-09-17",
    horizonDate: "2026-09-18",
    forecastStatus: "AVAILABLE",
    unavailableReason: null,
    forecasts: [{
      runKey: "RUN_KEY_SYNTH",
      runId: "FRUN_SYNTH_001",
      institutionId: "INST_MEDIATRIX",
      bloodType: "A_POSITIVE",
      component: "PACKED_RED_BLOOD_CELLS",
      horizonDate: "2026-09-18",
      asOfDate: "2026-09-17",
      pointForecast: 2,
      lowerForecast: null,
      upperForecast: null,
      uncertaintyStatus: "UNCERTAINTY_UNAVAILABLE",
      uncertaintyNote: "Synthetic history is insufficient.",
      datasetVersion: ACTIVE_FORECAST_DATASET,
      modelVersion: ACTIVE_FORECAST_MODEL,
      forecastStatus: "AVAILABLE",
      classification: "SIMULATION_ONLY",
      recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
      generatedAt: "2026-09-17T16:00:00.000Z",
      stale: false,
    }],
    ...overrides,
  };
}

describe("active ML V4 frontend contract", () => {
  it("preserves null uncertainty without converting it to zero", () => {
    const parsed = parseActiveForecast(response());
    expect(parsed.forecasts[0]?.lowerForecast).toBeNull();
    expect(parsed.forecasts[0]?.upperForecast).toBeNull();
  });

  it("rejects silent historical V1 fallback and unsupported series", () => {
    expect(() => parseActiveForecast(response({ datasetVersion: "SYNTHETIC_FORECAST_V1" }))).toThrowError("FORECAST_RESPONSE_INVALID");
    const unsupported = response();
    (unsupported.forecasts as Array<Record<string, unknown>>)[0]!.bloodType = "A_NEGATIVE";
    expect(() => parseActiveForecast(unsupported)).toThrowError("FORECAST_SERIES_UNSUPPORTED");
  });

  it("rejects an unapproved model version at the envelope or series boundary", () => {
    expect(() => parseActiveForecast(response({ modelVersion: "unapproved-model" }))).toThrowError("FORECAST_MODEL_UNSUPPORTED");
    const unsupported = response();
    (unsupported.forecasts as Array<Record<string, unknown>>)[0]!.modelVersion = "unapproved-model";
    expect(() => parseActiveForecast(unsupported)).toThrowError("FORECAST_MODEL_UNSUPPORTED");
  });

  it("derives the business date in Asia/Manila", () => {
    expect(manilaBusinessDate(new Date("2026-09-17T16:30:00.000Z"))).toBe("2026-09-18");
  });
});
