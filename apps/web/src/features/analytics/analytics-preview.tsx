import { useCallback, useEffect, useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { humanizeCode, statusClassName } from "../../components/ui/display";
import {
  ACTIVE_FORECAST_DATASET,
  manilaBusinessDate,
  readActiveForecast,
  type ForecastResponse,
} from "../../services/api/forecast";
import { analyticsScopeLabel, canViewAnalyticsPreview } from "./analytics-access";

function uncertainty(lower: number | null, upper: number | null): string {
  return lower === null || upper === null ? "Uncertainty unavailable" : `${lower.toFixed(2)}–${upper.toFixed(2)} units`;
}

export function AnalyticsPreview({ principal }: { principal: Principal }) {
  const [businessDate, setBusinessDate] = useState(() => manilaBusinessDate());
  const [data, setData] = useState<ForecastResponse>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setData(undefined);
    setError("");
    setBusy(true);
    try {
      const result = await readActiveForecast(businessDate);
      if (requestId.current === currentRequest) setData(result);
    } catch (reason) {
      if (requestId.current === currentRequest) {
        setError(reason instanceof Error ? reason.message : "Active V4 forecast data is unavailable.");
      }
    } finally {
      if (requestId.current === currentRequest) setBusy(false);
    }
  }, [businessDate]);

  useEffect(() => {
    if (canViewAnalyticsPreview(principal)) void refresh();
  }, [principal, refresh]);

  if (!canViewAnalyticsPreview(principal)) {
    return <div className="analytics-preview-state unauthorized" role="alert"><span aria-hidden="true">!</span><div><strong>Analytics unavailable</strong><p>This forecast view is limited to authorized blood-bank roles. Backend authorization remains authoritative.</p></div></div>;
  }

  return <div className="analytics-preview">
    <div className="preview-disclosure analytics-disclosure"><span aria-hidden="true">i</span><div><strong>Active ML V4 simulation</strong><p>The forecast uses synthetic recorded-request history; accuracy on real hospital requests is unverified. Results cannot approve reserve or redistribution decisions.</p></div><b>SIMULATION ONLY</b></div>

    <section className="analytics-preview-filter">
      <header><div><h3>Forecast scope</h3><p>One-day active-runtime forecasts for the authenticated institution.</p></div><span>{analyticsScopeLabel(principal)}</span></header>
      <div className="forecast-filter-grid">
        <label>Business date<input type="date" value={businessDate} onChange={(event) => { requestId.current += 1; setData(undefined); setError(""); setBusy(false); setBusinessDate(event.target.value); }} /></label>
        <label>Dataset<input value={ACTIVE_FORECAST_DATASET} readOnly /></label>
        <button className="button primary" type="button" disabled={busy} onClick={() => void refresh()}>{busy ? "Loading…" : "Refresh forecast"}</button>
      </div>
    </section>

    {error && <div className="analytics-api-state" role="alert"><span aria-hidden="true">!</span><div><strong>Forecast endpoint unavailable</strong><p>{error}</p><small>The official session is required. No values are fabricated when access or forecast evidence is unavailable.</small></div></div>}
    {!data && busy && <div className="analytics-preview-state"><span aria-hidden="true">…</span><div><strong>Loading active V4 forecast</strong><p>Waiting for the backend forecast envelope.</p></div></div>}

    {data && <>
      <div className="analytics-preview-metrics forecast-provenance">
        <article><span>Envelope status</span><strong className="metric-code">{humanizeCode(data.status)}</strong><small>{data.forecastStatus}</small></article>
        <article><span>Returned series</span><strong>{data.forecasts.length}</strong><small>Maximum 20; absent is not zero</small></article>
        <article><span>As-of date</span><strong className="metric-date">{data.asOfDate ?? "—"}</strong><small>Unavailable remains explicit</small></article>
        <article><span>Horizon date</span><strong className="metric-date">{data.horizonDate ?? "—"}</strong><small>One-day active runtime</small></article>
        <article><span>Model</span><strong className="metric-model">{data.modelVersion ?? "—"}</strong><small>{data.datasetVersion}</small></article>
      </div>

      {data.status === "UNAVAILABLE" && <div className="analytics-api-state warning" role="status"><span aria-hidden="true">!</span><div><strong>Forecast unavailable</strong><p>{data.unavailableReason ? humanizeCode(data.unavailableReason) : "No completed active-V4 series is available for this date."}</p></div></div>}
      {data.status === "STALE" && <div className="analytics-api-state warning" role="status"><span aria-hidden="true">!</span><div><strong>Forecast is stale</strong><p>Values remain visible as evidence, but forecast-only recommendations stay disabled.</p></div></div>}

      <section className="analytics-preview-panel assessment">
        <header><div><h3>One-day recorded-request forecast</h3><p>Forecasted units requested, not units transfused or stock on hand. Missing series are unavailable, never zero.</p></div><span className={statusClassName(data.status)}>{humanizeCode(data.status)}</span></header>
        {data.forecasts.length === 0 ? <div className="analytics-preview-state"><span aria-hidden="true">∅</span><div><strong>No returned forecast series</strong><p>The active V4 result is unavailable for this business date.</p></div></div> : <div className="table-wrap"><table className="data-table forecast-table"><thead><tr><th>Blood type</th><th>Component</th><th>Requested units forecast</th><th>Uncertainty</th><th>Series status</th><th>Generated</th><th>Decision use</th></tr></thead><tbody>{data.forecasts.map((item) => <tr key={item.runKey + ":" + item.bloodType + ":" + item.component}>
          <td>{humanizeCode(item.bloodType)}</td>
          <td>{humanizeCode(item.component)}</td>
          <td className="numeric">{item.forecastStatus === "UNAVAILABLE" ? "Unavailable" : item.pointForecast.toFixed(2) + " units"}</td>
          <td>{uncertainty(item.lowerForecast, item.upperForecast)}{item.uncertaintyNote && <small className="analytics-cell-note">{item.uncertaintyNote}</small>}</td>
          <td><span className={statusClassName(item.forecastStatus)}>{humanizeCode(item.forecastStatus)}</span>{item.stale && <small className="analytics-cell-note">Stale evidence</small>}</td>
          <td>{new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(item.generatedAt))}</td>
          <td><span className="status warning">Disabled</span><small className="analytics-cell-note">Human review required</small></td>
        </tr>)}</tbody></table></div>}
        <footer>Dataset {data.datasetVersion} · model {data.modelVersion ?? "unavailable"} · recommendation eligibility disabled by unapproved policy.</footer>
      </section>

      <section className="analytics-preview-panel">
        <header><div><h3>Historical requests and redistribution assessment</h3><p>No approved permission-scoped history or operational reserve policy is exposed by this contract.</p></div></header>
        <div className="analytics-preview-state"><span aria-hidden="true">⌕</span><div><strong>Intentionally unavailable</strong><p>The frontend will not infer usage, reserve, surplus, or redistributability from forecast values alone.</p></div></div>
      </section>
    </>}
  </div>;
}
