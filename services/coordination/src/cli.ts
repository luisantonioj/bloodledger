#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { recommendBroa, type BroaInput } from "./broa.js";
import { CoordinationError, fail } from "./errors.js";
import { captureLocationEvidence, type LocationCaptureInput } from "./location.js";
import {
  createRuntimePool,
  persistAlgorithmRun,
  persistLocationEvidence,
  purgeExpiredLocationEvidence,
} from "./persistence.js";
import { validatePolicies } from "./policies.js";
import { rankRps, type RpsInput } from "./rps.js";

function option(arguments_: string[], name: string, required = true): string | undefined {
  const index = arguments_.indexOf(name);
  const value = index >= 0 ? arguments_[index + 1] : undefined;
  if (required && (value === undefined || value.startsWith("--"))) fail("COORD_ARGUMENT_INVALID");
  return value;
}

async function readJson<T>(file: string | undefined): Promise<T> {
  if (file === undefined) fail("COORD_ARGUMENT_INVALID");
  try {
    return JSON.parse(await readFile(resolve(file), "utf8")) as T;
  } catch {
    fail("COORD_INPUT_INVALID");
  }
}

async function execute(arguments_: string[]): Promise<unknown> {
  const command = arguments_[0];
  validatePolicies();
  if (command === "validate-policy") {
    return { status: "VALID", policies: ["SYNTHETIC_LOCATION_V1", "SYNTHETIC_OPTIMIZATION_V1"] };
  }
  if (command === "capture-location-evidence") {
    const evidence = captureLocationEvidence(await readJson<LocationCaptureInput>(option(arguments_, "--input")));
    let persistence = "NOT_REQUESTED";
    if (arguments_.includes("--persist")) {
      const pool = createRuntimePool();
      try { persistence = await persistLocationEvidence(pool, evidence); } finally { await pool.end(); }
    }
    return { ...evidence, persistence };
  }
  if (command === "rank-rps") {
    const run = rankRps(await readJson<RpsInput>(option(arguments_, "--input")));
    let persistence = "NOT_REQUESTED";
    if (arguments_.includes("--persist")) {
      const pool = createRuntimePool();
      try { persistence = await persistAlgorithmRun(pool, run, run); } finally { await pool.end(); }
    }
    return { ...run, persistence };
  }
  if (command === "recommend-broa") {
    const run = recommendBroa(await readJson<BroaInput>(option(arguments_, "--input")));
    let persistence = "NOT_REQUESTED";
    if (arguments_.includes("--persist")) {
      const pool = createRuntimePool();
      try { persistence = await persistAlgorithmRun(pool, run, run); } finally { await pool.end(); }
    }
    return { ...run, persistence };
  }
  if (command === "purge-expired-location-evidence") {
    const pool = createRuntimePool();
    try {
      return { status: "PURGED", deletedCount: await purgeExpiredLocationEvidence(pool, option(arguments_, "--as-of") ?? "") };
    } finally { await pool.end(); }
  }
  fail("COORD_COMMAND_INVALID");
}

execute(process.argv.slice(2)).then(
  (result) => { process.stdout.write(`${JSON.stringify(result)}\n`); },
  (error: unknown) => {
    const code = error instanceof CoordinationError ? error.code : "COORD_INTERNAL_ERROR";
    process.stderr.write(`${JSON.stringify({ status: "FAILED", errorCode: code })}\n`);
    process.exitCode = 2;
  },
);
