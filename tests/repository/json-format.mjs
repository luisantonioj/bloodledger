import { readFile } from "node:fs/promises";

const files = [
  "package.json",
  "package-lock.json",
  "database/package.json",
  "network/health-contract/package.json",
  "network/health-contract/tsconfig.json",
];

for (const file of files) {
  const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
  const formatted = `${JSON.stringify(JSON.parse(source), null, 2)}\n`;
  if (source !== formatted) {
    throw new Error(`${file} is not formatted with two-space JSON indentation`);
  }
}

console.log(`JSON formatting proven for ${files.join(", ")}`);
