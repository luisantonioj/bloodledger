import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

const workspaceRoot = new URL("../", import.meta.url);
const packageRoot = new URL("../build/package/", import.meta.url);
await mkdir(new URL("dist/src/", packageRoot), { recursive: true });
await cp(new URL("build/compiled/src/", workspaceRoot), new URL("dist/src/", packageRoot), { recursive: true, force: true });

const runtimePackage = {
  name: "bloodledger-health",
  version: "0.1.0",
  private: true,
  main: "dist/src/index.js",
  engines: { node: ">=18" },
  scripts: { start: "fabric-chaincode-node start" },
  dependencies: {
    "fabric-contract-api": "2.5.8",
    "fabric-shim": "2.5.8",
  },
};
await writeFile(new URL("package.json", packageRoot), `${JSON.stringify(runtimePackage, null, 2)}\n`);
await writeFile(
  new URL("build/metadata.json", workspaceRoot),
  `${JSON.stringify({ path: "/health-contract/build/package", type: "node", label: "bloodledger-health_0.1.0" })}\n`,
);

const rootLock = JSON.parse(await readFile(new URL("../../package-lock.json", workspaceRoot), "utf8"));
if (rootLock.packages?.["network/health-contract"]?.dependencies?.["fabric-contract-api"] !== "2.5.8") {
  throw new Error("Root lockfile does not contain the approved fabric-contract-api 2.5.8 dependency");
}
console.log("Reproducible health-contract package staging prepared below ignored build output");
