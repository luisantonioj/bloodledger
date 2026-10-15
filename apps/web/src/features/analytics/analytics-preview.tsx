import { RefreshIcon } from "../../components/ui/refresh-button";
import { InformationHelp } from "../../components/ui/information-help";
import { InventoryEvidencePanel } from "./inventory-evidence-panel";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { humanizeCode, statusClassName } from "../../components/ui/display";
import {
  ACTIVE_FORECAST_DATASET,
  manilaBusinessDate,
  readActiveForecast,
  type ForecastResponse,
} from "../../services/api/forecast";
import { ApiRequestError, retryAfterContextChange } from "../../services/api/client";
import { canViewAnalyticsPreview } from "./analytics-access";

function uncertainty(lower: number | null, upper: number | null): string {
  return lower === null || upper === null ? "Uncertainty unavailable" : `${lower.toFixed(2)}–${upper.toFixed(2)} units`;
}

export function AnalyticsPreview({ principal }: { principal: Principal }) {
  const [businessDate, setBusinessDate] = useState(() => manilaBusinessDate());
  const dataset = ACTIVE_FORECAST_DATASET;
  const [bloodType, setBloodType] = useState("");
  const [component, setComponent] = useState("");
  const requestId = useRef(0);
  const [inventoryRefresh, setInventoryRefresh] = useState(0);
  const [data, setData] = useState<ForecastResponse>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setInventoryRefresh(value => value + 1);
    setData(undefined);
    setError("");
    setBusy(true);
    try {
      const result = await retryAfterContextChange(() => readActiveForecast(businessDate, dataset), () => id === requestId.current);
      if (id !== requestId.current) return;
      if (result.forecasts.some((item) => item.institutionId !== principal.institutionId)) throw new Error("FORECAST_SCOPE_INVALID");
      setData(result);
      setError("");
    } catch (reason) {
      if (id !== requestId.current) return;
      setError(reason instanceof ApiRequestError && reason.status === 401 ? "Your session has expired. Sign in again to view forecasts." : reason instanceof ApiRequestError && reason.status === 403 ? "Your session is not authorized to view this forecast." : "Unable to load validated forecast evidence. Please retry.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, [businessDate, dataset, principal.institutionId]);

  useEffect(() => {
    if (canViewAnalyticsPreview(principal)) void refresh();
    return () => { requestId.current += 1; };
  }, [principal, refresh]);

  if (!canViewAnalyticsPreview(principal)) {
    return <div className="analytics-preview-state unauthorized" role="alert"><span aria-hidden="true">!</span><div><strong>Analytics unavailable</strong><p>This composition is limited to the three authorized hospital roles. Backend authorization remains authoritative.</p></div></div>;
  }

  const visibleForecasts = data?.forecasts.filter(item => (!bloodType || item.bloodType === bloodType) && (!component || item.component === component)) ?? [];
  const bloodTypes = { A_POSITIVE: "A+", B_POSITIVE: "B+", O_POSITIVE: "O+", AB_POSITIVE: "AB+" };
  const components = { WHOLE_BLOOD: "Whole blood", PACKED_RED_BLOOD_CELLS: "PRBC", FRESH_FROZEN_PLASMA: "FFP", PLATELETS: "Platelets", CRYOPRECIPITATE: "Cryoprecipitate" };
  const lastUpdated = data?.generatedAt ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt)) : "Unavailable";

  return <div className="analytics-preview analytics-workspace">
    <section className="analytics-preview-filter">
      <header><h3>Demand overview</h3><InformationHelp label="Demand overview">Review estimates of blood units that may be requested for the selected day. Choose a date, then narrow the results by blood type or component. Estimates describe requested units, not transfusions, stock on hand or guaranteed supply. Missing results mean unavailable, not zero.</InformationHelp></header>
      <div className="forecast-filter-grid analytics-date-filter-grid">
        <label>Business date<input type="date" value={businessDate} onChange={(event) => { requestId.current += 1; setData(undefined); setBusinessDate(event.target.value); }} /></label>
        <button className="button compact refresh-icon-button" type="button" disabled={busy} onClick={() => void refresh()}><RefreshIcon/>{busy ? "Loading…" : "Refresh"}</button>
      </div>
    </section>

    <div className="analytics-preview-metrics">
      <article><span>Forecast date</span><strong>{data?.horizonDate ?? "—"}</strong><small>Day the estimate applies to</small></article>
      <article><span>Blood product groups</span><strong>{data ? data.forecasts.length : "—"}</strong><small>Blood type and component combinations</small></article>
      <article><span>Last updated</span><strong>{lastUpdated}</strong><small>{data?.status === "STALE" ? "Older result — refresh before reviewing" : data?.status === "CURRENT" ? "Current result · Asia/Manila" : "No completed result available"}</small></article>
    </div>

    <section className="analytics-preview-panel analytics-demand-panel">
      <header><h3>Expected blood requests</h3><InformationHelp label="Expected blood requests">Estimated units are the predicted number of units requested. A decimal is an estimate, not a partial blood bag. The estimated range expresses uncertainty when available. An older result is marked stale. Review actual inventory and requests separately before taking action.</InformationHelp></header>
      <div className="analytics-table-filters">
        <label>Blood type<span className="analytics-select"><select aria-label="Blood type" value={bloodType} onChange={event => setBloodType(event.target.value)}><option value="">All blood types</option>{Object.entries(bloodTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span></label>
        <label>Component<span className="analytics-select"><select aria-label="Component" value={component} onChange={event => setComponent(event.target.value)}><option value="">All components</option>{Object.entries(components).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span></label>
        <span>{visibleForecasts.length} results</span>
      </div>
      <div className="table-wrap"><table className="data-table forecast-table"><thead><tr><th>Blood type</th><th>Component</th><th>Estimated units</th><th>Estimated range</th><th>Result status</th></tr></thead><tbody>
        {visibleForecasts.map(item => <tr key={item.runKey + ":" + item.bloodType + ":" + item.component}>
          <td>{bloodTypes[item.bloodType]}</td><td>{components[item.component]}</td>
          <td className="numeric">{item.forecastStatus === "UNAVAILABLE" ? "Unavailable" : item.pointForecast.toFixed(2)}</td>
          <td>{uncertainty(item.lowerForecast, item.upperForecast)}</td>
          <td><span className={statusClassName(item.forecastStatus)}>{item.stale ? "Stale" : humanizeCode(item.forecastStatus)}</span></td>
        </tr>)}
        {visibleForecasts.length === 0 && <tr><td colSpan={5}><div className="analytics-empty" role={error ? "alert" : "status"}><strong>{busy ? "Loading estimates…" : error ? "Forecast unavailable" : !data || data.status === "UNAVAILABLE" ? "No forecast available" : "No matching results"}</strong><p>{busy ? "Your results will appear here." : error || (data?.status === "UNAVAILABLE" || !data ? "Choose another date or refresh to check for a completed forecast." : "Try another blood type or component.")}</p></div></td></tr>}
      </tbody></table></div>
      {data?.status === "STALE" && <p className="analytics-freshness-note" role="status">These estimates are from an older result. Refresh to check for an updated forecast.</p>}
    </section>

    <InventoryEvidencePanel businessDate={businessDate} institutionId={principal.institutionId} refreshKey={inventoryRefresh}/>
  </div>;
}
