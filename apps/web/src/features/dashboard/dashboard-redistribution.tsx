import { useState } from "react";
import type { Principal } from "../../auth/permissions";
import { humanizeCode, formatManilaDateTime } from "../../components/ui/display";
import { RefreshIcon } from "../../components/ui/refresh-button";
import { useRedistributionMatches, eligibleRedistribution } from "./redistribution-matches";
import { can } from "../../auth/permissions";
import { componentLabel, facilityLabel } from "../transfers/requester-transfer-data";

export function DashboardRedistribution({principal}: {principal: Principal}) {
  const quantity = "1";
  const state = useRedistributionMatches(principal.institutionId, true, "A_POSITIVE", "PACKED_RED_BLOOD_CELLS", Number(quantity));
  const [selection,setSelection] = useState("");
  const matches = state.data.flatMap(data => data.ranked.map(destination => ({data,destination,key:[data.bloodType,data.componentType,destination.destinationInstitutionId].join("|")})));
  const match = matches.find(row=>row.key===selection) ?? matches[0];
  const data = match?.data;
  const destination = match?.destination;
  const rankedValid = Boolean(data);
  const eligible = data && eligibleRedistribution(data);
  const ranked = eligible ? data.ranked : [];
  const reviewLink = data && ranked.length ? "/transfers?"+new URLSearchParams({tab:"redistribution",bloodType:data.bloodType,componentType:data.componentType,destination:destination!.destinationInstitutionId,quantity,runId:data.runId??""}) : "";
  return <section className="requester-dashboard-card dashboard-redistribution" aria-labelledby="dashboard-redistribution-heading">
    <header><h2 id="dashboard-redistribution-heading">Redistribution</h2><button className="button compact dashboard-refresh" type="button" aria-label="Refresh redistribution" disabled={state.busy} aria-busy={state.busy} onClick={state.refresh}><RefreshIcon/>Refresh</button></header>
    <div className="dashboard-redistribution-body">
      <div className="redistribution-readonly-fields">
        <label>Suggested matches<span className="requester-select"><select aria-label="Suggested matches" disabled={state.busy || !matches.length} value={match?.key ?? ""} onChange={event=>setSelection(event.target.value)}>{matches.length ? matches.map(row=><option key={row.key} value={row.key}>{row.data.bloodType.replace("_POSITIVE", "+").replace("_NEGATIVE", "−")} · {componentLabel(row.data.componentType)} → {facilityLabel(row.destination.destinationInstitutionId, principal)} · rank {row.destination.rank}</option>) : <option value="">{state.busy ? "Checking matches…" : "No available match"}</option>}</select></span></label>
        <label>Units<input aria-label="Redistribution units" readOnly value={data?.gate.requiredQuantity ?? "—"}/></label>
      </div>
      {state.busy ? <p role="status">Loading redistribution…</p> : state.error ? <p role="alert">Redistribution evidence could not be loaded. Refresh to try again.</p> : !data ? <p role="status">{humanizeCode(state.reason ?? "NO_ELIGIBLE_MATCHES")}</p> : !ranked.length ? <div className="empty"><strong>{eligible ? "No ranked destinations" : "Redistribution unavailable"}</strong>{humanizeCode(data.unavailableReason ?? data.gate.reason)}<small>A missing ranking does not mean there is no demand.</small></div> : <>
        <div className="redistribution-summary"><div className="redistribution-summary-copy"><span>{destination?.rank === 1 ? "Top-ranked destination" : `Selected destination · rank ${destination?.rank}`}</span><strong>{facilityLabel(destination!.destinationInstitutionId, principal)}</strong><small>Urgency {destination!.urgency} · Shortage {destination!.stockShortage} · {destination!.distanceKm} km</small></div>{can(principal,"transfers:read")&&<a className="button primary compact" href={reviewLink}>Review redistribution →</a>}</div>
        <div className="redistribution-summary-meta"><span>Source surplus <strong>{data.gate.surplusQuantity} units</strong></span><span>Selected <strong>{Number(quantity)} {Number(quantity) === 1 ? "unit" : "units"}</strong></span></div>
        <ol className="redistribution-shortlist" aria-label="Ranked redistribution destinations">{ranked.slice(0, 3).map(row => <li key={row.destinationInstitutionId}><span className="redistribution-rank">{row.rank}</span><span>{facilityLabel(row.destinationInstitutionId, principal)}</span><strong title="Backend BROA score">{row.score.toFixed(2)}</strong></li>)}</ol>
      </>}
      {data && rankedValid && <details className="redistribution-details"><summary><span>Ranking details</span><span className="redistribution-details-toggle" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></summary>{state.partial && <p role="status">Some product series could not be checked. Refresh to retry.</p>}<p>Policy: {data.policyVersion} · Evaluated {formatManilaDateTime(data.evaluationTime)}</p><p>Weights: urgency {data.weights.urgency}, shortage {data.weights.stockShortage}, distance penalty {data.weights.distancePenalty}. Relationship context not scored.</p>{ranked.map(row => <p key={row.destinationInstitutionId}>{row.rank}. {facilityLabel(row.destinationInstitutionId, principal)} · urgency {row.urgency} · shortage {row.stockShortage} · {row.distanceKm} km · score {row.score.toFixed(2)}<br/>Normalized: urgency {row.normalized.urgency}, shortage {row.normalized.stockShortage}, distance {row.normalized.distancePenalty}. Contributions: +{row.contributions.urgency}, +{row.contributions.stockShortage}, −{row.contributions.distancePenalty}.</p>)}{data.excluded.map(row => <p key={row.destinationInstitutionId}>{facilityLabel(row.destinationInstitutionId, principal)}: {humanizeCode(row.reason)}</p>)}</details>}
    </div>
  </section>;
}
