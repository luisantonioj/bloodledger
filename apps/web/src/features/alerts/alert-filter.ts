export interface AlertFilterable { severity:string; status:string }
export interface AlertFilters { severity:string; status:string }

export function filterAlerts<T extends AlertFilterable>(items:T[], filters:AlertFilters):T[] {
  return items.filter((item) =>
    (filters.severity === "ALL" || item.severity === filters.severity) &&
    (filters.status === "ALL" || item.status === filters.status));
}

export function alertOptions<T extends AlertFilterable>(items:T[], key:keyof AlertFilterable):string[] {
  return [...new Set(items.map((item)=>item[key]))].sort();
}
