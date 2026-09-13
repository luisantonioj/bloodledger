import { describe, expect, it } from "vitest";
import { filterInventory, inventoryOptions } from "./inventory-filter";

const items=[
  {bloodType:"A_POSITIVE",component:"RED_BLOOD_CELLS",inventoryStatus:"AVAILABLE"},
  {bloodType:"O_POSITIVE",component:"PLATELETS",inventoryStatus:"RESERVED"},
  {bloodType:"A_POSITIVE",component:"PLATELETS",inventoryStatus:"AVAILABLE"},
];

describe("scoped inventory filters",()=>{
  it("filters only the already authorized result set",()=>expect(filterInventory(items,{bloodType:"A_POSITIVE",component:"ALL",status:"AVAILABLE"})).toHaveLength(2));
  it("derives deterministic filter options",()=>expect(inventoryOptions(items,"component")).toEqual(["PLATELETS","RED_BLOOD_CELLS"]));
});
