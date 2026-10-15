import { useState } from "react";
import type { Principal } from "../../auth/permissions";
import { humanizeCode, formatManilaDateTime } from "../../components/ui/display";
import { RefreshIcon } from "../../components/ui/refresh-button";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "../../services/api/v2";
import { seriesQuery, type BroaRedistributionView } from "../../services/api/coordination";
import { useCoordination } from "../coordination/coordination-panels";
import { componentLabel, facilityLabel } from "../transfers/requester-transfer-data";

export function DashboardRedistribution({principal}: {principal: Principal}) {
  const [bloodType, setBloodType] = useState("A_POSITIVE");
  const [component, setComponent] = useState("PACKED_RED_BLOOD_CELLS");
  const [quantity, setQuantity] = useState("1");
  const validQuantity = /^[1-9][0-9]{0,2}$/.test(quantity) && Number.isSafeInteger(Number(quantity)) && Number(quantity) > 0;
  const state = useCoordination<BroaRedistributionView>("/api/v2/coordination/redistribution?" + seriesQuery(bloodType, component) + "&requiredQuantity=" + (validQuantity ? quantity : "1"), principal.institutionId);
  const response = state.data;
  // Bind a ranking to the exact controls; never carry a prior series into a new selection.
  const matches = response?.schemaVersion === "BROA_REDISTRIBUTION_VIEW_V1" && response.bloodType === bloodType && response.componentType === component && response.gate.requiredQuantity === Number(quantity) && ["AVAILABLE", "UNAVAILABLE"].includes(response.status);
  const data = validQuantity && matches ? response : undefined;
  const rankedValid = data?.ranked.every((row, index) => row.rank === index + 1 && typeof row.destinationInstitutionId === "string" && row.destinationInstitutionId !== principal.institutionId && Number.isFinite(row.score) && [row.urgency, row.stockShortage, row.distanceKm, row.normalized?.urgency, row.normalized?.stockShortage, row.normalized?.distancePenalty, row.contributions?.urgency, row.contributions?.stockShortage, row.contributions?.distancePenalty].every(value => Number.isFinite(value) && value >= 0)) && new Set(data.ranked.map(row => row.destinationInstitutionId)).size === data.ranked.length;
  const eligible = data?.status === "AVAILABLE" && data.gate.eligible === true && typeof data.gate.surplusQuantity === "number" && data.gate.surplusQuantity >= Number(quantity) && rankedValid;
  const ranked = eligible ? data.ranked : [];
  return <section className="requester-dashboard-card dashboard-redistribution" aria-labelledby="dashboard-redistribution-heading">
    <header><h2 id="dashboard-redistribution-heading">Redistribution</h2><button className="button compact dashboard-refresh" type="button" aria-label="Refresh redistribution" disabled={state.busy} aria-busy={state.busy} onClick={state.refresh}><RefreshIcon/>Refresh</button></header>
    <div className="dashboard-redistribution-body">
      <div className="dashboard-redistribution-filters">
        <label>Blood type<select aria-label="Redistribution blood type" value={bloodType} onChange={event => setBloodType(event.target.value)}>{V2_BLOOD_TYPES.map(type => <option key={type} value={type}>{type.replace("_POSITIVE", "+").replace("_NEGATIVE", "−")}</option>)}</select></label>
        <label>Component<select aria-label="Redistribution component" value={component} onChange={event => setComponent(event.target.value)}>{V2_COMPONENT_TYPES.map(type => <option key={type} value={type}>{componentLabel(type)}</option>)}</select></label>
        <label>Units<input aria-label="Redistribution units" type="number" min="1" max="999" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} aria-invalid={!validQuantity}/></label>
      </div>
      {!validQuantity ? <p role="status">Enter a whole number of units from 1 to 999.</p> : state.busy ? <p role="status">Loading redistribution…</p> : state.error || !data || !rankedValid ? <p role="alert">Redistribution evidence could not be loaded. Refresh to try again.</p> : !ranked.length ? <div className="empty"><strong>{eligible ? "No ranked destinations" : "Redistribution unavailable"}</strong>{humanizeCode(data.unavailableReason ?? data.gate.reason)}<small>A missing ranking does not mean there is no demand.</small></div> : <>
        <div className="redistribution-summary"><span>Top-ranked destination</span><strong>{facilityLabel(ranked[0].destinationInstitutionId, principal)}</strong><small>Urgency {ranked[0].urgency} · Shortage {ranked[0].stockShortage} · {ranked[0].distanceKm} km</small></div>
        <div className="redistribution-summary-meta"><span>Source surplus <strong>{data.gate.surplusQuantity} units</strong></span><span>Selected <strong>{Number(quantity)} {Number(quantity) === 1 ? "unit" : "units"}</strong></span></div>
        <ol className="redistribution-shortlist" aria-label="Ranked redistribution destinations">{ranked.slice(0, 3).map(row => <li key={row.destinationInstitutionId}><span className="redistribution-rank">{row.rank}</span><span>{facilityLabel(row.destinationInstitutionId, principal)}</span><strong title="Backend BROA score">{row.score.toFixed(2)}</strong></li>)}</ol>
      </>}
      {data && rankedValid && <details className="redistribution-details"><summary>Ranking details</summary><p>Policy: {data.policyVersion} · Evaluated {formatManilaDateTime(data.evaluationTime)}</p><p>Weights: urgency {data.weights.urgency}, shortage {data.weights.stockShortage}, distance penalty {data.weights.distancePenalty}. Relationship context not scored.</p>{ranked.map(row => <p key={row.destinationInstitutionId}>{row.rank}. {facilityLabel(row.destinationInstitutionId, principal)} · urgency {row.urgency} · shortage {row.stockShortage} · {row.distanceKm} km · score {row.score.toFixed(2)}<br/>Normalized: urgency {row.normalized.urgency}, shortage {row.normalized.stockShortage}, distance {row.normalized.distancePenalty}. Contributions: +{row.contributions.urgency}, +{row.contributions.stockShortage}, −{row.contributions.distancePenalty}.</p>)}{data.excluded.map(row => <p key={row.destinationInstitutionId}>{facilityLabel(row.destinationInstitutionId, principal)}: {humanizeCode(row.reason)}</p>)}</details>}
      <small className="redistribution-disclaimer">Synthetic decision support · Human approval required. Source surplus is separate from dashboard stock bands.</small>
    </div>
  </section>;
}
