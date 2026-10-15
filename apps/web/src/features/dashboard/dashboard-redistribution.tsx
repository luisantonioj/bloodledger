import { useState } from "react";
import type { Principal } from "../../auth/permissions";
import { humanizeCode, formatManilaDateTime } from "../../components/ui/display";
import { RefreshIcon } from "../../components/ui/refresh-button";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "../../services/api/v2";
import { useRedistributionMatches, eligibleRedistribution } from "./redistribution-matches";
import { can } from "../../auth/permissions";
import { componentLabel, facilityLabel } from "../transfers/requester-transfer-data";

export function DashboardRedistribution({principal}: {principal: Principal}) {
  const [bloodType, setBloodType] = useState("A_POSITIVE");
  const [component, setComponent] = useState("PACKED_RED_BLOOD_CELLS");
  const [quantity, setQuantity] = useState("1");
  const validQuantity = /^[1-9][0-9]{0,2}$/.test(quantity) && Number.isSafeInteger(Number(quantity)) && Number(quantity) > 0;
  const [automatic,setAutomatic] = useState(true), [match,setMatch] = useState("");
  const state = useRedistributionMatches(principal.institutionId, automatic, bloodType, component, validQuantity ? Number(quantity) : null);
  const data = state.data.find(row=>row.bloodType+"|"+row.componentType===match) ?? state.data[0];
  const rankedValid = Boolean(data);
  const eligible = data && eligibleRedistribution(data);
  const ranked = eligible ? data.ranked : [];
  const reviewLink = data && ranked.length ? "/transfers?"+new URLSearchParams({tab:"redistribution",bloodType:data.bloodType,componentType:data.componentType,destination:ranked[0].destinationInstitutionId,quantity,runId:data.runId??""}) : "";
  return <section className="requester-dashboard-card dashboard-redistribution" aria-labelledby="dashboard-redistribution-heading">
    <header><h2 id="dashboard-redistribution-heading">Redistribution</h2><button className="button compact dashboard-refresh" type="button" aria-label="Refresh redistribution" disabled={state.busy} aria-busy={state.busy} onClick={state.refresh}><RefreshIcon/>Refresh</button></header>
    <div className="dashboard-redistribution-body">
      <div className="redistribution-mode" role="group" aria-label="Redistribution matching mode"><button type="button" className="button compact" aria-pressed={automatic} onClick={()=>setAutomatic(true)}>Automatic matches</button><button type="button" className="button compact" aria-pressed={!automatic} onClick={()=>setAutomatic(false)}>Choose manually</button></div>
      {automatic && state.data.length>0 && <label className="redistribution-match-picker">Available matches<select aria-label="Redistribution match" value={data?.bloodType+"|"+data?.componentType} onChange={event=>setMatch(event.target.value)}>{state.data.map(row=><option key={row.bloodType+"|"+row.componentType} value={row.bloodType+"|"+row.componentType}>{row.bloodType.replace("_POSITIVE","+").replace("_NEGATIVE","−")} · {componentLabel(row.componentType)} → {facilityLabel(row.ranked[0].destinationInstitutionId,principal)}</option>)}</select></label>}
      <div className="dashboard-redistribution-filters">
        {!automatic && <><label>Blood type<select aria-label="Redistribution blood type" value={bloodType} onChange={event => setBloodType(event.target.value)}>{V2_BLOOD_TYPES.map(type => <option key={type} value={type}>{type.replace("_POSITIVE", "+").replace("_NEGATIVE", "−")}</option>)}</select></label>
        <label>Component<select aria-label="Redistribution component" value={component} onChange={event => setComponent(event.target.value)}>{V2_COMPONENT_TYPES.map(type => <option key={type} value={type}>{componentLabel(type)}</option>)}</select></label></>}
        <label>Units<input aria-label="Redistribution units" type="number" min="1" max="999" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} aria-invalid={!validQuantity}/></label>
      </div>
      {!validQuantity ? <p role="status">Enter a whole number of units from 1 to 999.</p> : state.busy ? <p role="status">Loading redistribution…</p> : state.error ? <p role="alert">Redistribution evidence could not be loaded. Refresh to try again.</p> : !data ? <p role="status">{humanizeCode(state.reason ?? "NO_ELIGIBLE_MATCHES")}</p> : !ranked.length ? <div className="empty"><strong>{eligible ? "No ranked destinations" : "Redistribution unavailable"}</strong>{humanizeCode(data.unavailableReason ?? data.gate.reason)}<small>A missing ranking does not mean there is no demand.</small></div> : <>
        <div className="redistribution-summary"><div className="redistribution-summary-copy"><span>Top-ranked destination</span><strong>{facilityLabel(ranked[0].destinationInstitutionId, principal)}</strong><small>Urgency {ranked[0].urgency} · Shortage {ranked[0].stockShortage} · {ranked[0].distanceKm} km</small></div>{can(principal,"transfers:read")&&<a className="button primary compact" href={reviewLink}>Review redistribution →</a>}</div>
        <div className="redistribution-summary-meta"><span>Source surplus <strong>{data.gate.surplusQuantity} units</strong></span><span>Selected <strong>{Number(quantity)} {Number(quantity) === 1 ? "unit" : "units"}</strong></span></div>
        <ol className="redistribution-shortlist" aria-label="Ranked redistribution destinations">{ranked.slice(0, 3).map(row => <li key={row.destinationInstitutionId}><span className="redistribution-rank">{row.rank}</span><span>{facilityLabel(row.destinationInstitutionId, principal)}</span><strong title="Backend BROA score">{row.score.toFixed(2)}</strong></li>)}</ol>
      </>}
      {automatic && <small className="redistribution-auto-status">Checks current source surplus every minute. {state.data.length} eligible product matches{state.partial ? " · Some series could not be checked; refresh to retry." : "."}</small>}
      {data && rankedValid && <details className="redistribution-details"><summary>Ranking details</summary><p>Policy: {data.policyVersion} · Evaluated {formatManilaDateTime(data.evaluationTime)}</p><p>Weights: urgency {data.weights.urgency}, shortage {data.weights.stockShortage}, distance penalty {data.weights.distancePenalty}. Relationship context not scored.</p>{ranked.map(row => <p key={row.destinationInstitutionId}>{row.rank}. {facilityLabel(row.destinationInstitutionId, principal)} · urgency {row.urgency} · shortage {row.stockShortage} · {row.distanceKm} km · score {row.score.toFixed(2)}<br/>Normalized: urgency {row.normalized.urgency}, shortage {row.normalized.stockShortage}, distance {row.normalized.distancePenalty}. Contributions: +{row.contributions.urgency}, +{row.contributions.stockShortage}, −{row.contributions.distancePenalty}.</p>)}{data.excluded.map(row => <p key={row.destinationInstitutionId}>{facilityLabel(row.destinationInstitutionId, principal)}: {humanizeCode(row.reason)}</p>)}</details>}
      <small className="redistribution-disclaimer">Synthetic decision support · Human approval required. Source surplus is separate from dashboard stock bands.</small>
    </div>
  </section>;
}
