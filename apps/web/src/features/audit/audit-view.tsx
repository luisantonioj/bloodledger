import { formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import type { Audit } from "../../services/api/types";

export function AuditView({data}:{data:Audit}) {
  if(data.events.length===0)return <div className="empty"><strong>No audit events</strong>No permitted redacted application event is available for this scope.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Institution</th><th>Action</th><th>Target</th><th>Outcome</th><th>Correlation</th><th>Ledger reference</th><th>Time</th></tr></thead><tbody>{data.events.map(item=><tr key={item.auditEventId}><td>{item.institutionDisplayName}</td><td>{humanizeCode(item.actionCode)}</td><td>{humanizeCode(item.targetType)}</td><td><span className={statusClassName(item.outcome)}>{humanizeCode(item.outcome)}</span>{item.safeErrorCode?" - "+humanizeCode(item.safeErrorCode):""}</td><td className="mono">{item.correlationId}</td><td className="mono">{item.ledgerTransactionId??"Not applicable"}</td><td>{formatManilaDateTime(item.eventTime)}</td></tr>)}</tbody></table></div>;
}
