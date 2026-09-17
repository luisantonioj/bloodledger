import type { Pool } from "pg";

export interface PersistedSourceSurplusEvidenceV21 {
  evidenceId: string;
  sourceInstitutionId: string;
  bloodType: string;
  componentType: string;
  surplusQuantity: number;
  asOf: string;
  horizonDate: string;
  forecastStatus: "AVAILABLE" | "STALE" | "UNAVAILABLE";
  datasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1";
  forecastRunId: string;
  modelVersion: string;
  optimizationPolicyVersion: "INTERVIEW_DERIVED_OPTIMIZATION_V2_1";
  configurationSha256: string;
  inventorySnapshotId: string;
  sourceProjectionDigest: string;
  classification: "SIMULATION_ONLY";
  recommendationEligibility: "DISABLED_UNAPPROVED_POLICY";
}

function sameEvidence(row: Record<string, unknown>, evidence: PersistedSourceSurplusEvidenceV21): boolean {
  return String(row.source_institution_id) === evidence.sourceInstitutionId &&
    String(row.blood_type) === evidence.bloodType &&
    String(row.component_type) === evidence.componentType &&
    Number(row.surplus_quantity) === evidence.surplusQuantity &&
    new Date(String(row.as_of)).toISOString() === evidence.asOf &&
    String(row.horizon_date).slice(0, 10) === evidence.horizonDate &&
    String(row.forecast_status) === evidence.forecastStatus &&
    String(row.dataset_version) === evidence.datasetVersion &&
    String(row.forecast_run_id) === evidence.forecastRunId &&
    String(row.model_version) === evidence.modelVersion &&
    String(row.optimization_policy_version) === evidence.optimizationPolicyVersion &&
    String(row.configuration_sha256) === evidence.configurationSha256 &&
    String(row.inventory_snapshot_id) === evidence.inventorySnapshotId &&
    String(row.source_projection_digest) === evidence.sourceProjectionDigest &&
    String(row.classification) === evidence.classification &&
    String(row.recommendation_eligibility) === evidence.recommendationEligibility;
}

export class PostgresV2SourceSurplusEvidenceStore {
  constructor(private readonly pool: Pool) {}

  async save(evidence: PersistedSourceSurplusEvidenceV21): Promise<"INSERTED" | "EXISTING"> {
    const inserted = await this.pool.query(
      `INSERT INTO app.v2_source_surplus_evidence(
        evidence_id,source_institution_id,blood_type,component_type,surplus_quantity,as_of,horizon_date,
        forecast_status,model_version,classification,recommendation_eligibility,inventory_snapshot_id,
        source_projection_digest,forecast_run_id,dataset_version,optimization_policy_version,configuration_sha256
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT(evidence_id) DO NOTHING RETURNING evidence_id`,
      [evidence.evidenceId, evidence.sourceInstitutionId, evidence.bloodType, evidence.componentType, evidence.surplusQuantity, evidence.asOf, evidence.horizonDate, evidence.forecastStatus, evidence.modelVersion, evidence.classification, evidence.recommendationEligibility, evidence.inventorySnapshotId, evidence.sourceProjectionDigest, evidence.forecastRunId, evidence.datasetVersion, evidence.optimizationPolicyVersion, evidence.configurationSha256],
    );
    if (inserted.rowCount === 1) return "INSERTED";
    const existing = await this.pool.query<Record<string, unknown>>(
      `SELECT source_institution_id,blood_type,component_type,surplus_quantity,as_of,horizon_date,forecast_status,
        model_version,classification,recommendation_eligibility,inventory_snapshot_id,source_projection_digest,
        forecast_run_id,dataset_version,optimization_policy_version,configuration_sha256
       FROM app.v2_source_surplus_evidence WHERE evidence_id=$1`,
      [evidence.evidenceId],
    );
    if (!existing.rows[0] || !sameEvidence(existing.rows[0], evidence)) throw new Error("V2_SURPLUS_EVIDENCE_CONFLICT");
    return "EXISTING";
  }
}
