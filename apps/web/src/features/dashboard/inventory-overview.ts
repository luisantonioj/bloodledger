import type { Aggregate } from "../../services/api/types";
import { V2_COMPONENT_TYPES } from "../../services/api/v2";

export const bloodTypeOrder = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
] as const;

export type InventoryOverviewItem = {
  bloodType: string;
  confirmed: number;
  available: number;
};

export function summarizeInventoryByBloodType(items: Aggregate[]): InventoryOverviewItem[] {
  const totals = new Map<string, { confirmed: number; available: number }>();

  for (const item of items) {
    const current = totals.get(item.bloodType) ?? { confirmed: 0, available: 0 };
    current.confirmed += item.confirmedCount;
    if (item.inventoryStatus === "AVAILABLE") current.available += item.confirmedCount;
    totals.set(item.bloodType, current);
  }

  const known = bloodTypeOrder.map((bloodType) => ({
    bloodType,
    confirmed: totals.get(bloodType)?.confirmed ?? 0,
    available: totals.get(bloodType)?.available ?? 0,
  }));
  const additional = [...totals.entries()]
    .filter(([bloodType]) => !bloodTypeOrder.includes(bloodType as (typeof bloodTypeOrder)[number]))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bloodType, counts]) => ({ bloodType, ...counts }));

  return [...known, ...additional];
}

// FR-03: keep products separate, including legacy codes reported by older contracts.
export function inventoryOverviewComponents(items: Aggregate[]): string[] {
  const additional = [...new Set(items.map(item => item.component))]
    .filter(component => !V2_COMPONENT_TYPES.some(known => known === component))
    .sort();
  return [...V2_COMPONENT_TYPES, ...additional];
}

export function summarizeInventoryByComponent(items: Aggregate[], component: string) {
  const components = component === "ALL" ? inventoryOverviewComponents(items) : [component];
  const summaries = components.map(product => ({
    component: product,
    items: summarizeInventoryByBloodType(items.filter(item => item.component === product)),
  }));
  return summarizeInventoryByBloodType(items).map(({ bloodType }) => ({
    bloodType,
    components: summaries.map(summary => ({
      component: summary.component,
      confirmed: summary.items.find(item => item.bloodType === bloodType)?.confirmed ?? 0,
      available: summary.items.find(item => item.bloodType === bloodType)?.available ?? 0,
    })),
  }));
}
