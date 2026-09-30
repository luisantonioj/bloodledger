import { useCallback, useEffect, useRef, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { humanizeCode, statusClassName } from "../../components/ui/display";
import {
  ACTIVE_FORECAST_DATASET,
  V5_FORECAST_DATASET,
  type ForecastDataset,
  manilaBusinessDate,
  readActiveForecast,
  type ForecastResponse,
} from "../../services/api/forecast";
import { ApiRequestError } from "../../services/api/client";
import { analyticsScopeLabel, canViewAnalyticsPreview } from "./analytics-access";

function uncertainty(lower: number | null, upper: number | null): string {
  return lower === null || upper === null ? "Uncertainty unavailable" : `${lower.toFixed(2)}–${upper.toFixed(2)} units`;
}

export function AnalyticsPreview({ principal }: { principal: Principal }) {
  const [businessDate, setBusinessDate] = useState(() => manilaBusinessDate());
  const [dataset, setDataset] = useState<ForecastDataset>(ACTIVE_FORECAST_DATASET);
  const requestId = useRef(0);
  const [data, setData] = useState<ForecastResponse>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setData(undefined);
    setError("");
    setBusy(true);
    try {
      const result = await readActiveForecast(businessDate, dataset);
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
    return <div className="analytics-preview-state unauthorized" role="alert"><span aria-hidden="true">!</span><div><strong>Analytics unavailable</strong><p>This composition is limited to blood-bank operational roles and the PRC institution. Backend authorization remains authoritative.</p></div></div>;
  }

  return <div className="analytics-preview">
    <div className="preview-disclosure analytics-disclosure"><span aria-hidden="true">i</span><div><strong>{dataset === ACTIVE_FORECAST_DATASET ? "Active ML V4 simulation" : "V5 simulation preview"}</strong><p>V5 predicts next-day requested demand, not releases, stock, or guaranteed supply. Operational recommendations remain disabled.</p></div><b>SIMULATION ONLY</b></div>

    <section className="analytics-preview-filter">
      <header><div><h3>Forecast scope</h3><p>One-day active-runtime forecasts for the authenticated institution.</p></div><span>{analyticsScopeLabel(principal)}</span></header>
      <div className="forecast-filter-grid">
        <label>Business date<input type="date" value={businessDate} onChange={(event) => { requestId.current += 1; setData(undefined); setBusinessDate(event.target.value); }} /></label>
        <label>Forecast version<select value={dataset} onChange={(event) => { requestId.current += 1; setData(undefined); setDataset(event.target.value as ForecastDataset); }}><option value={ACTIVE_FORECAST_DATASET}>Active V4</option><option value={V5_FORECAST_DATASET}>V5 simulation preview</option></select></label>
        <button className="button primary" type="button" disabled={busy} onClick={() => void refresh()}>{busy ? "Loading…" : "Refresh forecast"}</button>
      </div>
    </section>

    {error && <div className="analytics-api-state" role="alert"><span aria-hidden="true">!</span><div><strong>Forecast could not be loaded</strong><p>{error}</p></div></div>}
    {!data && busy && <div className="analytics-preview-state" role="status"><span aria-hidden="true">…</span><div><strong>Loading forecast</strong><p>Waiting for the backend forecast envelope.</p></div></div>}

    {data && <>
      <div className="analytics-preview-metrics forecast-provenance">
        <article><span>Envelope status</span><strong className="metric-code">{humanizeCode(data.status)}</strong><small>{data.forecastStatus}</small></article>
        <article><span>Returned series</span><strong>{data.forecasts.length}</strong><small>Maximum 20; absent is not zero</small></article>
        <article><span>As-of date</span><strong className="metric-date">{data.asOfDate ?? "—"}</strong><small>Unavailable remains explicit</small></article>
        <article><span>Horizon date</span><strong className="metric-date">{data.horizonDate ?? "—"}</strong><small>One-day active runtime</small></article>
        <article><span>Model</span><strong className="metric-model">{data.modelVersion ?? "—"}</strong><small>{data.datasetVersion}</small></article>
      </div>

      {data.status === "UNAVAILABLE" && <div className="analytics-api-state warning" role="status"><span aria-hidden="true">!</span><div><strong>Forecast unavailable</strong><p>{data.unavailableReason ? humanizeCode(data.unavailableReason) : "No completed forecast series is available for this date."}</p></div></div>}
      {data.status === "STALE" && <div className="analytics-api-state warning" role="status"><span aria-hidden="true">!</span><div><strong>Forecast is stale</strong><p>Values remain visible as evidence, but forecast-only recommendations stay disabled.</p></div></div>}

      <section className="analytics-preview-panel forecast-evidence">
        <header><div><h3>Forecast provenance</h3><p>CURRENT means eligible in the target-day window at the backend evaluation instant. Refresh does not retrain the frozen model or renew freshness.</p></div></header>
        <dl><dt>Target business date</dt><dd>{data.businessDate}</dd><dt>Generation time (Asia/Manila)</dt><dd>{data.generatedAt ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt)) : "Unavailable"}</dd><dt>Generation evidence (UTC)</dt><dd>{data.generatedAt ?? "Unavailable"}</dd><dt>Frozen training cutoff</dt><dd>{data.trainingCutoffDate ?? "Unavailable"}</dd><dt>Run</dt><dd>{data.runId ?? "Unavailable"}</dd><dt>Classification</dt><dd>{data.classification}</dd><dt>Recommendation eligibility</dt><dd>{data.recommendationEligibility}</dd></dl>
        {data.lineage && <details><summary>Model and data provenance</summary><dl>{Object.entries(data.lineage).filter(([key, value]) => /(?:Sha256|Version|Date)$/.test(key) && typeof value === "string" && value.length <= 128).map(([key, value]) => <div key={key}><dt>{humanizeCode(key)}</dt><dd style={{ overflowWrap: "anywhere" }}>{String(value)}</dd></div>)}</dl></details>}
      </section>
      <section className="analytics-preview-panel assessment">
        <header><div><h3>Daily demand forecast</h3><p>Only supported series returned by the backend are shown. Missing series are unavailable, never zero.</p></div><span className={statusClassName(data.status)}>{humanizeCode(data.status)}</span></header>
        {data.forecasts.length === 0 ? <div className="analytics-preview-state"><span aria-hidden="true">∅</span><div><strong>No returned forecast series</strong><p>The selected forecast result is unavailable for this business date.</p></div></div> : <div className="table-wrap"><table className="data-table forecast-table"><thead><tr><th>Blood type</th><th>Component</th><th>Point forecast</th><th>Uncertainty</th><th>Series status</th><th>Generated</th><th>Decision use</th></tr></thead><tbody>{data.forecasts.map((item) => <tr key={item.runKey + ":" + item.bloodType + ":" + item.component}>
          <td>{{ A_POSITIVE: "A+", B_POSITIVE: "B+", O_POSITIVE: "O+", AB_POSITIVE: "AB+" }[item.bloodType]}</td>
          <td>{humanizeCode(item.component)}{item.forecastId && <small className="analytics-cell-note">{item.forecastId}</small>}</td>
          <td className="numeric">{item.forecastStatus === "UNAVAILABLE" ? "Unavailable" : item.pointForecast.toFixed(2) + " units"}</td>
          <td><span>{uncertainty(item.lowerForecast, item.upperForecast)}</span>{item.uncertaintyNote && <small className="analytics-cell-note">{item.uncertaintyNote}</small>}</td>
          <td><span className={statusClassName(item.forecastStatus)}>{humanizeCode(item.forecastStatus)}</span>{item.stale && <small className="analytics-cell-note">Stale evidence</small>}</td>
          <td>{new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(item.generatedAt))}</td>
          <td><span className="status warning">Disabled</span><small className="analytics-cell-note">DISABLED_UNAPPROVED_POLICY</small></td>
        </tr>)}</tbody></table></div>}
        <footer>Dataset {data.datasetVersion} · model {data.modelVersion ?? "unavailable"} · recommendation eligibility disabled by unapproved policy.</footer>
      </section>

      <section className="analytics-preview-panel">
        <header><div><h3>Independent inventory evidence</h3><p>Forecast validity does not establish stock validity, shortage, surplus, reserves, or redistributability.</p></div></header>
        <div className="analytics-preview-state"><span aria-hidden="true">⌕</span><div><strong>Inventory validity unavailable</strong><p>Current inventory, stale inventory, and verified zero stock cannot be established for this assessment from the available browser contracts. Unknown inventory remains unavailable, never zero. Stock-dependent recommendations remain disabled.</p></div></div>
      </section>
    </>}
  </div>;
}
