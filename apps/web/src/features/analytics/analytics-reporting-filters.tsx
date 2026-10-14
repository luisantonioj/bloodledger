import { InformationHelp } from "../../components/ui/information-help";
import { V2_BLOOD_TYPES,V2_COMPONENT_TYPES } from "../../services/api/v2";
import { formatBloodType } from "../../components/ui/display";
import { componentLabel } from "../transfers/requester-transfer-data";
export interface AnalyticsFilters {from:string;to:string;bloodType:string;component:string;group:string}
export const emptyAnalyticsFilters:AnalyticsFilters={from:"",to:"",bloodType:"",component:"",group:""};
export function ReportingFilters({filters,onChange,groupLabel="Requesting department",groups=[],groupAvailable=false,products=true}:{filters:AnalyticsFilters;onChange:(filters:AnalyticsFilters)=>void;groupLabel?:string;groups?:[string,string][];groupAvailable?:boolean;products?:boolean}) {
  const change=(field:keyof AnalyticsFilters,value:string)=>onChange({...filters,[field]:value});
  return <section className="bank-record-card"><header className="bank-section-heading"><h2>Reporting Filters</h2><InformationHelp label="Reporting Filters">Choose a date range and any available product or facility filters. Blank dates include all returned records. Filters describe loaded records only; they do not establish complete historical coverage. {products ? "Department information is unavailable until an authorized source provides it." : "Dates filter census capture activity in Manila time; capture is separate from submission or verification."}</InformationHelp></header>
    <div className={"observed-reporting-filters"+(products?"":" reporting-only-filters")}>
      <label>Date from<input type="date" value={filters.from} onChange={event=>change("from",event.target.value)}/></label>
      <label>Date to<input type="date" value={filters.to} onChange={event=>change("to",event.target.value)}/></label>
      {products && <><label>Blood type<span className="requester-select"><select aria-label="Analytics blood type" value={filters.bloodType} onChange={event=>change("bloodType",event.target.value)}><option value="">All blood types</option>{V2_BLOOD_TYPES.map(value=><option key={value} value={value}>{formatBloodType(value)}</option>)}</select></span></label><label>Component<span className="requester-select"><select aria-label="Analytics component" value={filters.component} onChange={event=>change("component",event.target.value)}><option value="">All components</option>{V2_COMPONENT_TYPES.map(value=><option key={value} value={value}>{componentLabel(value)}</option>)}</select></span></label></>}
      <label>{groupLabel}<span className="requester-select"><select aria-label={groupLabel} disabled={!groupAvailable} value={filters.group} onChange={event=>change("group",event.target.value)}><option value="">{groupAvailable?"All facilities":"Information unavailable"}</option>{groups.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></span></label>
    </div>{filters.from && filters.to && filters.from>filters.to && <p className="observed-filter-error" role="status">Choose an end date on or after the start date.</p>}
  </section>;
}
