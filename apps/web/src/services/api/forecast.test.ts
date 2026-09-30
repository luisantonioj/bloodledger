import { describe, expect, it, vi } from "vitest";
import { ACTIVE_FORECAST_DATASET, ACTIVE_FORECAST_MODEL, ACTIVE_FORECAST_BLOOD_TYPES, ACTIVE_FORECAST_COMPONENTS, V5_FORECAST_DATASET, V5_FORECAST_MODEL, readActiveForecast, manilaBusinessDate, parseActiveForecast } from "./forecast";

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
    runId: "FRUN_SYNTH_001",
    generatedAt: "2026-09-17T16:00:00.000Z",
    lineage: null,
    trainingCutoffDate: null,
    classification: "SIMULATION_ONLY",
    recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
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

// Testing phase / FR-14 / BR-ALG-07: HTTP fixtures, not producer bundles.
describe("versioned simulation forecast evidence", () => {
  function v5() {
    const original = response({ datasetVersion: V5_FORECAST_DATASET, modelVersion: V5_FORECAST_MODEL, trainingCutoffDate: "2025-06-30", lineage: { trainingCutoffDate: "2025-06-30" } });
    return { ...original, forecasts: ACTIVE_FORECAST_BLOOD_TYPES.flatMap(bloodType => ACTIVE_FORECAST_COMPONENTS.map((component, index) => ({ ...original.forecasts[0]!, bloodType, component, datasetVersion: V5_FORECAST_DATASET, modelVersion: V5_FORECAST_MODEL, forecastId: "FC_" + (ACTIVE_FORECAST_BLOOD_TYPES.indexOf(bloodType) * 5 + index).toString(16).toUpperCase().padStart(40, "0"), lowerForecast: null as number | null }))) };
  }
  it("preserves explicit identifiers, cutoff and distinct origin, target and generation evidence", () => {
    const parsed = parseActiveForecast(v5(), V5_FORECAST_DATASET);
    expect(parsed.trainingCutoffDate).toBe("2025-06-30");
    expect(parsed.asOfDate).toBe("2026-09-17");
    expect(parsed.horizonDate).toBe("2026-09-18");
    expect(parsed.generatedAt).toBe("2026-09-17T16:00:00.000Z");
    expect(parsed.forecasts[0]?.forecastId).toBe("FC_" + "0".repeat(40));
  });
  it("accepts all twenty explicit supported series in arbitrary order", () => {
    const body = v5();
    body.forecasts.reverse();
    expect(parseActiveForecast(body, V5_FORECAST_DATASET).forecasts).toHaveLength(20);
  });
  it("rejects response/request mismatch, wrong models, duplicate series and fabricated uncertainty", () => {
    expect(() => parseActiveForecast(v5())).toThrow();
    expect(() => parseActiveForecast(response(), V5_FORECAST_DATASET)).toThrow();
    expect(() => parseActiveForecast({ ...v5(), modelVersion: ACTIVE_FORECAST_MODEL }, V5_FORECAST_DATASET)).toThrow();
    const body = v5(); body.forecasts.push(body.forecasts[0]!);
    expect(() => parseActiveForecast(body, V5_FORECAST_DATASET)).toThrow();
    const malformed = v5(); malformed.forecasts[0]!.lowerForecast = 0;
    expect(() => parseActiveForecast(malformed, V5_FORECAST_DATASET)).toThrow();
  });
  it("preserves unavailable future-generated reason without results and stale history", () => {
    const body = v5();
    expect(parseActiveForecast({ ...body, status: "UNAVAILABLE", forecastStatus: "UNAVAILABLE", unavailableReason: "V5_FORECAST_FUTURE_GENERATED", forecasts: [] }, V5_FORECAST_DATASET).unavailableReason).toBe("V5_FORECAST_FUTURE_GENERATED");
    expect(() => parseActiveForecast({ ...body, status: "UNAVAILABLE", forecastStatus: "UNAVAILABLE" }, V5_FORECAST_DATASET)).toThrow();
    body.forecasts.forEach(item => { item.stale = true; item.forecastStatus = "STALE"; });
    expect(parseActiveForecast({ ...body, status: "STALE", forecastStatus: "STALE" }, V5_FORECAST_DATASET).status).toBe("STALE");
  });
  it("rejects malformed date, timestamp, classification and negative or unsupported evidence", () => {
    for (const patch of [{ businessDate: "2026-02-30" }, { generatedAt: "invalid" }, { lineage: [] }, { classification: "CLINICAL" }, { trainingCutoffDate: undefined }]) {
      expect(() => parseActiveForecast({ ...v5(), ...patch }, V5_FORECAST_DATASET)).toThrow();
    }
    for (const patch of [{ pointForecast: -1 }, { component: "MWB" }, { bloodType: "O_NEGATIVE" }, { generatedAt: "invalid" }]) {
      const body = v5(); Object.assign(body.forecasts[0]!, patch);
      expect(() => parseActiveForecast(body, V5_FORECAST_DATASET)).toThrow();
    }
  });
  it("keeps V4 default and requests V5 explicitly with cookie credentials and no institution parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response() });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await readActiveForecast("2026-09-18");
      expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/demand-forecasts?businessDate=2026-09-18");
      fetchMock.mockResolvedValue({ ok: true, json: async () => v5() });
      await readActiveForecast("2026-09-18", V5_FORECAST_DATASET);
      expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/demand-forecasts?businessDate=2026-09-18&datasetVersion=" + V5_FORECAST_DATASET);
      expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ credentials: "same-origin" });
      await expect(readActiveForecast("2026-09-19", V5_FORECAST_DATASET)).rejects.toThrow();
    } finally { vi.unstubAllGlobals(); }
  });
  it("rejects incomplete, mixed identity and contradictory completed V5 evidence", () => {
    for (const mutate of [
      (body: ReturnType<typeof v5>) => { body.forecasts.pop(); },
      (body: ReturnType<typeof v5>) => { body.forecasts = []; },
      (body: ReturnType<typeof v5>) => { body.forecasts[1]!.forecastId = body.forecasts[0]!.forecastId; },
      (body: ReturnType<typeof v5>) => { body.forecasts[1]!.forecastStatus = "UNAVAILABLE"; },
      (body: ReturnType<typeof v5>) => { body.forecasts[1]!.runKey = "OTHER"; },
      (body: ReturnType<typeof v5>) => { body.horizonDate = "2026-09-19"; },
    ]) {
      const body = v5(); mutate(body);
      expect(() => parseActiveForecast(body, V5_FORECAST_DATASET)).toThrow();
    }
  });
  it("handles Manila midnight without conflating UTC generation date", () => {
    expect(manilaBusinessDate(new Date("2026-09-17T15:59:59.999Z"))).toBe("2026-09-17");
    expect(manilaBusinessDate(new Date("2026-09-17T16:00:00.000Z"))).toBe("2026-09-18");
  });
});
