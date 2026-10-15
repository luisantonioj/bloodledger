// Legacy request read remains for Blood Requests, redistribution review and detail links.
export interface BankRequestRow {transfer_id:string;source_institution_id?:string;destination_institution_id:string;blood_type:string;component_type:string;quantity:number;urgency?:string|null;status:string;ledger_transaction_id:string|null}
export interface BankReservationRow {reservation_id:string;transfer_id:string|null;local_release_id?:string|null;purpose:string;status:string;version:number;institution_id?:string;destination_institution_id?:string|null}
