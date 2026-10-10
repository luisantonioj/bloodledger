import { useState } from "react";
import { can, canAct, type Principal } from "../../auth/permissions";
import { BloodTypeBadge } from "../../components/ui/aggregate-tables";
import { formatBloodType, humanizeCode, statusClassName } from "../../components/ui/display";
import type { Dashboard } from "../../services/api/types";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "../../services/api/v2";
import { networkAvailableUnits, ownRequests, type RequesterRequests } from "./requester-dashboard-data";

export interface RequesterRequestsState {
  data?: RequesterRequests;
  busy: boolean;
  error: string;
  manual: () => void;
}
const componentLabels: Record<string, string> = {
  WHOLE_BLOOD: "Whole Blood", PACKED_RED_BLOOD_CELLS: "PRBC", FRESH_FROZEN_PLASMA: "FFP",
  PLATELETS: "Platelets", CRYOPRECIPITATE: "Cryo",
};

export function RequesterDashboard({ data, principal, requests, bankMode=false }: { data: Dashboard; principal: Principal; requests: RequesterRequestsState; bankMode?:boolean }) {
  const [bloodType, setBloodType] = useState("O_POSITIVE");
  const [component, setComponent] = useState("PACKED_RED_BLOOD_CELLS");
  const available = networkAvailableUnits(data, bloodType, component);
  const rows = requests.data ? bankMode ? requests.data.requests : ownRequests(requests.data, principal.institutionId) : [];
  const mayRead = can(principal, "transfers:read");
  const mayRequest = mayRead && (principal.accountId ? canAct(principal, "transfer:request") : can(principal, "transfers:write"));
  return <div className="requester-dashboard-grid">
    <section className="requester-dashboard-card" aria-labelledby="requester-requests-heading">
      <header><div><h2 id="requester-requests-heading">{bankMode?"Requests":"My Requests"}</h2>{!bankMode&&<p>Requests associated with {principal.institutionDisplayName}.</p>}</div>{mayRead && <a className="requester-dashboard-link" href="/transfers">View all →</a>}</header>
      {!mayRead ? <div className="empty"><strong>Requests unavailable</strong>This account cannot view requests.</div>
        : !requests.data ? <div className="empty" aria-live="polite"><strong>{requests.error ? "Requests unavailable" : "Loading requests…"}</strong></div>
        : rows.length === 0 ? <div className="empty"><strong>No requests yet</strong>Your submitted blood requests will appear here.</div>
        : <div className="table-wrap"><table className="data-table requester-requests-table"><thead><tr><th>Reference</th><th>{bankMode?"Blood Type":"Blood"}</th>{bankMode&&<th>Component</th>}<th className="numeric">Units</th><th>Priority</th><th>Status</th></tr></thead><tbody>{rows.slice(0, 5).map(row => <tr key={row.transfer_id}>
          <td><a className="requester-request-reference mono" href={"/transfers?record=request&recordId=" + encodeURIComponent(row.transfer_id)}>{row.transfer_id}</a></td>
          <td>{bankMode?formatBloodType(row.blood_type):<><BloodTypeBadge value={row.blood_type}/><small>{componentLabels[row.component_type] ?? humanizeCode(row.component_type)}</small></>}</td>{bankMode&&<td>{componentLabels[row.component_type] ?? humanizeCode(row.component_type)}</td>}
          <td className="numeric">{row.quantity}</td><td>{humanizeCode(row.urgency)}</td>
          <td><span className={statusClassName(row.status)}>{humanizeCode(row.status)}</span>{!row.ledger_transaction_id && <small>Awaiting ledger confirmation</small>}</td>
        </tr>)}</tbody></table></div>}
    </section>
    <section className="requester-dashboard-card" aria-labelledby="requester-network-heading">
      <header><div><h2 id="requester-network-heading">Network Blood Availability</h2>{!bankMode&&<p>Current available supply across participating blood banks.</p>}</div>{mayRequest && <a className="button primary compact" href={"/transfers?" + new URLSearchParams({newRequest:"1", bloodType, componentType:component}).toString()}>+ Request Blood</a>}</header>
      <div className="requester-network-body">
        <div className="requester-network-filters">
          <label><span>Blood Type</span><span className="requester-select"><select aria-label="Blood Type" value={bloodType} onChange={event => setBloodType(event.target.value)}>{V2_BLOOD_TYPES.map(type => <option key={type} value={type}>{type.replace("_POSITIVE", "+").replace("_NEGATIVE", "-")}</option>)}</select></span></label>
          <label><span>Component</span><span className="requester-select"><select aria-label="Component" value={component} onChange={event => setComponent(event.target.value)}>{V2_COMPONENT_TYPES.map(type => <option key={type} value={type}>{componentLabels[type]}</option>)}</select></span></label>
        </div>
        <div className={"requester-availability-result" + (available === null ? "" : available > 0 ? " has-supply" : " no-supply")} aria-live="polite">
          <div className="requester-availability-blood"><span className="requester-availability-type" aria-label={humanizeCode(bloodType)}>{formatBloodType(bloodType)}</span><span>{componentLabels[component]}</span></div>
          <div className="requester-availability-quantity"><strong aria-label={available === null ? "Unavailable" : undefined}>{available ?? "—"}</strong><span>network units available</span></div>
          <div className="requester-availability-status"><span className={available !== null && available > 0 ? "status success" : "status warning"}>{available === null ? "Availability unavailable" : available > 0 ? "Current supply available" : "No current supply"}</span><small>{available === null ? "Waiting for a confirmed network projection." : "Availability does not guarantee request approval."}</small></div>
        </div>
        <p className="requester-network-note">Source selection and approval are reviewed in the blood request workflow.</p>
      </div>
    </section>
  </div>;
}
