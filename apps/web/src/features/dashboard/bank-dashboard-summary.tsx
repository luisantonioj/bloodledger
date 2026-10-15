import type {Principal} from "../../auth/permissions";
import {useValidatedRead} from "../../hooks/use-validated-read";
import {parseBankSummary} from "../../services/api/blood-bank-completion";
import {useStockEvidence} from "./use-stock-evidence";
import {classifyStock,stockClassificationPolicy} from "./stock-classification";
export function BankDashboardSummary({principal}:{principal:Principal}){
 const summary=useValidatedRead("/api/v2/dashboard/summary",parseBankSummary),stock=useStockEvidence(principal.institutionId,summary.data?.asOf);
 const low=stock.counts?stockClassificationPolicy.series.filter(row=>["critical","low"].includes(classifyStock(row.bloodType,row.componentType,stock.counts!.get(row.bloodType+":"+row.componentType)??0)??"")).length:null;
 const cards=[{label:"Total Blood Units",value:summary.data?summary.data.inventory.available+summary.data.inventory.reserved:null,note:"Label-current available + reserved"},{label:"Expiring Soon",value:null,note:"Unavailable · RQ-03: no approved near-expiry policy"},{label:"Low Stock",value:low,note:"Demo bands · Critical or Low series"},{label:"Pending Requests",value:summary.data?.requests.incomingAwaitingDecision??null,note:"Awaiting your decision"}];
 return <><div className="stats dashboard-stats">{cards.map(card=><article key={card.label}><span>{card.label}</span><strong aria-label={card.value===null?"Unavailable":undefined}>{card.value??"—"}</strong><small>{card.note}</small></article>)}</div>{summary.error&&<p role="status">Dashboard summary unavailable. {summary.error}</p>}{summary.data&&<p className="bank-action-note"><a href="/inventory?expiryState=LABEL_EXPIRED_PENDING_EVALUATION">Label expired, awaiting evaluation: {summary.data.inventory.labelExpiredPendingEvaluation}</a></p>}</>;
}
