// TP-STOCK-01 / FR-12 / NFR-05: exact independently reviewed scenario bytes.
import { createHash } from 'node:crypto';
import { digest } from './scenario.mjs';

export const SCENARIO_FILE_SHA256 = '4ad33820481b1e331e71ac03bbf37ed719096a3fc33c6321829a73d7e3b5fe70';
export const SCENARIO_SHA256 = '311395e58126cc7af9e72ad8ecc5cf7708e868531eadb0c1924743901e8f8fc8';
export const LEGACY_SCENARIO_REVIEW = Object.freeze({
  schemaVersion: 'REVIEWED_OPERATIONAL_STOCK_SCENARIO_V1',
  classification: 'SIMULATION_ONLY',
  scenarioSchemaVersion: 'OPERATIONAL_SCENARIO_V1',
  scenarioVersion: 'SYNTHETIC_OPERATIONAL_STOCK_522_V1',
  scenarioFileSha256: SCENARIO_FILE_SHA256,
  scenarioSha256: SCENARIO_SHA256,
  archiveSha256: 'cf94af36cbc672d58377b13c0e3e9ebbd922289e464f15e9214e03d4abb2c206',
  sourceWorkbookSha256: '5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb',
  sourceCountsSha256: 'fcf62756d3e0b449e7a294b51e8108106f20e5735746c193b4dce0529e7a9daf',
  generatorRevision: '7e29fd98f7dcd7d7f137c7a9721827b05b66aa74',
  generatorFileSha256: '1cdf0f63c493c2809da7691fa72b25186490cc17944efddaa2610f70b261b7c1',
  verifierFileSha256: '35bdbd9835f74059297c9987b2913df6b4aa1bfa51f706e44a89f76e13cf0977',
  generatedAt: '2026-10-08T06:46:27Z',
  populationNotBefore: '2026-10-08T08:00:00Z',
  t0: '2026-10-09T00:00:00Z',
  verificationWindowEndExclusive: '2026-10-09T08:00:00Z',
});
const requireReview = (ok, code) => { if (!ok) throw new Error(code); };
export const fileDigest = bytes => createHash('sha256').update(bytes).digest('hex');

export function resolveScenarioReview(value, approved) {
  if (!value) {
    requireReview(!approved, 'STOCK_SCENARIO_REVIEW_REQUIRED');
    return LEGACY_SCENARIO_REVIEW;
  }
  const { manifestSha256, ...review } = value;
  requireReview(manifestSha256 === digest(review) && manifestSha256 === approved, 'STOCK_SCENARIO_REVIEW_APPROVAL_INVALID');
  const fields = new Set([...Object.keys(LEGACY_SCENARIO_REVIEW),'reviewStatus','reviewReference','targetSha256','policySha256']);
  requireReview(Object.keys(review).length === fields.size && Object.keys(review).every(key=>fields.has(key)), 'STOCK_SCENARIO_REVIEW_FIELDS_INVALID');
  requireReview(review.schemaVersion === LEGACY_SCENARIO_REVIEW.schemaVersion && review.classification === 'SIMULATION_ONLY', 'STOCK_SCENARIO_REVIEW_INVALID');
  requireReview(review.reviewStatus === 'ACCEPTED' && typeof review.reviewReference === 'string' && review.reviewReference.startsWith('https://github.com/luisantonioj/bloodledger/'), 'STOCK_SCENARIO_REVIEW_DECISION_REQUIRED');
  for (const key of ['scenarioFileSha256','scenarioSha256','archiveSha256','generatorFileSha256','verifierFileSha256','targetSha256','policySha256']) {
    requireReview(/^[a-f0-9]{64}$/.test(review[key] ?? ''), 'STOCK_SCENARIO_REVIEW_HASH_INVALID');
  }
  requireReview(review.sourceWorkbookSha256 === LEGACY_SCENARIO_REVIEW.sourceWorkbookSha256 && review.sourceCountsSha256 === LEGACY_SCENARIO_REVIEW.sourceCountsSha256, 'STOCK_SCENARIO_SOURCE_CHANGED');
  requireReview(/^[a-f0-9]{40}$/.test(review.generatorRevision ?? '') && review.scenarioSchemaVersion === 'OPERATIONAL_SCENARIO_V1' && /^SYNTHETIC_OPERATIONAL_STOCK_522_V(?:[2-9]|[1-9][0-9]+)$/.test(review.scenarioVersion ?? ''), 'STOCK_SCENARIO_SUCCESSOR_INVALID');
  requireReview(review.scenarioSha256 !== SCENARIO_SHA256 && review.scenarioFileSha256 !== SCENARIO_FILE_SHA256, 'STOCK_SCENARIO_SUCCESSOR_INVALID');
  requireReview(Number.isFinite(Date.parse(review.generatedAt)) && Date.parse(review.generatedAt) <= Date.now(), 'STOCK_SCENARIO_GENERATION_TIME_INVALID');
  const start = Date.parse(review.populationNotBefore), t0 = Date.parse(review.t0), end = Date.parse(review.verificationWindowEndExclusive);
  requireReview(Number.isFinite(start) && start < t0 && t0 < end, 'STOCK_SCENARIO_REVIEW_WINDOW_INVALID');
  return review;
}

export function validateReviewedScenario(scenario, review) {
  requireReview(digest(scenario) === review.scenarioSha256 && scenario.classification === 'SIMULATION_ONLY' && scenario.schemaVersion === review.scenarioSchemaVersion && scenario.scenarioVersion === review.scenarioVersion, 'STOCK_SCENARIO_CANONICAL_MISMATCH');
  requireReview(scenario.source?.workbookSha256 === review.sourceWorkbookSha256 && scenario.source?.countsSha256 === review.sourceCountsSha256 && scenario.generator?.fileSha256 === review.generatorFileSha256 && scenario.generator?.revision === review.generatorRevision, 'STOCK_SCENARIO_LINEAGE_MISMATCH');
  for (const key of ['generatedAt','populationNotBefore','t0','verificationWindowEndExclusive']) {
    requireReview(scenario[key] === review[key], 'STOCK_SCENARIO_REVIEW_WINDOW_MISMATCH');
  }
  // Complete shape, relationships and nonclinical dates are replayed by Buno's
  // independently pinned verifier; changing only review dates cannot pass it.
  return scenario;
}
export function validateReviewedScenarioBytes(bytes, review = LEGACY_SCENARIO_REVIEW) {
  requireReview(fileDigest(bytes) === review.scenarioFileSha256, 'STOCK_SCENARIO_FILE_MISMATCH');
  return validateReviewedScenario(JSON.parse(bytes), review);
}
export function validateExecutionReview(execution, review) {
  validateReviewedScenario(execution.scenario, review);
  for (const key of ['scenarioSha256','scenarioFileSha256','archiveSha256']) {
    requireReview(execution[key] === review[key], 'STOCK_EXECUTION_SCENARIO_REVIEW_MISMATCH');
  }
  requireReview(digest(execution.scenarioReview ?? LEGACY_SCENARIO_REVIEW) === digest(review), 'STOCK_EXECUTION_SCENARIO_REVIEW_MISMATCH');
}
export function validationOwner(config) {
  const owner = config.hostValidation ?? 'JOPIA_SELF_VALIDATION';
  requireReview(['JOPIA_SELF_VALIDATION','LAT_LOCAL_VALIDATION'].includes(owner), 'STOCK_VALIDATION_OWNER_INVALID');
  return owner;
}
