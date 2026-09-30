// FR-14 / BR-ALG-07: persisted V5 forecast + committed census -> surplus -> BROA.
import assert from "node:assert/strict";
import { createPoolFromEnvironment, PostgresScanRepository } from "../../services/api/build/src/database.js";
import { PostgresMlInventorySnapshotStore } from "../../services/api/build/src/census-worker.js";
import { PostgresV5SourceSurplusEvidenceStore } from "../../services/api/build/src/source-surplus-v5-store.js";
import { PostgresV5ForecastEvidenceReader } from "../../services/coordination/build/src/forecast-v5-store.js";
import { produceSourceSurplusEvidenceV5FromStore } from "../../services/coordination/build/src/surplus-v5.js";
import { recommendBroaV5FromStore } from "../../services/coordination/build/src/broa-v5.js";

const pool = createPoolFromEnvironment();
try {
  const institutionId = "INST_MEDIATRIX";
  const evaluationTime = "2026-09-30T04:00:00.000Z";
  const repository = new PostgresScanRepository(pool);
  const forecastRead = await repository.readForecasts(institutionId, "2026-09-30", "SYNTHETIC_FORECAST_V5_RUNTIME_V1", "2026-09-30");
  assert.equal(forecastRead.status, "CURRENT");
  const forecast = forecastRead.forecasts.find((item) => item.bloodType === "A_POSITIVE" && item.component === "CRYOPRECIPITATE");
  assert.ok(forecast);
  const snapshotStore = new PostgresMlInventorySnapshotStore(pool);
  const forecastReader = new PostgresV5ForecastEvidenceReader(pool);
  const superseded = await pool.query("SELECT forecast_id FROM app.demand_forecasts WHERE horizon_date='2026-09-29'::date LIMIT 1");
  assert.ok(superseded.rows[0]);
  assert.equal(await forecastReader.get(superseded.rows[0].forecast_id, institutionId), null);
  const snapshot = await snapshotStore.capture(institutionId, new Date("2026-09-30T01:00:00.000Z"), "MANUAL", new Date(evaluationTime));
  assert.equal(snapshot.snapshotKind, "INTERNAL_ML");
  const stock = snapshot.groups.find((group) => group.componentType === "CRYOPRECIPITATE").bloodTypes.find((item) => item.bloodType === "A_POSITIVE");
  assert.equal(stock.forecastEligibleAvailableCount, 30);
  const inputs = {
    sourceInstitutionId: institutionId, evaluationTime,
    forecastId: forecast.forecastId, inventorySnapshotId: snapshot.snapshotId,
    sourceProjectionDigest: snapshot.sourceProjectionDigest,
    snapshotReader: snapshotStore, forecastReader,
  };
  const evidence = await produceSourceSurplusEvidenceV5FromStore(inputs);
  assert.equal(evidence.surplusQuantity, Math.max(0, Math.floor(30 - forecast.pointForecast - 2 - 10)));
  assert.equal(evidence.modelSha256, forecastRead.lineage.modelSha256);
  const store = new PostgresV5SourceSurplusEvidenceStore(pool);
  assert.equal(await store.save(evidence), "INSERTED");
  assert.equal(await store.save(evidence), "EXISTING");
  const candidates = [{ destinationInstitutionId: "INST_METRO_LIPA", sourceInstitutionId: institutionId, bloodType: forecast.bloodType, componentType: forecast.component, urgency: 1, stockShortage: 2, distanceKm: 4, eligible: true }];
  const broa = await recommendBroaV5FromStore({ ...inputs, requiredQuantity: 2, candidates });
  assert.equal(broa.automaticApproval, false);
  assert.equal(broa.recommendationEligibility, "DISABLED_UNAPPROVED_POLICY");
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore({ ...inputs, sourceProjectionDigest: "f".repeat(64) }), /COORD_V5_INVENTORY_INVALID/);
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore({ ...inputs, evaluationTime: "2026-10-01T04:00:00.000Z" }), /COORD_V5_FORECAST_INVALID/);
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore({ ...inputs, sourceInstitutionId: "INST_METRO_LIPA" }), /COORD_V5_EVIDENCE_UNAVAILABLE/);
  await assert.rejects(pool.query(`
    INSERT INTO app.v5_source_surplus_evidence (
      evidence_id,source_institution_id,blood_type,component_type,surplus_quantity,
      as_of,inventory_as_of,origin_date,horizon_date,forecast_status,dataset_version,
      forecast_run_id,forecast_id,model_version,model_sha256,forecast_payload_sha256,
      optimization_policy_version,configuration_sha256,inventory_snapshot_id,
      source_projection_digest,classification,recommendation_eligibility
    ) SELECT $1,'INST_METRO_LIPA',blood_type,component_type,surplus_quantity,
      as_of,inventory_as_of,origin_date,horizon_date,forecast_status,dataset_version,
      forecast_run_id,forecast_id,model_version,model_sha256,forecast_payload_sha256,
      optimization_policy_version,configuration_sha256,inventory_snapshot_id,
      source_projection_digest,classification,recommendation_eligibility
      FROM app.v5_source_surplus_evidence WHERE evidence_id=$2
  `, [`SURP_${"F".repeat(40)}`, evidence.evidenceId]), (error) => error.code === "P0001" && error.message === "V5_SURPLUS_EVIDENCE_MISMATCH");
  console.log("V5 trusted forecast + committed census -> scoped surplus -> non-approving BROA passed");
} finally {
  await pool.end();
}
