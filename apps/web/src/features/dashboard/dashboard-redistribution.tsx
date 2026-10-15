import type { Principal } from "../../auth/permissions";
import { humanizeCode, formatManilaDateTime } from "../../components/ui/display";
import { RefreshIcon } from "../../components/ui/refresh-button";
import { useRedistributionMatches, eligibleRedistribution } from "./redistribution-matches";
import { can } from "../../auth/permissions";
import { componentLabel, facilityLabel } from "../transfers/requester-transfer-data";

export function DashboardRedistribution({principal}: {principal: Principal}) {
  const quantity = "1";
  const state = useRedistributionMatches(principal.institutionId, true, "A_POSITIVE", "PACKED_RED_BLOOD_CELLS", Number(quantity));
  const data = state.data[0];
  const rankedValid = Boolean(data);
  const eligible = data && eligibleRedistribution(data);
  const ranked = eligible ? data.ranked : [];
  const reviewLink = data && ranked.length ? "/transfers?"+new URLSearchParams({tab:"redistribution",bloodType:data.bloodType,componentType:data.componentType,destination:ranked[0].destinationInstitutionId,quantity,runId:data.runId??""}) : "";
  return <section className="requester-dashboard-card dashboard-redistribution" aria-labelledby="dashboard-redistribution-heading">
    <header><h2 id="dashboard-redistribution-heading">Redistribution</h2><button className="button compact dashboard-refresh" type="button" aria-label="Refresh redistribution" disabled={state.busy} aria-busy={state.busy} onClick={state.refresh}><RefreshIcon/>Refresh</button></header>
    <div className="dashboard-redistribution-body">
      <div className="redistribution-readonly-fields">
        <label>Available matches<input aria-label="Redistribution match" readOnly value={data && ranked.length ? `${data.bloodType.replace("_POSITIVE", "+").replace("_NEGATIVE", "−")} · ${componentLabel(data.componentType)} → ${facilityLabel(ranked[0].destinationInstitutionId, principal)}` : state.busy ? "Checking matches…" : "No available match"}/></label>
        <label>Units<input aria-label="Redistribution units" readOnly value={data?.gate.requiredQuantity ?? "—"}/></label>
      </div>
      {state.busy ? <p role="status">Loading redistribution…</p> : state.error ? <p role="alert">Redistribution evidence could not be loaded. Refresh to try again.</p> : !data ? <p role="status">{humanizeCode(state.reason ?? "NO_ELIGIBLE_MATCHES")}</p> : !ranked.length ? <div className="empty"><strong>{eligible ? "No ranked destinations" : "Redistribution unavailable"}</strong>{humanizeCode(data.unavailableReason ?? data.gate.reason)}<small>A missing ranking does not mean there is no demand.</small></div> : <>
        <div className="redistribution-summary"><div className="redistribution-summary-copy"><span>Top-ranked destination</span><strong>{facilityLabel(ranked[0].destinationInstitutionId, principal)}</strong><small>Urgency {ranked[0].urgency} · Shortage {ranked[0].stockShortage} · {ranked[0].distanceKm} km</small></div>{can(principal,"transfers:read")&&<a className="button primary compact" href={reviewLink}>Review redistribution →</a>}</div>
        <div className="redistribution-summary-meta"><span>Source surplus <strong>{data.gate.surplusQuantity} units</strong></span><span>Selected <strong>{Number(quantity)} {Number(quantity) === 1 ? "unit" : "units"}</strong></span></div>
        <ol className="redistribution-shortlist" aria-label="Ranked redistribution destinations">{ranked.slice(0, 3).map(row => <li key={row.destinationInstitutionId}><span className="redistribution-rank">{row.rank}</span><span>{facilityLabel(row.destinationInstitutionId, principal)}</span><strong title="Backend BROA score">{row.score.toFixed(2)}</strong></li>)}</ol>
      </>}
      {<small className="redistribution-auto-status">Checks current source surplus every minute. {state.data.length} eligible product matches{state.partial ? " · Some series could not be checked; refresh to retry." : "."}</small>}
      {data && rankedValid && <details className="redistribution-details"><summary>Ranking details</summary><p>Policy: {data.policyVersion} · Evaluated {formatManilaDateTime(data.evaluationTime)}</p><p>Weights: urgency {data.weights.urgency}, shortage {data.weights.stockShortage}, distance penalty {data.weights.distancePenalty}. Relationship context not scored.</p>{ranked.map(row => <p key={row.destinationInstitutionId}>{row.rank}. {facilityLabel(row.destinationInstitutionId, principal)} · urgency {row.urgency} · shortage {row.stockShortage} · {row.distanceKm} km · score {row.score.toFixed(2)}<br/>Normalized: urgency {row.normalized.urgency}, shortage {row.normalized.stockShortage}, distance {row.normalized.distancePenalty}. Contributions: +{row.contributions.urgency}, +{row.contributions.stockShortage}, −{row.contributions.distancePenalty}.</p>)}{data.excluded.map(row => <p key={row.destinationInstitutionId}>{facilityLabel(row.destinationInstitutionId, principal)}: {humanizeCode(row.reason)}</p>)}</details>}
      <small className="redistribution-disclaimer">Synthetic decision support · Human approval required. Source surplus is separate from dashboard stock bands.</small>
    </div>
  </section>;
}
