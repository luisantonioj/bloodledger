export type InventoryStatus = "AVAILABLE" | "RESERVED" | "DISPATCHED" | "IN_TRANSIT" | "RECEIVED" | "COMPROMISED" | "EXPIRED";
export interface InventoryUnitView { unitId:string; institutionId:string; bloodType:string; component:string; collectedAt:string; expiresAt:string; inventoryStatus:InventoryStatus; ledgerVersion:number; ledgerTransactionId:string; projectedAt:string; classification:"SIMULATION_ONLY" }
export interface InventoryAggregateView { institutionId:string; institutionDisplayName:string; bloodType:string; component:string; inventoryStatus:InventoryStatus; confirmedCount:number; lastProjectedAt:string }
export interface PendingScanCount { status:string; count:number }
export interface ApplicationReadRepository {
  listInventoryUnits(institutionId:string):Promise<InventoryUnitView[]>;
  listInventoryAggregates(institutionId?:string):Promise<InventoryAggregateView[]>;
  listPendingScans(institutionId?:string):Promise<PendingScanCount[]>;
}
