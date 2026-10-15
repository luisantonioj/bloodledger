import type { SourceSurplusView } from "../../services/api/coordination";
import { manilaBusinessDate } from "../../services/api/forecast";

// A current backend estimate may support human review, never authorize a transfer.
export function sourceSurplusQuantity(view: SourceSurplusView, institutionId: string, bloodType: string, componentType: string, eligible: number, now = Date.now()): number | null {
  const date = manilaBusinessDate(new Date(now));
  const dayBefore = new Date(date+"T00:00:00Z"); dayBefore.setUTCDate(dayBefore.getUTCDate()-1);
  if (view.schemaVersion !== "SOURCE_SURPLUS_VIEW_V1" || view.institutionId !== institutionId || view.classification !== "SIMULATION_ONLY" || view.recommendationEligibility !== "DISABLED_UNAPPROVED_POLICY" || view.status !== "CURRENT" || view.businessDate !== date || !view.census?.snapshotId || !view.forecast?.runId || view.forecast.datasetVersion !== "SYNTHETIC_FORECAST_V5_RUNTIME_V1" || view.forecast.horizonDate !== date || view.forecast.originDate !== dayBefore.toISOString().slice(0,10)) return null;
  for (const time of [view.census.capturedAt, view.forecast.generatedAt]) {
    if (!Number.isFinite(Date.parse(time)) || Date.parse(time)>now || manilaBusinessDate(new Date(time))!==date) return null;
  }
  const rows = view.series.filter(row=>row.bloodType===bloodType&&row.componentType===componentType);
  const row = rows[0];
  return rows.length===1 && row.status==="AVAILABLE" && row.availableCount===eligible && row.evidenceId && Number.isSafeInteger(row.surplusQuantity) && row.surplusQuantity!>=0 && row.surplusQuantity!<=eligible ? row.surplusQuantity : null;
}
