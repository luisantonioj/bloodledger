// Panel revision (Franze #2, Cruzette #3): deterministic one-at-a-time sensitivity of RPS V2, BROA V2.1 and the
// V2.1 distributable-surplus buffers. It reuses the production score functions with perturbed parameters on
// synthetic scenarios from a fixed seed. SIMULATION_ONLY: synthetic inputs only, and no result
// here approves any weight, threshold or transfer (RQ-05, RQ-06, RQ-16 stay open).
import { sha256 } from "./hash.js";
import { rpsV2Score, type RpsV2Weights } from "./rps-v2.js";
import { broaV21Rank, type BroaV21Weights } from "./broa-v21.js";
import { distributableSurplus, SYNTHETIC_OPTIMIZATION_V2_1 } from "./surplus-v21.js";
import rpsPolicy from "../policy/interview-derived-optimization-v2.json" with { type: "json" };
import broaPolicy from "../policy/interview-derived-optimization-v2-1.json" with { type: "json" };

export const SENSITIVITY_STUDY_VERSION = "RPS_BROA_SENSITIVITY_V1";
export const SENSITIVITY_SEED = 20261103;
export const GENERATED_SCENARIOS = 200;
const FACTORS = [0.8, 0.9, 1.1, 1.2] as const;
type Urgency = "ROUTINE" | "URGENT" | "CRITICAL";
const URGENCIES: Urgency[] = ["ROUTINE", "URGENT", "CRITICAL"];

// mulberry32: small, dependency-free and identical on every platform for a given seed.
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const round = (value: number, places = 6) => Number(value.toFixed(places));

// Kendall tau-a between two orderings of the same item IDs (1 = identical, -1 = reversed).
export function kendallTau(baseline: string[], other: string[]): number {
  if (baseline.length < 2) return 1;
  const position = new Map(other.map((id, index) => [id, index]));
  let concordant = 0, discordant = 0;
  for (let i = 0; i < baseline.length; i++) for (let j = i + 1; j < baseline.length; j++) ((position.get(baseline[i]!)! < position.get(baseline[j]!)!) ? concordant++ : discordant++);
  return (concordant - discordant) / (concordant + discordant);
}

// Scale one named weight and renormalize so the weights still sum to 1.
export function perturbWeights<K extends string>(weights: Record<K, number>, key: NoInfer<K>, factor: number): Record<K, number> {
  const scaled: Record<K, number> = { ...weights, [key]: weights[key] * factor };
  const total = (Object.values(scaled) as number[]).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries((Object.entries(scaled) as Array<[K, number]>).map(([name, value]) => [name, value / total])) as Record<K, number>;
}

interface RpsRequest { requestId: string; urgency: Urgency; waitHours: number }
interface BroaCandidate { destinationInstitutionId: string; urgency: number; stockShortage: number; distanceKm: number }
interface SurplusCase { eligibleAvailable: number; pointForecast: number; requiredQuantity: number }

export const TABLE_7_SCENARIO: RpsRequest[] = [
  { requestId: "TRF_SIM_CRITICAL_NEW", urgency: "CRITICAL", waitHours: 0 },
  { requestId: "TRF_SIM_URGENT_24H", urgency: "URGENT", waitHours: 24 },
  { requestId: "TRF_SIM_URGENT_06H", urgency: "URGENT", waitHours: 6 },
  { requestId: "TRF_SIM_ROUTINE_30H", urgency: "ROUTINE", waitHours: 30 },
];
export const TABLE_8_SCENARIO: BroaCandidate[] = [
  { destinationInstitutionId: "INST_HOSPITAL_A", urgency: 3, stockShortage: 2, distanceKm: 2.0 },
  { destinationInstitutionId: "INST_HOSPITAL_B", urgency: 2, stockShortage: 4, distanceKm: 1.5 },
  { destinationInstitutionId: "INST_HOSPITAL_C", urgency: 1, stockShortage: 6, distanceKm: 4.0 },
];

export function generateScenarios(seed = SENSITIVITY_SEED, count = GENERATED_SCENARIOS) {
  const random = seededRandom(seed);
  const integer = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const rps: RpsRequest[][] = [], broa: BroaCandidate[][] = [], surplus: SurplusCase[] = [];
  for (let n = 0; n < count; n++) {
    rps.push(Array.from({ length: integer(3, 6) }, (_, index) => ({ requestId: `TRF_GEN_${n}_${index}`, urgency: URGENCIES[integer(0, 2)]!, waitHours: round(random() * 48, 2) })));
    broa.push(Array.from({ length: integer(3, 6) }, (_, index) => ({ destinationInstitutionId: `INST_GEN_${n}_${index}`, urgency: integer(1, 3), stockShortage: integer(1, 10), distanceKm: round(0.5 + random() * 7.5, 1) })));
    surplus.push({ eligibleAvailable: integer(10, 40), pointForecast: round(random() * 8, 2), requiredQuantity: integer(1, 6) });
  }
  return { rps, broa, surplus };
}

function rankRps(requests: RpsRequest[], weights: RpsV2Weights): string[] {
  return requests.map((request) => ({ ...request, score: rpsV2Score(request.urgency, request.waitHours, weights).score }))
    .sort((left, right) => right.score - left.score || right.waitHours - left.waitHours || left.requestId.localeCompare(right.requestId)).map((request) => request.requestId);
}
const rankBroa = (candidates: BroaCandidate[], weights: BroaV21Weights) => broaV21Rank(candidates, weights).map((candidate) => candidate.destinationInstitutionId);

function compare(baseline: string[][], perturbed: string[][]) {
  const topChanged = baseline.filter((order, index) => order[0] !== perturbed[index]![0]).length;
  const taus = baseline.map((order, index) => kendallTau(order, perturbed[index]!));
  return { scenarios: baseline.length, topChoiceChanged: topChanged, topChoiceChangedPercent: round((100 * topChanged) / baseline.length, 2), meanKendallTau: round(taus.reduce((sum, tau) => sum + tau, 0) / taus.length, 4), minKendallTau: round(Math.min(...taus), 4) };
}

// A brand-new CRITICAL request outranks an URGENT one that waited the full cap only if 0.5 x urgency > wait weight.
const criticalPrecedence = (weights: RpsV2Weights) => weights.urgencyWeight * 1 > weights.urgencyWeight * 0.5 + weights.waitWeight;

export function runSensitivityStudy() {
  const generated = generateScenarios();
  const rpsBase: RpsV2Weights = { urgencyWeight: rpsPolicy.rps.urgencyWeight, waitWeight: rpsPolicy.rps.waitWeight, waitCapHours: rpsPolicy.rps.waitCapHours };
  const rpsScenarios = [TABLE_7_SCENARIO, ...generated.rps];
  const rpsBaseline = rpsScenarios.map((scenario) => rankRps(scenario, rpsBase));
  const rpsVariants: Array<{ parameter: string; factor: number | null; weights: RpsV2Weights }> = [];
  for (const factor of FACTORS) {
    const { urgencyWeight, waitWeight } = perturbWeights({ urgencyWeight: rpsBase.urgencyWeight, waitWeight: rpsBase.waitWeight }, "urgencyWeight", factor);
    rpsVariants.push({ parameter: "urgencyWeight", factor, weights: { urgencyWeight, waitWeight, waitCapHours: rpsBase.waitCapHours } });
  }
  for (const waitCapHours of [12, 48]) rpsVariants.push({ parameter: `waitCapHours=${waitCapHours}`, factor: null, weights: { ...rpsBase, waitCapHours } });
  const rps = rpsVariants.map((variant) => ({
    parameter: variant.parameter, factor: variant.factor,
    weights: { urgencyWeight: round(variant.weights.urgencyWeight), waitWeight: round(variant.weights.waitWeight), waitCapHours: variant.weights.waitCapHours },
    criticalAlwaysOutranksUrgent: criticalPrecedence(variant.weights),
    table7Order: rankRps(TABLE_7_SCENARIO, variant.weights),
    ...compare(rpsBaseline, rpsScenarios.map((scenario) => rankRps(scenario, variant.weights))),
  }));

  const broaBase: BroaV21Weights = { ...broaPolicy.broa.weights };
  const broaScenarios = [TABLE_8_SCENARIO, ...generated.broa];
  const broaBaseline = broaScenarios.map((scenario) => rankBroa(scenario, broaBase));
  const broa = (Object.keys(broaBase) as Array<keyof BroaV21Weights>).flatMap((parameter) => FACTORS.map((factor) => {
    const weights = perturbWeights(broaBase, parameter, factor);
    return {
      parameter, factor, weights: Object.fromEntries(Object.entries(weights).map(([name, value]) => [name, round(value)])),
      table8Order: rankBroa(TABLE_8_SCENARIO, weights),
      ...compare(broaBaseline, broaScenarios.map((scenario) => rankBroa(scenario, weights))),
    };
  }));

  const baseBuffers: { safetyAllowance: number; minimumReserve: number } = { safetyAllowance: SYNTHETIC_OPTIMIZATION_V2_1.safetyAllowance, minimumReserve: SYNTHETIC_OPTIMIZATION_V2_1.minimumReserve };
  const gate = (item: SurplusCase, buffers: typeof baseBuffers) => distributableSurplus(item.eligibleAvailable, item.pointForecast, buffers) >= item.requiredQuantity;
  const surplusGrid = [0, 1, 2, 3, 4].flatMap((safetyAllowance) => [6, 8, 10, 12, 14].map((minimumReserve) => {
    const buffers = { safetyAllowance, minimumReserve };
    const flips = generated.surplus.filter((item) => gate(item, buffers) !== gate(item, baseBuffers)).length;
    const eligible = generated.surplus.filter((item) => gate(item, buffers)).length;
    return { safetyAllowance, minimumReserve, gateOpenPercent: round((100 * eligible) / generated.surplus.length, 2), gateDecisionChangedPercent: round((100 * flips) / generated.surplus.length, 2), table8SourceSurplus: distributableSurplus(25, 4.59, buffers) };
  }));
  // The panel's worked example: 20 eligible units and a 12-unit hospital reserve, before forecast and allowance.
  const panelExample = [0, 2].flatMap((safetyAllowance) => [0, 4.59].map((pointForecast) => ({ eligibleAvailable: 20, minimumReserve: 12, safetyAllowance, pointForecast, surplus: distributableSurplus(20, pointForecast, { safetyAllowance, minimumReserve: 12 }) })));

  const configuration = { studyVersion: SENSITIVITY_STUDY_VERSION, seed: SENSITIVITY_SEED, generatedScenarios: GENERATED_SCENARIOS, factors: FACTORS, rpsPolicyVersion: rpsPolicy.policyVersion, broaPolicyVersion: broaPolicy.policyVersion, rpsBaseline: rpsBase, broaBaseline: broaBase, surplusBaseline: baseBuffers };
  const results = { rps, broa, surplusGrid, panelExample, criticalPrecedenceThreshold: "urgencyWeight / (urgencyWeight + waitWeight) > 2/3" };
  return { ...configuration, classification: "SIMULATION_ONLY" as const, approvalStatus: "NOT_APPROVED_RQ_05_06_16_OPEN" as const, results, resultSha256: sha256({ configuration, results }) };
}
