export interface BankRequestRow {
  transfer_id:string;source_institution_id?:string;destination_institution_id:string;blood_type:string;component_type:string;quantity:number;urgency?:string|null;status:string;ledger_transaction_id:string|null;
}
export interface BankReservationRow {
  reservation_id:string;transfer_id:string|null;local_release_id?:string|null;purpose:string;status:string;version:number;institution_id?:string;destination_institution_id?:string|null;
}
// The legacy read independently limits requests/reservations. Missing joins stay unknown.
export function bankTransferSummary(reservation:BankReservationRow, requests:BankRequestRow[], institutionId:string) {
  const matching=reservation.purpose==="TRANSFER"&&reservation.transfer_id?requests.filter(row=>row.transfer_id===reservation.transfer_id&&typeof row.source_institution_id==="string"&&[row.source_institution_id,row.destination_institution_id].includes(institutionId)):[];
  const request=matching.length===1?matching[0]:undefined;
  const scoped=[reservation.institution_id,reservation.destination_institution_id].includes(institutionId);
  const consistent=request&&(!reservation.institution_id||request.source_institution_id===reservation.institution_id)&&(!reservation.destination_institution_id||request.destination_institution_id===reservation.destination_institution_id)?request:undefined;
  return {transferId:reservation.transfer_id,bloodType:consistent?.blood_type??null,componentType:consistent?.component_type??null,quantity:consistent&&Number.isSafeInteger(consistent.quantity)&&consistent.quantity>0?consistent.quantity:null,source:consistent?.source_institution_id??(scoped?reservation.institution_id??null:null),destination:consistent?.destination_institution_id??(scoped?reservation.destination_institution_id??null:null)};
}
