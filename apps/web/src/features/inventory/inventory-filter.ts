export interface InventoryFilterable {
  bloodType:string;
  component:string;
  inventoryStatus:string;
}

export interface InventoryFilters {
  bloodType:string;
  component:string;
  status:string;
}

export function filterInventory<T extends InventoryFilterable>(items:T[], filters:InventoryFilters):T[] {
  return items.filter((item) =>
    (filters.bloodType === "ALL" || item.bloodType === filters.bloodType) &&
    (filters.component === "ALL" || item.component === filters.component) &&
    (filters.status === "ALL" || item.inventoryStatus === filters.status));
}

export function inventoryOptions<T extends InventoryFilterable>(items:T[], key:keyof InventoryFilterable):string[] {
  return [...new Set(items.map((item) => item[key]))].sort();
}
