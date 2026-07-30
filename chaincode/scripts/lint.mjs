import { readFile } from "node:fs/promises";

const files = [
  "scripts/prepare-package.mjs",
  "scripts/validate-network.ts",
  "src/index.ts",
  "src/inventory-contract.ts",
  "test/inventory-contract.test.ts",
];
for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  if (source.includes("\t") || source.split("\n").some((line) => / +$/.test(line))) {
    throw new Error(`${file} contains tabs or trailing whitespace`);
  }
}
console.log("Inventory-contract lint checks passed");
