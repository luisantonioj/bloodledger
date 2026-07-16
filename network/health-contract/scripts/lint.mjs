import { readFile } from "node:fs/promises";

const files = ["src/health-contract.ts", "src/index.ts", "test/health-contract.test.ts", "scripts/probe.ts"];
for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  if (source.includes("\t") || source.split("\n").some((line) => / +$/.test(line))) {
    throw new Error(`${file} contains tabs or trailing whitespace`);
  }
}
console.log("Health-contract lint checks passed");
