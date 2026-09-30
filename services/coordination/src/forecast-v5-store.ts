/** Trusted V5 forecast reader: bind the row to its immutable run and institution. */
import type { Pool } from "pg";
import type { ForecastV5Evidence, TrustedV5ForecastReader } from "./surplus-v5.js";

export class PostgresV5ForecastEvidenceReader implements TrustedV5ForecastReader {
  constructor(private readonly pool: Pool) {}

  async get(forecastId: string, institutionId: string): Promise<ForecastV5Evidence | null> {
    const result = await this.pool.query<Record<string, unknown>>(`
      SELECT df.forecast_id, df.run_id, df.institution_id, df.blood_type, df.component,
        df.horizon_date::text AS horizon_date, df.point_forecast, df.forecast_status,
        fr.input_end_date::text AS origin_date, fr.generated_at,
        fr.dataset_version, fr.model_version, fr.run_status, fr.lineage,
        fr.classification, df.recommendation_eligibility
      FROM app.demand_forecasts df
      JOIN app.forecast_runs fr ON fr.run_id=df.run_id AND fr.institution_id=df.institution_id
      WHERE df.forecast_id=$1 AND df.institution_id=$2 AND fr.dataset_version='SYNTHETIC_FORECAST_V5_RUNTIME_V1'
        AND fr.run_id = (
          SELECT latest.run_id FROM app.forecast_runs latest
          WHERE latest.institution_id=$2
            AND latest.dataset_version='SYNTHETIC_FORECAST_V5_RUNTIME_V1'
            AND latest.horizon_date=df.horizon_date
          ORDER BY latest.generated_at DESC, latest.run_id DESC LIMIT 1
        )
    `, [forecastId, institutionId]);
    const row = result.rows[0];
    if (!row) return null;
    const lineage = row.lineage as Record<string, unknown> | null;
    return {
      forecastId: String(row.forecast_id), forecastRunId: String(row.run_id),
      institutionId: String(row.institution_id), bloodType: String(row.blood_type) as ForecastV5Evidence["bloodType"],
      componentType: String(row.component) as ForecastV5Evidence["componentType"],
      originDate: String(row.origin_date), horizonDate: String(row.horizon_date),
      pointForecast: Number(row.point_forecast), forecastStatus: String(row.forecast_status) as ForecastV5Evidence["forecastStatus"],
      generatedAt: new Date(String(row.generated_at)).toISOString(),
      datasetVersion: String(row.dataset_version) as ForecastV5Evidence["datasetVersion"],
      modelVersion: String(row.model_version) as ForecastV5Evidence["modelVersion"],
      modelSha256: String(lineage?.modelSha256 ?? ""), payloadSha256: String(lineage?.payloadSha256 ?? ""),
      runStatus: String(row.run_status) as ForecastV5Evidence["runStatus"],
      classification: String(row.classification) as ForecastV5Evidence["classification"],
      recommendationEligibility: String(row.recommendation_eligibility) as ForecastV5Evidence["recommendationEligibility"],
    };
  }
}
