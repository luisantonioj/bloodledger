import assert from "node:assert/strict";
import test from "node:test";
import { csvCell } from "../src/csv.js";

test("CSV cells quote delimiters and neutralize spreadsheet formula prefixes",()=>{
  assert.equal(csvCell("Synthetic, Hospital"),'"Synthetic, Hospital"');
  assert.equal(csvCell('Synthetic "Hospital"'),'"Synthetic ""Hospital"""');
  for(const value of ["=1+1","+CMD","-2+3","@SUM(A1:A2)"," \t=1+1"])assert.equal(csvCell(value).startsWith('"\''),true);
});
