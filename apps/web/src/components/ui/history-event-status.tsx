import {humanizeCode} from "./display";
export const eventTone=(status:string)=>status==="CONFIRMED"?"confirmed":status==="FAILED"?"failed":status==="CONFLICT"?"conflict":status==="LEDGER_COMMITTED_PROJECTION_PENDING"?"projection-pending":status==="OFF_CHAIN_RECORDED"?"off-chain":"pending";
export function HistoryEventStatus({status,processingStatus,safeErrorCode}:{status:string;processingStatus:string|null;safeErrorCode:string|null}){
 return <span className={"history-event-status event-"+eventTone(status)} title={[processingStatus,safeErrorCode].filter(Boolean).join(" · ")||undefined}>{humanizeCode(status)}</span>;
}
