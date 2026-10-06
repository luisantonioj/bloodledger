// FR-14 / BR-ALG-07 / NFR-09: read-only prerequisites for isolated V5 harnesses.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const V5_FORECASTING_IMAGE = 'sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1';
export const V5_MODEL_FILE_SHA256 = '1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764';
export const V5_POSTGRES_IMAGE = 'postgres:17.10';
export const V5_NODE_IMAGE = 'node:24.17.0-bookworm-slim';

const nativeOperations = {
  readModel: readFile,
  hashModel: bytes => createHash('sha256').update(bytes).digest('hex'),
  runCommand: (command, args) => execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe' }),
};

export function v5PreflightExitCode(result) {
  return result.status === 'PASS' ? 0 : result.status === 'BLOCKED' ? 2 : 1;
}

// Dependency injection exercises failures without stopping Docker or removing images.
export async function checkV5Prerequisites(modelPath, { producer = false, checkBrowser } = {}, operations = nativeOperations) {
  if (!modelPath) return { status: 'BLOCKED', reason: 'External pinned model path required' };
  let bytes;
  try { bytes = await operations.readModel(modelPath); }
  catch (error) {
    return ['ENOENT', 'EACCES', 'EPERM', 'EISDIR', 'ENOTDIR'].includes(error?.code)
      ? { status: 'BLOCKED', reason: 'External pinned model unavailable' }
      : { status: 'FAIL', reason: 'External model read failed' };
  }
  if (operations.hashModel(bytes) !== V5_MODEL_FILE_SHA256) {
    return { status: 'FAIL', reason: 'External pinned model hash mismatch' };
  }
  if (producer) {
    try { operations.runCommand('python3', ['--version']); }
    catch { return { status: 'BLOCKED', reason: 'Producer Python runtime unavailable' }; }
  }
  try { operations.runCommand('docker', ['info']); }
  catch { return { status: 'BLOCKED', reason: 'Docker runtime unavailable' }; }
  const images = [V5_FORECASTING_IMAGE, V5_POSTGRES_IMAGE, ...(producer ? [V5_NODE_IMAGE] : [])];
  for (const image of images) {
    let id;
    try { id = operations.runCommand('docker', ['image', 'inspect', '--format', '{{.Id}}', image]).trim(); }
    catch {
      return { status: 'BLOCKED', reason: image === V5_FORECASTING_IMAGE
        ? 'Pinned forecasting image unavailable' : image === V5_POSTGRES_IMAGE
        ? 'PostgreSQL image unavailable' : 'Producer Node image unavailable' };
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(id) || (image === V5_FORECASTING_IMAGE && id !== image)) {
      return { status: 'FAIL', reason: 'Pinned image identity mismatch' };
    }
  }
  if (checkBrowser) {
    try { await checkBrowser(); }
    catch { return { status: 'BLOCKED', reason: 'Pinned Chromium runtime unavailable' }; }
  }
  return { status: 'PASS', reason: 'Pinned prerequisites available; integration not yet executed' };
}

// CLI only inspects prerequisites. It creates no database, account or container.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const result = args.some(arg => arg !== '--producer') || args.length > 1
    ? { status: 'FAIL', reason: 'Unsupported preflight argument' }
    : await checkV5Prerequisites(process.env.BLOODLEDGER_V5_MODEL_TEST_PATH, { producer: args.includes('--producer') });
  console.log(JSON.stringify({ classification: 'SIMULATION_ONLY', phase: 'PREREQUISITES_ONLY', ...result }));
  process.exitCode = v5PreflightExitCode(result);
}
