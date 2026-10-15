import type {UnitHistoryRow} from "../../services/api/transaction-reads";
import {labelText} from "../../services/api/label-identity";
import {formatManilaDateTime,formatBloodType,humanizeCode} from "../../components/ui/display";
import {componentLabel} from "../transfers/requester-transfer-data";
export const unitHistoryHeaders=["Time","Type","Scan ID","Transaction ID","Unit ID","Blood","Method","Status","Blockchain ID"];
export const unitIdentity=(row:UnitHistoryRow)=>row.unitMembership==="UNAVAILABLE"?"Units not recorded":labelText(row.labelIdentity);
export const unitBlood=(row:UnitHistoryRow)=>[row.bloodType?formatBloodType(row.bloodType):null,row.componentType?componentLabel(row.componentType):null].filter(Boolean).join(" · ")||"Not available";
export const unitHistoryRows=(rows:UnitHistoryRow[])=>rows.map(row=>[row.eventTime?formatManilaDateTime(row.eventTime):"—",humanizeCode(row.direction),row.scanId??"—",row.transactionId,unitIdentity(row),unitBlood(row),row.method??"Not recorded",humanizeCode(row.eventStatus),row.ledger.transactionId??"Not committed"]);
export const unitHistoryMatches=(row:UnitHistoryRow,query:string)=>[row.scanId,row.transactionId,unitIdentity(row),row.componentId,unitBlood(row),row.method,row.direction,row.eventStatus,row.processingStatus,row.safeErrorCode,row.ledger.transactionId,...Object.values(row.links)].some(value=>value?.toLowerCase().includes(query));
