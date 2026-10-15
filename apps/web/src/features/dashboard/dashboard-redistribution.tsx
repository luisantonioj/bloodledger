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
  const reviewLink = data && ranked.length ? "/transfers?"+new URLSearchParams({tab:"requests",review:"redistribution",bloodType:data.bloodType,componentType:data.componentType,destination:destination!.destinationInstitutionId,quantity,runId:data.runId??""}) : "";
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
      {data && rankedValid && <details className="redistribution-details"><summary><span>Ranking details</span><span className="redistribution-details-toggle" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></summary><div className="redistribution-ranking-body">
        {state.partial && <p role="status">Some product series could not be checked. Refresh to retry.</p>}
        <section className="redistribution-ranking-section">
          <h3>Destination ranking</h3>
          {ranked.map(row => <article className="redistribution-ranking-candidate" key={row.destinationInstitutionId}>
            <header><div className="redistribution-ranking-name"><span className="redistribution-ranking-position">#{row.rank}</span><h4>{facilityLabel(row.destinationInstitutionId, principal)}</h4></div><div className="redistribution-ranking-score"><span>Score</span><strong>{row.score.toFixed(2)}</strong></div></header>
            <dl className="redistribution-ranking-metrics"><div><dt>Urgency</dt><dd>{row.urgency}</dd></div><div><dt>Stock shortage</dt><dd>{row.stockShortage} units</dd></div><div><dt>Distance</dt><dd>{row.distanceKm} km</dd></div></dl>
            <div className="redistribution-factor-breakdown"><h5>Score breakdown</h5><table aria-label={facilityLabel(row.destinationInstitutionId, principal)+" score breakdown"}><thead><tr><th>Factor</th><th>Normalized</th><th>Contribution</th></tr></thead><tbody><tr><th scope="row">Urgency</th><td>{row.normalized.urgency}</td><td>+{row.contributions.urgency}</td></tr><tr><th scope="row">Stock shortage</th><td>{row.normalized.stockShortage}</td><td>+{row.contributions.stockShortage}</td></tr><tr><th scope="row">Distance penalty</th><td>{row.normalized.distancePenalty}</td><td>−{row.contributions.distancePenalty}</td></tr></tbody></table></div>
          </article>)}
        </section>
        <section className="redistribution-ranking-section"><h3>Ranking basis</h3><dl className="redistribution-ranking-provenance"><div><dt>Policy</dt><dd>{data.policyVersion}</dd></div><div><dt>Evaluated</dt><dd>{formatManilaDateTime(data.evaluationTime)}</dd></div></dl><h4 className="redistribution-ranking-subheading">Factor weights</h4><dl className="redistribution-ranking-metrics redistribution-ranking-weights"><div><dt>Urgency</dt><dd>{data.weights.urgency}</dd></div><div><dt>Stock shortage</dt><dd>{data.weights.stockShortage}</dd></div><div><dt>Distance penalty</dt><dd>{data.weights.distancePenalty}</dd></div></dl><p className="redistribution-ranking-note">Relationship context not scored.</p></section>
        {data.excluded.length>0 && <section className="redistribution-ranking-section"><h3>Excluded hospitals</h3><ul className="redistribution-ranking-exclusions">{data.excluded.map(row=><li key={row.destinationInstitutionId}><strong>{facilityLabel(row.destinationInstitutionId, principal)}</strong><span>{humanizeCode(row.reason)}</span></li>)}</ul></section>}
      </div></details>}
    </div>
  </section>;
}
