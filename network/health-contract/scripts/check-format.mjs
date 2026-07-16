import { readFile } from "node:fs/promises";

const files = ["package.json", "tsconfig.json"];
for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  if (source !== `${JSON.stringify(JSON.parse(source), null, 2)}\n`) {
    throw new Error(`${file} must use two-space JSON formatting`);
  }
}
console.log("Health-contract formatting checks passed");
