import { ProductComparisonChart } from "../analytics/product-comparison-chart";
import { ApiRequestError, retryAfterContextChange } from "../../services/api/client";
import { useEffect, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { InformationHelp } from "../../components/ui/information-help";
import { RefreshButton } from "../../components/ui/refresh-button";
import { formatBloodType, humanizeCode, formatManilaDateTime, statusClassName, compactRecordReference } from "../../components/ui/display";
import { componentLabel, facilityLabel } from "../transfers/requester-transfer-data";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "../../services/api/v2";
import { manilaBusinessDate } from "../../services/api/forecast";
import { readCoordination, seriesQuery, type CoordinationView, type SourceSurplusView, type RpsPriorityView, type BroaRedistributionView } from "../../services/api/coordination";

const amount = (value: number | null | undefined) => value == null ? "Unavailable" : value.toLocaleString("en-PH", {maximumFractionDigits: 3});
function Notice() { return <p className="coordination-notice">SIMULATION_ONLY · recommendation disabled · Read-only explanation; no automatic approval.</p>; }
export function useCoordination<T extends CoordinationView>(path: string, institutionId: string, refreshKey = 0) {
  const [result, setResult] = useState<{path: string; data?: T; error?: string}>();
  const [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setResult(undefined); setBusy(true);
    // Session restoration may install the verifier while the first read is in flight.
    // Retry that client-only epoch rejection once, with the current scoped session.
    const read = () => readCoordination<T>(path, institutionId, controller.signal);
    void retryAfterContextChange(read, () => !controller.signal.aborted).then(data => {if (!controller.signal.aborted) setResult({path, data});}).catch(error => {if (!controller.signal.aborted) setResult({path, error: error instanceof ApiRequestError && error.status === 403 ? "Access denied for this decision-support view." : "Validated decision-support evidence could not be loaded."});}).finally(() => {if (!controller.signal.aborted) setBusy(false);});
    return () => controller.abort();
  }, [path, institutionId, refresh, refreshKey]);
  return {data: result?.path === path && result.data?.institutionId === institutionId ? result.data : undefined, error: result?.path === path ? result.error : undefined, busy, refresh: () => setRefresh(value => value + 1)};
}
function EvidenceState({busy, error, status, reason}: {busy: boolean; error?: string; status?: string; reason?: string | null}) {
  return <p role={error ? "alert" : "status"}>{busy ? "Loading current evidence…" : error ?? (status ? humanizeCode(status) + (reason ? " · " + humanizeCode(reason) : "") : "Evidence unavailable")}</p>;
}
export function SurplusPanel({principal, businessDate, refreshKey = 0, componentType}: {principal: Principal; businessDate: string; refreshKey?: number; componentType?: string}) {
  const state = useCoordination<SourceSurplusView>("/api/v2/analytics/source-surplus?" + new URLSearchParams({businessDate}), principal.institutionId, refreshKey);
  const data = state.data;
  return <section className="analytics-preview-panel coordination-panel analytics-surplus-card"><header><div><h3>{componentType ? "Estimated excess stock" : "Source surplus — "+businessDate}</h3></div><div className="analytics-card-actions"><span className="analytics-state" data-state={data?.status}>{state.busy ? "Loading" : data ? ({CURRENT:"Current",STALE:"Older result",UNAVAILABLE:"Unavailable"}[data.status]) : "Unavailable"}</span><RefreshButton busy={state.busy} onRefresh={state.refresh}/><InformationHelp label="Estimated excess stock">Units left after forecast demand and synthetic safety reserves are deducted from recorded stock for the selected date. This estimate is separate from live available inventory and does not approve redistribution. Open detailed data for the calculation and model provenance.</InformationHelp></div></header>
    <p className="analytics-section-description">Units left after forecast demand and synthetic safety reserves are deducted from recorded stock. This is not approval to redistribute.</p>
    {(state.busy || state.error || data?.status !== "CURRENT") && <EvidenceState busy={state.busy} error={state.error} status={data?.status} reason={data?.unavailableReason}/>}
    {data && <>
      {componentType && <ProductComparisonChart tone="excess" label="Estimated excess by blood type" rows={data.series.filter(row => row.componentType === componentType && row.bloodType !== null).map(row => ({bloodType:row.bloodType!,value:row.status === "AVAILABLE" && data.status === "CURRENT" ? row.surplusQuantity : null,note:row.status !== "AVAILABLE" ? "Evidence unavailable" : undefined}))}/>}
      <p className="analytics-plain-caption">{componentType ? componentLabel(componentType) : "All components"} · Source surplus — {businessDate}<span>Estimated excess uses recorded stock and a forecast. It is not live available inventory.</span></p>
      <details className="analytics-full-data"><summary>View detailed data</summary>
      <div className="table-wrap"><table className="data-table analytics-readable-table analytics-surplus-table"><thead><tr><th>Blood type</th><th>Component</th><th className="numeric">Available units</th><th className="numeric">Forecast units</th><th className="numeric">Surplus units</th><th>Series status</th><th>Evidence</th></tr></thead><tbody>{data.series.map((row,index) => <tr key={row.forecastId || index}><td><strong>{row.bloodType ? formatBloodType(row.bloodType) : "Unavailable"}</strong></td><td>{row.componentType ? componentLabel(row.componentType) : "Unavailable"}</td><td className="numeric">{amount(row.availableCount)}</td><td className="numeric">{amount(row.forecastDemand)}</td><td className="numeric analytics-surplus-value">{row.status === "AVAILABLE" && data.status === "CURRENT" ? amount(row.surplusQuantity) : "Unavailable"}</td><td><span className={statusClassName(row.status)}>{humanizeCode(row.status)}</span>{row.unavailableReason && <small>{humanizeCode(row.unavailableReason)}</small>}</td><td className="mono analytics-evidence-id" title={row.evidenceId ?? undefined}>{row.evidenceId ? compactRecordReference(row.evidenceId) : "Unavailable"}</td></tr>)}</tbody></table></div></details>
      <details className="analytics-method-details"><summary>How is excess calculated?</summary><p>Surplus = available − forecast − {data.reserve.safetyAllowance} safety − {data.reserve.minimumReserve} reserve, never below 0. Rounding: {humanizeCode(data.reserve.rounding)}.</p><dl className="analytics-result-facts"><div><dt>Policy</dt><dd>{data.policyVersion}</dd></div><div><dt>Stock captured · Manila</dt><dd>{data.census ? formatManilaDateTime(data.census.capturedAt) : "Unavailable"}</dd></div><div><dt>Forecast generated · Manila</dt><dd>{data.forecast ? formatManilaDateTime(data.forecast.generatedAt) : "Unavailable"}</dd></div><div><dt>Use</dt><dd>SIMULATION_ONLY · recommendation disabled</dd></div></dl></details>
    </>}
  </section>;
}
function SeriesControls({bloodType, componentType, onBloodType, onComponent}: {bloodType: string; componentType: string; onBloodType: (value:string)=>void; onComponent: (value:string)=>void}) {
  return <div className="coordination-controls"><label>Ranking blood type<select value={bloodType} onChange={e=>onBloodType(e.target.value)}>{V2_BLOOD_TYPES.map(value=><option key={value} value={value}>{formatBloodType(value)}</option>)}</select></label><label>Ranking component<select value={componentType} onChange={e=>onComponent(e.target.value)}>{V2_COMPONENT_TYPES.map(value=><option key={value} value={value}>{componentLabel(value)}</option>)}</select></label></div>;
}
export function RpsPanel({principal}: {principal: Principal}) {
  const [bloodType,setBloodType] = useState("A_POSITIVE"), [componentType,setComponent] = useState("PACKED_RED_BLOOD_CELLS");
  const state = useCoordination<RpsPriorityView>("/api/v2/coordination/priority?"+seriesQuery(bloodType,componentType),principal.institutionId), data=state.data;
  return <section className="analytics-preview-panel coordination-panel"><header><h3>Request priority (RPS)</h3><RefreshButton busy={state.busy} onRefresh={state.refresh}/></header><Notice/><SeriesControls bloodType={bloodType} componentType={componentType} onBloodType={setBloodType} onComponent={setComponent}/><EvidenceState busy={state.busy} error={state.error} status={data?.status} reason={data?.unavailableReason}/>
    {data && <><p>Urgency weight: {amount(data.weights.urgency)} · Waiting weight: {amount(data.weights.wait)} · Wait cap: {amount(data.weights.waitCapHours)} hours. Evaluated {formatManilaDateTime(data.evaluationTime)}.</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Rank</th><th>Request</th><th>Destination</th><th>Quantity</th><th>Urgency</th><th>Wait hours</th><th>Urgency contribution</th><th>Wait contribution</th><th>Score</th></tr></thead><tbody>{data.ranked.map(row=><tr key={row.transferId}><td>{row.rank}</td><td className="mono">{row.transferId}</td><td>{row.destinationInstitutionId ? facilityLabel(row.destinationInstitutionId, principal) : "Unavailable"}</td><td>{amount(row.quantity)}</td><td>{humanizeCode(row.urgency)}</td><td>{amount(row.waitHours)}</td><td>{amount(row.urgencyContribution)}</td><td>{amount(row.waitContribution)}</td><td>{amount(row.score)}</td></tr>)}</tbody></table></div>{!data.ranked.length && <p>No ranked requests returned for this series.</p>}<small>Policy: {data.policyVersion} · Run: {data.runId ?? "Unavailable"}</small></>}
  </section>;
}
function Factor({label, normalized, contribution}: {label:string; normalized:number; contribution:number}) {
  return <div className="coordination-factor"><span>{label}: normalized {amount(normalized)} · contribution {amount(contribution)}</span><meter min={0} max={1} value={Math.max(0,Math.min(1,normalized))} aria-label={label+" normalized factor"}/></div>;
}
export function RedistributionView({principal}: {principal: Principal}) {
  const [bloodType,setBloodType] = useState("A_POSITIVE"), [componentType,setComponent] = useState("PACKED_RED_BLOOD_CELLS"), [quantity,setQuantity] = useState(1);
  const query=seriesQuery(bloodType,componentType)+"&requiredQuantity="+quantity;
  const state=useCoordination<BroaRedistributionView>("/api/v2/coordination/redistribution?"+query,principal.institutionId),data=state.data;
  return <div className="coordination-workspace"><header className="page-head"><h1>Redistribution</h1><RefreshButton busy={state.busy} onRefresh={state.refresh}/></header><Notice/><SeriesControls bloodType={bloodType} componentType={componentType} onBloodType={setBloodType} onComponent={setComponent}/><label>Required quantity<input type="number" min={1} max={999} value={quantity} onChange={e=>{const value=Number(e.target.value);if(Number.isInteger(value)&&value>=1&&value<=999)setQuantity(value);}}/></label><EvidenceState busy={state.busy} error={state.error} status={data?.status} reason={data?.unavailableReason}/>
    <SurplusPanel principal={principal} businessDate={manilaBusinessDate()}/>
    {data && <><section className="analytics-preview-panel coordination-panel"><h2>Surplus gate</h2><p>{data.gate.eligible ? "Eligible for explanation" : "Gate closed"} · {humanizeCode(data.gate.reason)} · surplus {amount(data.gate.surplusQuantity)} / required {data.gate.requiredQuantity}</p><p>Relationship context not scored. Distances and need inputs are synthetic ({data.candidateAssumption}).</p><p>Weights: urgency {amount(data.weights.urgency)} · shortage {amount(data.weights.stockShortage)} · distance penalty {amount(data.weights.distancePenalty)}.</p><p>Policy {data.policyVersion} · evaluated {formatManilaDateTime(data.evaluationTime)}</p></section>
      <section className="analytics-preview-panel coordination-panel"><h2>BROA-ranked destinations</h2>{data.ranked.map(row=><article className="coordination-destination" key={row.destinationInstitutionId}><h3>{row.rank}. {facilityLabel(row.destinationInstitutionId, principal)} · score {amount(row.score)}</h3><p>Urgency {amount(row.urgency)} · shortage {amount(row.stockShortage)} · distance {amount(row.distanceKm)} km</p><Factor label="Urgency" normalized={row.normalized.urgency} contribution={row.contributions.urgency}/><Factor label="Stock shortage" normalized={row.normalized.stockShortage} contribution={row.contributions.stockShortage}/><Factor label="Distance penalty" normalized={row.normalized.distancePenalty} contribution={row.contributions.distancePenalty}/></article>)}{!data.ranked.length && <p>No ranked destinations returned. A closed gate is not zero demand.</p>}</section>
      <section className="analytics-preview-panel coordination-panel"><h2>Excluded hospitals</h2>{data.excluded.length ? <ul>{data.excluded.map(row=><li key={row.destinationInstitutionId}>{facilityLabel(row.destinationInstitutionId, principal)}: {humanizeCode(row.reason)}</li>)}</ul> : <p>No exclusions returned.</p>}</section></>}
  </div>;
}
