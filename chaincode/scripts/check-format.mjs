import { readFile } from "node:fs/promises";

const jsonFiles = [
  "package.json",
  "policy/synthetic-inventory-v1.json",
  "policy/synthetic-transfer-v1.json",
  "tsconfig.json",
];
for (const file of jsonFiles) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  if (source !== `${JSON.stringify(JSON.parse(source), null, 2)}\n`) {
    throw new Error(`${file} must use two-space JSON formatting`);
  }
}
console.log("Inventory-contract formatting checks passed");
