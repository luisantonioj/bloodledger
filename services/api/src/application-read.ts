export type InventoryStatus = "AVAILABLE" | "RESERVED" | "DISPATCHED" | "IN_TRANSIT" | "RECEIVED" | "COMPROMISED" | "EXPIRED";
export interface InventoryUnitView { unitId:string; institutionId:string; bloodType:string; component:string; collectedAt:string; expiresAt:string; inventoryStatus:InventoryStatus; ledgerVersion:number; ledgerTransactionId:string; projectedAt:string; classification:"SIMULATION_ONLY" }
export interface InventoryAggregateView { institutionId:string; institutionDisplayName:string; bloodType:string; component:string; inventoryStatus:InventoryStatus; confirmedCount:number; lastProjectedAt:string }
export interface PendingScanCount { status:string; count:number }
export interface AlertView { alertId:string; institutionId:string; alertType:string; severity:string; unitId:string|null; bloodType:string|null; component:string|null; inventoryStatus:string|null; expiresAt:string|null; evaluatedAt:string; status:string; acknowledged:boolean; policyVersion:string; classification:"SIMULATION_ONLY" }
export interface AlertAggregateView { institutionId:string; institutionDisplayName:string; alertType:string; severity:string; status:string; count:number; lastEvaluatedAt:string }
export interface AuditEventView { auditEventId:string; institutionId:string; institutionDisplayName:string; actionCode:string; targetType:string; outcome:string; safeErrorCode:string|null; correlationId:string; ledgerTransactionId:string|null; eventTime:string; classification:"SIMULATION_ONLY" }
export interface TransferView { transferId:string; sourceInstitutionId:string; destinationInstitutionId:string; bloodType:string; component:string; quantity:number; urgency:string; requestTime:string; status:string; reasonCode:string|null; ledgerVersion:number; ledgerTransactionId:string; correlationId:string; projectedAt:string; dispatchEvidenceRecorded:boolean; receiptEvidenceRecorded:boolean; classification:"SIMULATION_ONLY" }
export interface ApplicationReadRepository {
  listInventoryUnits(institutionId:string):Promise<InventoryUnitView[]>;
  listInventoryAggregates(institutionId?:string):Promise<InventoryAggregateView[]>;
  listPendingScans(institutionId?:string):Promise<PendingScanCount[]>;
  listAlerts(institutionId:string,userId:string):Promise<AlertView[]>;
  listAlertAggregates():Promise<AlertAggregateView[]>;
  listTransfers(institutionId?:string,perspective?:"SOURCE"|"DESTINATION"):Promise<TransferView[]>;
  listAuditEvents(institutionId?:string):Promise<AuditEventView[]>;
}
