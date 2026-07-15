import { readFile } from "node:fs/promises";

const rootUrl = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, rootUrl), "utf8");
const parse = async (path) => JSON.parse(await read(path));
const assertEqual = (actual, expected, label) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
};
const assertContains = (source, expected, label) => {
  if (!source.includes(expected)) {
    throw new Error(`${label}: missing ${expected}`);
  }
};

const expected = {
  node: "24.17.0",
  npm: "11.13.0",
  nodePgMigrate: "8.0.4",
  pg: "8.22.0",
  gitleaks: "8.30.1"
};

const [rootPackage, databasePackage, lockfile, nvmrc, nodeVersion, architecture,
  localDevelopment, databaseReadme, scanner] = await Promise.all([
  parse("package.json"),
  parse("database/package.json"),
  parse("package-lock.json"),
  read(".nvmrc"),
  read(".node-version"),
  read("docs/ARCHITECTURE.md"),
  read("docs/LOCAL-DEVELOPMENT.md"),
  read("database/README.md"),
  read("scripts/scan-secrets.sh")
]);

assertEqual(rootPackage.engines.node, expected.node, "package.json Node engine");
assertEqual(rootPackage.engines.npm, expected.npm, "package.json npm engine");
assertEqual(rootPackage.packageManager, `npm@${expected.npm}`, "package manager");
assertEqual(nvmrc.trim(), expected.node, ".nvmrc");
assertEqual(nodeVersion.trim(), expected.node, ".node-version");
assertEqual(databasePackage.devDependencies["node-pg-migrate"], expected.nodePgMigrate,
  "database node-pg-migrate dependency");
assertEqual(databasePackage.devDependencies.pg, expected.pg, "database pg dependency");
assertEqual(lockfile.packages["database"].devDependencies["node-pg-migrate"],
  expected.nodePgMigrate, "lockfile node-pg-migrate declaration");
assertEqual(lockfile.packages["database"].devDependencies.pg, expected.pg,
  "lockfile pg declaration");
assertEqual(lockfile.packages["node_modules/node-pg-migrate"].version,
  expected.nodePgMigrate, "resolved node-pg-migrate");
assertEqual(lockfile.packages["node_modules/pg"].version, expected.pg, "resolved pg");

for (const source of [architecture, localDevelopment]) {
  assertContains(source, expected.node, "Node documentation");
  assertContains(source, expected.npm, "npm documentation");
  assertContains(source, expected.gitleaks, "Gitleaks documentation");
}
for (const source of [architecture, localDevelopment, databaseReadme]) {
  assertContains(source, expected.nodePgMigrate, "node-pg-migrate documentation");
  assertContains(source, expected.pg, "pg documentation");
}
assertContains(scanner, `GITLEAKS_VERSION=\"${expected.gitleaks}\"`,
  "scanner version pin");
assertContains(scanner, `ghcr.io/gitleaks/gitleaks:v\${GITLEAKS_VERSION}`,
  "official scanner image pin");

console.log("Version consistency proven for Node, npm, migration packages, and Gitleaks");
