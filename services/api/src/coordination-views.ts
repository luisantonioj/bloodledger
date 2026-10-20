// TP-JOP-D07 / FR-06 / FR-07 / FR-14: read-only decision-support views over live V2 data.
// Every view is SIMULATION_ONLY and DISABLED_UNAPPROVED_POLICY; nothing here approves, reserves or dispatches.
// The algorithms come unchanged from @bloodledger/coordination; this module only gathers inputs and shapes output.
import type { Pool } from "pg";
import { rankRpsV2 } from "@bloodledger/coordination/build/src/rps-v2.js";
import { produceSourceSurplusEvidenceV5FromStore, type ForecastV5Evidence, type SourceSurplusEvidenceV5, type TrustedV5ForecastReader } from "@bloodledger/coordination/build/src/surplus-v5.js";
import type { CensusV21Snapshot, TrustedCensusSnapshotReader } from "@bloodledger/coordination/build/src/surplus-v21.js";
import { recommendBroaV5 } from "@bloodledger/coordination/build/src/broa-v5.js";
import { PostgresV5ForecastEvidenceReader } from "@bloodledger/coordination/build/src/forecast-v5-store.js";
import rpsPolicy from "@bloodledger/coordination/policy/interview-derived-optimization-v2.json" with { type: "json" };
import optimizationPolicy from "@bloodledger/coordination/policy/interview-derived-optimization-v2-1.json" with { type: "json" };
import candidatePolicy from "../policy/synthetic-broa-candidates-v1.json" with { type: "json" };

export const COORDINATION_BLOOD_TYPES = ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"] as const;
export const COORDINATION_COMPONENT_TYPES = ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS", "CRYOPRECIPITATE"] as const;
type BloodType = (typeof COORDINATION_BLOOD_TYPES)[number];
type ComponentType = (typeof COORDINATION_COMPONENT_TYPES)[number];
type Urgency = "ROUTINE" | "URGENT" | "CRITICAL";

export interface PendingRequestRow { transferId: string; sourceInstitutionId: string; destinationInstitutionId: string; urgency: Urgency; requestTime: string; quantity: number; }
export interface CensusHeader { snapshotId: string; capturedAt: string; sourceProjectionDigest: string; }
export interface CoordinationReader {
  pendingRequests(input: { bloodType: string; componentType: string; sourceInstitutionId?: string }): Promise<PendingRequestRow[]>;
  v5ForecastIds(institutionId: string, horizonDate: string): Promise<string[]>;
  latestCensus(institutionId: string, before: Date): Promise<CensusHeader | null>;
  readonly snapshotReader: TrustedCensusSnapshotReader;
  readonly forecastReader: TrustedV5ForecastReader;
}

interface MlSnapshotStoreLike {
  get(snapshotId: string, institutionId: string): Promise<unknown>;
  latest(institutionId: string, before: Date): Promise<CensusHeader | null>;
}

export class PostgresCoordinationReader implements CoordinationReader {
  readonly forecastReader: TrustedV5ForecastReader;
  readonly snapshotReader: TrustedCensusSnapshotReader;
  constructor(private readonly pool: Pool, private readonly mlSnapshots: MlSnapshotStoreLike) {
    this.forecastReader = new PostgresV5ForecastEvidenceReader(pool);
    // The ML store recomputes and verifies each snapshot's projection digest before returning it.
    this.snapshotReader = { get: async (snapshotId, institutionId) => (await mlSnapshots.get(snapshotId, institutionId)) as CensusV21Snapshot | null };
  }

  async pendingRequests(input: { bloodType: string; componentType: string; sourceInstitutionId?: string }): Promise<PendingRequestRow[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      // ADR-046: raw PENDING survives approval. Any recorded reservation means the request
      // has already had its decision; cancelling that reservation does not reopen the request.
      `SELECT t.transfer_id,t.source_institution_id,t.destination_institution_id,t.urgency,t.request_time,t.quantity
       FROM app.v2_transfer_requests t
       WHERE t.status='PENDING' AND t.blood_type=$1 AND t.component_type=$2
         AND ($3::text IS NULL OR t.source_institution_id=$3)
         AND NOT EXISTS (SELECT 1 FROM app.v2_reservations r WHERE r.transfer_id=t.transfer_id)
       ORDER BY t.request_time,t.transfer_id`,
      [input.bloodType, input.componentType, input.sourceInstitutionId ?? null]);
    return result.rows.map((row) => ({
      transferId: String(row.transfer_id), sourceInstitutionId: String(row.source_institution_id),
      destinationInstitutionId: String(row.destination_institution_id), urgency: String(row.urgency) as Urgency,
      requestTime: new Date(row.request_time instanceof Date ? row.request_time : String(row.request_time)).toISOString(),
      quantity: Number(row.quantity),
    }));
  }

  async v5ForecastIds(institutionId: string, horizonDate: string): Promise<string[]> {
    const result = await this.pool.query<{ forecast_id: string }>(
      `SELECT df.forecast_id FROM app.demand_forecasts df
       WHERE df.institution_id=$1 AND df.horizon_date=$2::date AND df.run_id=(
         SELECT latest.run_id FROM app.forecast_runs latest
         WHERE latest.institution_id=$1 AND latest.dataset_version='SYNTHETIC_FORECAST_V5_RUNTIME_V1' AND latest.horizon_date=$2::date
         ORDER BY latest.generated_at DESC, latest.run_id DESC LIMIT 1)
       ORDER BY df.component, df.blood_type`, [institutionId, horizonDate]);
    return result.rows.map((row) => String(row.forecast_id));
  }

  async latestCensus(institutionId: string, before: Date): Promise<CensusHeader | null> {
    const snapshot = await this.mlSnapshots.latest(institutionId, before);
    return snapshot ? { snapshotId: snapshot.snapshotId, capturedAt: snapshot.capturedAt, sourceProjectionDigest: snapshot.sourceProjectionDigest } : null;
  }
}

const SAFETY = { classification: "SIMULATION_ONLY" as const, recommendationEligibility: "DISABLED_UNAPPROVED_POLICY" as const };
const round = (value: number): number => Number(value.toFixed(6));
export function manilaDate(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
function coordinationCode(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return /^(COORD|ML_SNAPSHOT)_[A-Z0-9_]+$/.test(code) ? code : "COORDINATION_INPUT_UNAVAILABLE";
}

export async function priorityView(reader: CoordinationReader, institutionId: string, bloodType: BloodType, componentType: ComponentType, now: Date) {
  const base = {
    schemaVersion: "RPS_PRIORITY_VIEW_V1" as const, institutionId, bloodType, componentType,
    policyVersion: rpsPolicy.policyVersion,
    weights: { urgency: rpsPolicy.rps.urgencyWeight, wait: rpsPolicy.rps.waitWeight, waitCapHours: rpsPolicy.rps.waitCapHours },
    evaluationTime: now.toISOString(), ...SAFETY,
  };
  const requests = await reader.pendingRequests({ bloodType, componentType, sourceInstitutionId: institutionId });
  if (!requests.length) return { ...base, status: "EMPTY" as const, unavailableReason: null, runId: null, inputSha256: null, ranked: [] };
  let run: ReturnType<typeof rankRpsV2>;
  try {
    run = rankRpsV2({ evaluationTime: base.evaluationTime, requests: requests.map((request) => ({
      requestId: request.transferId, sourceInstitutionId: request.sourceInstitutionId, bloodType, componentType: componentType as never,
      urgency: request.urgency, requestTime: request.requestTime })) });
  } catch (error) {
    return { ...base, status: "UNAVAILABLE" as const, unavailableReason: coordinationCode(error), runId: null, inputSha256: null, ranked: [] };
  }
  const byId = new Map(requests.map((request) => [request.transferId, request]));
  return {
    ...base, status: "AVAILABLE" as const, unavailableReason: null, runId: run.runId, inputSha256: run.inputSha256,
    ranked: run.ranked.map((item, index) => ({
      rank: index + 1, transferId: item.requestId, destinationInstitutionId: byId.get(item.requestId)?.destinationInstitutionId ?? null,
      quantity: byId.get(item.requestId)?.quantity ?? null, urgency: item.urgency, requestTime: item.requestTime,
      waitHours: round(item.waitHours), urgencyContribution: round(item.urgencyNormalized * base.weights.urgency),
      waitContribution: round(item.waitNormalized * base.weights.wait), score: item.score,
    })),
  };
}

interface SurplusComputation {
  reason: string | null;
  census: { snapshotId: string; capturedAt: string } | null;
  items: { forecastId: string; forecast: ForecastV5Evidence | null; availableCount: number | null; evidence: SourceSurplusEvidenceV5 | null; reason: string | null }[];
}

async function computeSurplus(reader: CoordinationReader, institutionId: string, businessDate: string, now: Date): Promise<SurplusComputation> {
  if (businessDate !== manilaDate(now)) return { reason: "SURPLUS_REQUIRES_TODAY", census: null, items: [] };
  const header = await reader.latestCensus(institutionId, now);
  const census = header ? { snapshotId: header.snapshotId, capturedAt: header.capturedAt } : null;
  if (!header || manilaDate(new Date(header.capturedAt)) !== businessDate) return { reason: "CENSUS_NOT_CURRENT", census, items: [] };
  const forecastIds = await reader.v5ForecastIds(institutionId, businessDate);
  if (!forecastIds.length) return { reason: "V5_FORECAST_NOT_CURRENT", census, items: [] };
  let snapshot: CensusV21Snapshot | null;
  try { snapshot = await reader.snapshotReader.get(header.snapshotId, institutionId); }
  catch (error) { return { reason: coordinationCode(error), census, items: [] }; }
  const items: SurplusComputation["items"] = [];
  for (const forecastId of forecastIds) {
    const forecast = await reader.forecastReader.get(forecastId, institutionId);
    const count = snapshot?.groups.find((group) => group.componentType === forecast?.componentType)?.bloodTypes.find((row) => row.bloodType === forecast?.bloodType);
    try {
      const evidence = await produceSourceSurplusEvidenceV5FromStore({
        sourceInstitutionId: institutionId, evaluationTime: now.toISOString(), forecastId,
        inventorySnapshotId: header.snapshotId, sourceProjectionDigest: header.sourceProjectionDigest,
        snapshotReader: reader.snapshotReader, forecastReader: reader.forecastReader,
      });
      items.push({ forecastId, forecast, availableCount: count?.forecastEligibleAvailableCount ?? null, evidence, reason: null });
    } catch (error) {
      items.push({ forecastId, forecast, availableCount: count?.forecastEligibleAvailableCount ?? null, evidence: null, reason: coordinationCode(error) });
    }
  }
  return { reason: items.some((item) => item.evidence) ? null : (items[0]?.reason ?? "SURPLUS_UNAVAILABLE"), census, items };
}

export async function surplusView(reader: CoordinationReader, institutionId: string, businessDate: string, now: Date) {
  const computed = await computeSurplus(reader, institutionId, businessDate, now);
  const first = computed.items.find((item) => item.evidence)?.evidence ?? null;
  return {
    schemaVersion: "SOURCE_SURPLUS_VIEW_V1" as const, institutionId, businessDate,
    status: computed.reason ? "UNAVAILABLE" as const : "CURRENT" as const, unavailableReason: computed.reason,
    census: computed.census,
    forecast: first ? { runId: first.forecastRunId, datasetVersion: first.datasetVersion, originDate: first.originDate, horizonDate: first.horizonDate, generatedAt: first.asOf } : null,
    reserve: { safetyAllowance: optimizationPolicy.surplus.safetyAllowance, minimumReserve: optimizationPolicy.surplus.minimumReserve, rounding: optimizationPolicy.surplus.rounding },
    series: computed.items.map((item) => ({
      bloodType: item.forecast?.bloodType ?? null, componentType: item.forecast?.componentType ?? null,
      availableCount: item.availableCount, forecastDemand: item.forecast ? round(item.forecast.pointForecast) : null,
      surplusQuantity: item.evidence?.surplusQuantity ?? null, forecastId: item.forecastId,
      evidenceId: item.evidence?.evidenceId ?? null, status: item.evidence ? "AVAILABLE" as const : "UNAVAILABLE" as const, unavailableReason: item.reason,
    })),
    policyVersion: optimizationPolicy.policyVersion, ...SAFETY,
  };
}

export async function redistributionView(reader: CoordinationReader, institutionId: string, bloodType: BloodType, componentType: ComponentType, requiredQuantity: number, now: Date) {
  const base = {
    schemaVersion: "BROA_REDISTRIBUTION_VIEW_V1" as const, institutionId, bloodType, componentType,
    policyVersion: optimizationPolicy.policyVersion, weights: optimizationPolicy.broa.weights,
    candidateAssumption: candidatePolicy.version, evaluationTime: now.toISOString(),
    automaticApproval: false as const, contextUsedForScoring: false as const, ...SAFETY,
  };
  const unavailable = (reason: string, gate: { eligible: boolean; reason: string; surplusQuantity: number | null; requiredQuantity: number }, excluded: { destinationInstitutionId: string; reason: string }[] = []) =>
    ({ ...base, status: "UNAVAILABLE" as const, unavailableReason: reason, gate, runId: null, ranked: [], excluded });
  const computed = await computeSurplus(reader, institutionId, manilaDate(now), now);
  const item = computed.items.find((candidate) => candidate.forecast?.bloodType === bloodType && candidate.forecast?.componentType === componentType);
  if (!item?.evidence) {
    const reason = computed.reason ?? item?.reason ?? "SERIES_SURPLUS_UNAVAILABLE";
    return unavailable(reason, { eligible: false, reason, surplusQuantity: null, requiredQuantity });
  }
  const surplusQuantity = item.evidence.surplusQuantity;
  if (surplusQuantity < requiredQuantity) return unavailable("SURPLUS_BELOW_REQUIRED", { eligible: false, reason: "SURPLUS_BELOW_REQUIRED", surplusQuantity, requiredQuantity });
  const gate = { eligible: true, reason: "SURPLUS_AVAILABLE", surplusQuantity, requiredQuantity };
  // SYNTHETIC_BROA_CANDIDATES_V1: destinations with pending needs for this series, from any supplier.
  const needs = (await reader.pendingRequests({ bloodType, componentType })).filter((request) => request.destinationInstitutionId !== institutionId);
  const grouped = new Map<string, { urgency: number; stockShortage: number }>();
  for (const need of needs) {
    const current = grouped.get(need.destinationInstitutionId) ?? { urgency: 0, stockShortage: 0 };
    grouped.set(need.destinationInstitutionId, { urgency: Math.max(current.urgency, candidatePolicy.urgencyScale[need.urgency]), stockShortage: current.stockShortage + need.quantity });
  }
  if (!grouped.size) return unavailable("NO_PENDING_NEED", gate);
  const distances = (candidatePolicy.distancesKm as Record<string, Record<string, number>>)[institutionId] ?? {};
  const excluded: { destinationInstitutionId: string; reason: string }[] = [];
  const candidates = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([destinationInstitutionId, need]) => {
    const distanceKm = distances[destinationInstitutionId];
    if (distanceKm === undefined) excluded.push({ destinationInstitutionId, reason: "DISTANCE_NOT_DEFINED" });
    return { destinationInstitutionId, sourceInstitutionId: institutionId, bloodType, componentType: componentType as never, urgency: need.urgency, stockShortage: need.stockShortage, distanceKm: distanceKm ?? 0, eligible: distanceKm !== undefined };
  });
  if (!candidates.some((candidate) => candidate.eligible)) return unavailable("NO_ELIGIBLE_DESTINATION", gate, excluded);
  let run: ReturnType<typeof recommendBroaV5>;
  try { run = recommendBroaV5({ evaluationTime: base.evaluationTime, requiredQuantity, sourceSurplus: item.evidence, candidates }); }
  catch (error) { const reason = coordinationCode(error); return unavailable(reason, gate, excluded); }
  return {
    ...base, status: "AVAILABLE" as const, unavailableReason: null, gate, runId: run.runId,
    ranked: run.ranked.map((entry, index) => ({
      rank: index + 1, destinationInstitutionId: entry.destinationInstitutionId, urgency: entry.urgency,
      stockShortage: entry.stockShortage, distanceKm: entry.distanceKm,
      normalized: { urgency: round(entry.normalized.urgency), stockShortage: round(entry.normalized.stockShortage), distancePenalty: round(entry.normalized.distancePenalty) },
      contributions: { urgency: round(entry.contributions.urgency), stockShortage: round(entry.contributions.stockShortage), distancePenalty: round(entry.contributions.distancePenalty) },
      score: entry.score,
    })),
    excluded,
  };
}
