/** Append-only persistence for validated V5 simulation surplus evidence. */
import type { Pool } from "pg";
import { sha256 } from "./hash.js";

export interface PersistedSourceSurplusEvidenceV5 {
  schemaVersion: "SOURCE_SURPLUS_EVIDENCE_V5_SIMULATION_V1";
  evidenceId: string;
  sourceInstitutionId: string;
  bloodType: string;
  componentType: string;
  surplusQuantity: number;
  asOf: string;
  inventoryAsOf: string;
  originDate: string;
  horizonDate: string;
  forecastStatus: "AVAILABLE";
  datasetVersion: "SYNTHETIC_FORECAST_V5_RUNTIME_V1";
  forecastRunId: string;
  forecastId: string;
  modelVersion: "bloodledger-v5-series-mean-1.0.0";
  modelSha256: string;
  forecastPayloadSha256: string;
  optimizationPolicyVersion: "INTERVIEW_DERIVED_OPTIMIZATION_V2_1";
  configurationSha256: string;
  inventorySnapshotId: string;
  sourceProjectionDigest: string;
  classification: "SIMULATION_ONLY";
  recommendationEligibility: "DISABLED_UNAPPROVED_POLICY";
}

function identity(evidence: PersistedSourceSurplusEvidenceV5): string {
  return `SURP_${sha256({
    sourceInstitutionId: evidence.sourceInstitutionId, forecastId: evidence.forecastId,
    forecastRunId: evidence.forecastRunId, forecastPayloadSha256: evidence.forecastPayloadSha256,
    snapshotId: evidence.inventorySnapshotId, projectionDigest: evidence.sourceProjectionDigest,
    configurationSha256: evidence.configurationSha256, surplusQuantity: evidence.surplusQuantity,
  }).slice(0, 40).toUpperCase()}`;
}

function same(row: Record<string, unknown>, evidence: PersistedSourceSurplusEvidenceV5): boolean {
  return String(row.source_institution_id) === evidence.sourceInstitutionId &&
    String(row.blood_type) === evidence.bloodType && String(row.component_type) === evidence.componentType &&
    Number(row.surplus_quantity) === evidence.surplusQuantity &&
    new Date(String(row.as_of)).toISOString() === evidence.asOf &&
    new Date(String(row.inventory_as_of)).toISOString() === evidence.inventoryAsOf &&
    (row.origin_date instanceof Date ? row.origin_date.toISOString().slice(0, 10) : String(row.origin_date).slice(0, 10)) === evidence.originDate &&
    (row.horizon_date instanceof Date ? row.horizon_date.toISOString().slice(0, 10) : String(row.horizon_date).slice(0, 10)) === evidence.horizonDate &&
    String(row.forecast_status) === evidence.forecastStatus &&
    String(row.dataset_version) === evidence.datasetVersion &&
    String(row.forecast_run_id) === evidence.forecastRunId && String(row.forecast_id) === evidence.forecastId &&
    String(row.model_version) === evidence.modelVersion &&
    String(row.model_sha256) === evidence.modelSha256 &&
    String(row.forecast_payload_sha256) === evidence.forecastPayloadSha256 &&
    String(row.optimization_policy_version) === evidence.optimizationPolicyVersion &&
    String(row.configuration_sha256) === evidence.configurationSha256 &&
    String(row.inventory_snapshot_id) === evidence.inventorySnapshotId &&
    String(row.source_projection_digest) === evidence.sourceProjectionDigest &&
    String(row.classification) === evidence.classification &&
    String(row.recommendation_eligibility) === evidence.recommendationEligibility;
}

export class PostgresV5SourceSurplusEvidenceStore {
  constructor(private readonly pool: Pool) {}

  async save(evidence: PersistedSourceSurplusEvidenceV5): Promise<"INSERTED" | "EXISTING"> {
    if (evidence.schemaVersion !== "SOURCE_SURPLUS_EVIDENCE_V5_SIMULATION_V1" ||
        evidence.evidenceId !== identity(evidence) || evidence.datasetVersion !== "SYNTHETIC_FORECAST_V5_RUNTIME_V1" ||
        evidence.classification !== "SIMULATION_ONLY" || evidence.recommendationEligibility !== "DISABLED_UNAPPROVED_POLICY") throw new Error("V5_SURPLUS_EVIDENCE_INVALID");
    const inserted = await this.pool.query(`
      INSERT INTO app.v5_source_surplus_evidence (
        evidence_id,source_institution_id,blood_type,component_type,surplus_quantity,
        as_of,inventory_as_of,origin_date,horizon_date,forecast_status,dataset_version,
        forecast_run_id,forecast_id,model_version,model_sha256,forecast_payload_sha256,
        optimization_policy_version,configuration_sha256,inventory_snapshot_id,
        source_projection_digest,classification,recommendation_eligibility
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      ) ON CONFLICT (evidence_id) DO NOTHING RETURNING evidence_id`, [
        evidence.evidenceId, evidence.sourceInstitutionId, evidence.bloodType, evidence.componentType,
        evidence.surplusQuantity, evidence.asOf, evidence.inventoryAsOf, evidence.originDate,
        evidence.horizonDate, evidence.forecastStatus, evidence.datasetVersion, evidence.forecastRunId,
        evidence.forecastId, evidence.modelVersion, evidence.modelSha256, evidence.forecastPayloadSha256,
        evidence.optimizationPolicyVersion, evidence.configurationSha256, evidence.inventorySnapshotId,
        evidence.sourceProjectionDigest, evidence.classification, evidence.recommendationEligibility,
      ]);
    if (inserted.rowCount === 1) return "INSERTED";
    const existing = await this.pool.query<Record<string, unknown>>(
      "SELECT * FROM app.v5_source_surplus_evidence WHERE evidence_id=$1", [evidence.evidenceId],
    );
    if (!existing.rows[0] || !same(existing.rows[0], evidence)) throw new Error("V5_SURPLUS_EVIDENCE_CONFLICT");
    return "EXISTING";
  }
}
