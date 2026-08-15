import { Pool, type PoolConfig } from "pg";
import { fail } from "./errors.js";
import type { LocationEvidence } from "./location.js";
import { stableJson } from "./hash.js";

export interface AlgorithmRun {
  runId: string;
  algorithm: "RPS" | "BROA";
  algorithmVersion: string;
  classification: "SIMULATION_ONLY";
  recommendationEligibility: "DISABLED_UNAPPROVED_POLICY";
  inputSha256: string;
  configSha256: string;
  recommendationDigest?: string;
  evaluationTime: string;
}

function databaseConfig(): PoolConfig {
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_APP_USER;
  const password = process.env.POSTGRES_APP_PASSWORD;
  const portText = process.env.POSTGRES_PORT ?? process.env.POSTGRES_HOST_PORT ?? "5432";
  const port = /^\d+$/.test(portText) ? Number(portText) : Number.NaN;
  if (database === undefined || user === undefined || password === undefined) {
    fail("COORD_DATABASE_CONFIGURATION_MISSING");
  }
  if (user !== "bloodledger_app" || !Number.isInteger(port) || port < 1 || port > 65_535) {
    fail("COORD_DATABASE_CONFIGURATION_INVALID");
  }
  return {
    host: process.env.POSTGRES_HOST ?? "127.0.0.1",
    port,
    database,
    user,
    password,
  };
}

export function createRuntimePool(): Pool {
  return new Pool(databaseConfig());
}

export async function persistLocationEvidence(pool: Pool, evidence: LocationEvidence): Promise<"INSERTED" | "EXISTING"> {
  const inserted = await pool.query<{ evidence_id: string }>(
    `INSERT INTO app.location_evidence (
       evidence_id, evidence_digest, institution_id, phase, latitude, longitude,
       accuracy_metres, capture_source, fallback_reason, captured_at,
       facility_matched, fallback, policy_version, classification, delete_after
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (evidence_id) DO NOTHING RETURNING evidence_id`,
    [
      evidence.evidenceId, evidence.evidenceDigest, evidence.institutionId, evidence.phase,
      evidence.latitude, evidence.longitude, evidence.accuracyMetres, evidence.source,
      evidence.fallbackReason, evidence.capturedAt, evidence.facilityMatched, evidence.fallback,
      evidence.policyVersion, evidence.classification, evidence.deleteAfter,
    ],
  );
  if (inserted.rowCount === 1) return "INSERTED";
  const existing = await pool.query<{ evidence_digest: string }>(
    "SELECT evidence_digest FROM app.location_evidence WHERE evidence_id = $1",
    [evidence.evidenceId],
  );
  if (existing.rows[0]?.evidence_digest === evidence.evidenceDigest) return "EXISTING";
  fail("COORD_LOCATION_EVIDENCE_CONFLICT");
}

export async function persistAlgorithmRun(
  pool: Pool,
  run: AlgorithmRun,
  evidence: unknown,
): Promise<"INSERTED" | "EXISTING"> {
  const evidenceJson = stableJson(evidence);
  const inserted = await pool.query<{ run_id: string }>(
    `INSERT INTO app.algorithm_runs (
       run_id, algorithm_name, algorithm_version, classification,
       recommendation_eligibility, input_sha256, config_sha256,
       recommendation_digest, evaluation_time, evidence
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (run_id) DO NOTHING RETURNING run_id`,
    [
      run.runId, run.algorithm, run.algorithmVersion, run.classification,
      run.recommendationEligibility, run.inputSha256, run.configSha256,
      run.recommendationDigest ?? null, run.evaluationTime, evidenceJson,
    ],
  );
  if (inserted.rowCount === 1) return "INSERTED";
  const existing = await pool.query<{
    input_sha256: string;
    config_sha256: string;
    recommendation_digest: string | null;
  }>(
    `SELECT input_sha256, config_sha256, recommendation_digest
       FROM app.algorithm_runs WHERE run_id = $1`,
    [run.runId],
  );
  const row = existing.rows[0];
  if (row !== undefined && row.input_sha256 === run.inputSha256 &&
      row.config_sha256 === run.configSha256 &&
      row.recommendation_digest === (run.recommendationDigest ?? null)) return "EXISTING";
  fail("COORD_ALGORITHM_RUN_CONFLICT");
}

export async function purgeExpiredLocationEvidence(pool: Pool, asOf: string): Promise<number> {
  const milliseconds = Date.parse(asOf);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== asOf) {
    fail("COORD_TIME_INVALID");
  }
  const result = await pool.query<{ deleted_count: string }>(
    "SELECT app.purge_expired_synthetic_location_evidence($1) AS deleted_count",
    [asOf],
  );
  return Number(result.rows[0]?.deleted_count ?? 0);
}
