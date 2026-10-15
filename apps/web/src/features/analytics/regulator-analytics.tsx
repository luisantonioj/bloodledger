import { useState } from "react";
import { ObservedDemandAnalytics, analyticsManilaDay } from "./observed-demand-analytics";
import { ReportingFilters,emptyAnalyticsFilters,type AnalyticsFilters } from "./analytics-reporting-filters";
import type { Principal } from "../../auth/permissions";
import { InformationHelp } from "../../components/ui/information-help";
import { RefreshButton } from "../../components/ui/refresh-button";
import { formatManilaDateTime } from "../../components/ui/display";
import { useLiveData } from "../../hooks/use-live-data";
import { parseCensusIndex, type CensusIndex } from "../../services/api/census-index";
import { V2_COMPONENT_TYPES } from "../../services/api/v2";
import type { Consortium } from "../../services/api/types";
import { hospitalNetworkRows } from "../consortium/hospital-network-view";
import { componentLabel } from "../transfers/requester-transfer-data";
import { canViewRegulatoryAnalytics } from "./analytics-access";

// FR-03/11/12: summarize existing approved reads, never grant forecast access.
export function networkProductSummary(data: Consortium) {
  const rows = hospitalNetworkRows(data);
  return V2_COMPONENT_TYPES.map(component => {
    const products = rows.filter(row => row.component === component);
    const sum = (status: "available" | "reserved") => products.some(row => row[status] !== null) ? products.reduce((total,row) => total + (row[status] ?? 0),0) : null;
    return {component, available:sum("available"),reserved:sum("reserved")};
  });
}
export function reportingActivity(index: CensusIndex) {
  const days = new Map<string,{date:string;records:number;facilities:Set<string>}>();
  for (const row of index.snapshots) {
    const date = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(row.capturedAt));
    const group = days.get(date) ?? {date,records:0,facilities:new Set<string>()};
    group.records++; group.facilities.add(row.institutionId); days.set(date,group);
  }
  return [...days.values()].sort((a,b) => a.date.localeCompare(b.date));
}
function SummaryCards({cards}:{cards:[string,number|null,string][]}) {
  return <div className="consortium-summary-grid">{cards.map(([label,value,help]) => <section className="consortium-summary" key={label}><header className="consortium-summary-title"><span>{label}</span><InformationHelp label={label}>{help}</InformationHelp></header><strong>{value ?? "—"}</strong></section>)}</div>;
}
function PendingInsight({title,help,message}:{title:string;help:string;message:string}) {
  return <section className="bank-record-card"><header className="bank-section-heading"><h2>{title}</h2><InformationHelp label={title}>{help}</InformationHelp></header><div className="analytics-empty"><strong>Data not available yet</strong><p>{message}</p></div></section>;
}
export function RegulatorAnalytics({principal}:{principal:Principal}) {
  if (!canViewRegulatoryAnalytics(principal)) return <div className="analytics-empty"><strong>Analytics unavailable for this account</strong></div>;
  return principal.accountCategory === "PRC" ? <ObservedDemandAnalytics principal={principal}/> : <DohAnalytics principal={principal}/>;
}
function DohAnalytics({principal}:{principal:Principal}) {
  const [filters,setFilters]=useState<AnalyticsFilters>(emptyAnalyticsFilters);
  const state = useLiveData<unknown>("/api/v2/reports/doh-census?limit=20");
  let index:CensusIndex|undefined, error = state.error;
  if (state.data) {try {index = parseCensusIndex(state.data,principal);} catch(reason) {error = reason instanceof Error ? reason.message : "Reporting summaries unavailable.";}}
  const facilities:[string,string][]=[...new Set(index?.snapshots.map(row=>row.institutionId)??[])].map(id=>[id,id]);
  const filtered=index?{...index,snapshots:index.snapshots.filter(row=>(!filters.group||row.institutionId===filters.group)&&(!filters.from||analyticsManilaDay(row.capturedAt)>=filters.from)&&(!filters.to||analyticsManilaDay(row.capturedAt)<=filters.to)&&(!filters.from||!filters.to||filters.from<=filters.to))}:undefined;
  const activity = filtered ? reportingActivity(filtered) : [];
  return <div className="regulator-analytics">
    <header className="page-head analytics-page-head"><h1 className="page-title">Analytics</h1><RefreshButton busy={state.busy} onRefresh={state.manual}/></header>
    <p className="analytics-page-description">Saved census captures in the loaded report batch. These records do not establish reporting completion or compliance.</p>
    <ReportingFilters filters={filters} onChange={setFilters} groupLabel="Reporting facility" groups={facilities} groupAvailable products={false}/>
    <SummaryCards cards={[
      ["Recorded Reports",filtered ? filtered.snapshots.length : null,"Census records in the loaded report batch. A saved record is not a verification outcome or proof of submission to DOH. Open Compliance Reports to browse further records."],
      ["Reporting Facilities",filtered ? new Set(filtered.snapshots.map(row => row.institutionId)).size : null,"Distinct facilities represented in the loaded report batch. This is not a reporting-completion rate; the list of facilities required to report is not supplied."],
      ["Late Reports",null,"Lateness needs an approved deadline, grace period and submission record. Capture time alone cannot establish whether a facility submitted late."],
      ["Verification Outcomes",null,"Report verification and compliance outcomes are not supplied by the current census read. Missing information is not counted as failed compliance."],
    ]}/>
    <section className="bank-record-card"><header className="bank-section-heading"><h2>Reporting Activity</h2><a className="button compact" href="/reporting">View Reports</a><InformationHelp label="Reporting Activity">Census records grouped by capture date in Manila time, within the loaded batch. This shows recorded capture activity, not reporting completeness, punctuality, submission or regulatory compliance. Dates without records are not inferred as missed reporting days.</InformationHelp></header>
      <div className="table-wrap"><table className="data-table regulator-report-activity"><thead><tr><th>Capture date</th><th>Recorded reports</th><th>Reporting facilities</th></tr></thead><tbody>{activity.map(row => <tr key={row.date}><td>{row.date}</td><td>{row.records}</td><td>{row.facilities.size}</td></tr>)}{!activity.length && <tr><td colSpan={3}><div className="analytics-empty"><strong>{error ? "Reporting summary unavailable" : state.busy && !index ? "Loading reporting activity…" : "No reporting activity recorded"}</strong><p>{error || "Saved census captures will appear here. Missing records do not establish noncompliance."}</p></div></td></tr>}</tbody></table></div>
      {index?.nextCursor && <p className="regulator-analytics-note">More records are available. These summaries cover the first loaded batch; open Compliance Reports to browse the remaining records.</p>}
      {state.error && index && <p className="regulator-analytics-note" role="status">Refresh unavailable. Showing the last loaded report batch.</p>}
    </section>
    <div className="regulator-insight-grid">
      <PendingInsight title="Reporting Completion and Timeliness" help="Completion and late-report rates need the required facility population, approved reporting checkpoints and submission timestamps. They cannot be calculated from a list of captured census records alone." message="Required reporting coverage and submission times are needed to show completion and late reports."/>
      <PendingInsight title="Compliance Follow-up" help="This section will summarize recorded compliance exceptions, reviewer follow-ups and their outcomes when an authorized contract provides them. Inventory expiry or synchronization alerts are not automatically compliance violations." message="Reviewer follow-ups and compliance outcomes are not available in this view yet."/>
    </div>
  </div>;
}
