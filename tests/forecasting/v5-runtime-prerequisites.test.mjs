// FR-14 / BR-ALG-07 / NFR-09: missing prerequisites must never create test resources.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkV5Prerequisites, v5PreflightExitCode, V5_FORECASTING_IMAGE,
  V5_MODEL_FILE_SHA256, V5_POSTGRES_IMAGE, V5_NODE_IMAGE,
} from './v5-runtime-prerequisites.mjs';

const modelPath = '/external/synthetic-preflight-test.json';
function fixture({ readError, hash = V5_MODEL_FILE_SHA256, failCommand, imageId } = {}) {
  const commands = [];
  return {
    commands,
    operations: {
      async readModel(path) {
        assert.equal(path, modelPath);
        if (readError) throw Object.assign(new Error('SYNTHETIC_PRIVATE_DIAGNOSTIC'), { code: readError });
        return 'synthetic bytes; never a substitute for the frozen artifact';
      },
      hashModel() { return hash; },
      runCommand(command, args) {
        commands.push([command, ...args]);
        if (failCommand?.(command, args)) throw new Error('SYNTHETIC_PRIVATE_DIAGNOSTIC');
        return command === 'docker' && args[0] === 'image'
          ? imageId ?? (args.at(-1) === V5_FORECASTING_IMAGE ? V5_FORECASTING_IMAGE : 'sha256:' + 'a'.repeat(64))
          : 'available';
      },
    },
  };
}
function blocked(result, reason) {
  assert.deepEqual(result, { status: 'BLOCKED', reason });
  assert.equal(v5PreflightExitCode(result), 2);
}
function readOnly(commands) {
  assert.ok(commands.every(([command, operation, subcommand]) =>
    command === 'python3' && operation === '--version' ||
    command === 'docker' && (operation === 'info' || operation === 'image' && subcommand === 'inspect')));
}

test('missing model stops before Docker or image inspection', async () => {
  const { operations, commands } = fixture();
  blocked(await checkV5Prerequisites(undefined, {}, operations), 'External pinned model path required');
  assert.equal(commands.length, 0);
});
for (const code of ['ENOENT', 'EACCES', 'EPERM', 'EISDIR', 'ENOTDIR']) {
  test(code + ' model read is BLOCKED before resources', async () => {
    const { operations, commands } = fixture({ readError: code });
    blocked(await checkV5Prerequisites(modelPath, {}, operations), 'External pinned model unavailable');
    assert.equal(commands.length, 0);
  });
}
test('unexpected model I/O failure is FAIL with safe diagnostics', async () => {
  const { operations, commands } = fixture({ readError: 'EIO' });
  const result = await checkV5Prerequisites(modelPath, {}, operations);
  assert.deepEqual(result, { status: 'FAIL', reason: 'External model read failed' });
  assert.equal(v5PreflightExitCode(result), 1);
  assert.equal(commands.length, 0);
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'));
});
test('corrupt model fails instead of becoming a missing-prerequisite result', async () => {
  const { operations, commands } = fixture({ hash: '0'.repeat(64) });
  const result = await checkV5Prerequisites(modelPath, {}, operations);
  assert.deepEqual(result, { status: 'FAIL', reason: 'External pinned model hash mismatch' });
  assert.equal(v5PreflightExitCode(result), 1);
  assert.equal(commands.length, 0);
});
test('missing producer Python is BLOCKED before Docker', async () => {
  const { operations, commands } = fixture({ failCommand: command => command === 'python3' });
  blocked(await checkV5Prerequisites(modelPath, { producer: true }, operations), 'Producer Python runtime unavailable');
  assert.deepEqual(commands, [['python3', '--version']]);
});
test('unavailable Docker is BLOCKED without copying child diagnostics', async () => {
  const { operations, commands } = fixture({ failCommand: (command, args) => command === 'docker' && args[0] === 'info' });
  const result = await checkV5Prerequisites(modelPath, {}, operations);
  blocked(result, 'Docker runtime unavailable');
  assert.deepEqual(commands, [['docker', 'info']]);
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'));
});
for (const [image, reason] of [
  [V5_FORECASTING_IMAGE, 'Pinned forecasting image unavailable'],
  [V5_POSTGRES_IMAGE, 'PostgreSQL image unavailable'],
  [V5_NODE_IMAGE, 'Producer Node image unavailable'],
]) {
  test('missing ' + image + ' is BLOCKED without implicit pull', async () => {
    const { operations, commands } = fixture({ failCommand: (command, args) => command === 'docker' && args.at(-1) === image });
    blocked(await checkV5Prerequisites(modelPath, { producer: true }, operations), reason);
    readOnly(commands);
  });
}
test('unexpected forecasting image identity is FAIL', async () => {
  const { operations, commands } = fixture({ imageId: 'sha256:' + 'b'.repeat(64) });
  const result = await checkV5Prerequisites(modelPath, {}, operations);
  assert.deepEqual(result, { status: 'FAIL', reason: 'Pinned image identity mismatch' });
  assert.equal(v5PreflightExitCode(result), 1);
  readOnly(commands);
});
test('unavailable Chromium is BLOCKED after model and image checks', async () => {
  const { operations, commands } = fixture();
  let browserChecked = false;
  blocked(await checkV5Prerequisites(modelPath, { async checkBrowser() { browserChecked = true; throw new Error('SYNTHETIC_PRIVATE_DIAGNOSTIC'); } }, operations), 'Pinned Chromium runtime unavailable');
  assert.ok(browserChecked);
  readOnly(commands);
});
test('missing image short circuits browser launch', async () => {
  const { operations, commands } = fixture({ failCommand: (command, args) => command === 'docker' && args.at(-1) === V5_FORECASTING_IMAGE });
  let browserChecked = false;
  const result = await checkV5Prerequisites(modelPath, { async checkBrowser() { browserChecked = true; } }, operations);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(browserChecked, false);
  readOnly(commands);
});
test('cookie prerequisites pass only after browser launch', async () => {
  const { operations, commands } = fixture();
  let browserChecked = false;
  const result = await checkV5Prerequisites(modelPath, { async checkBrowser() { browserChecked = true; } }, operations);
  assert.equal(result.status, 'PASS');
  assert.equal(v5PreflightExitCode(result), 0);
  assert.ok(browserChecked);
  assert.match(result.reason, /integration not yet executed/);
  assert.equal(commands.filter(command => command[1] === 'image').length, 2);
  readOnly(commands);
});
test('producer prerequisites include Python and all three images', async () => {
  const { operations, commands } = fixture();
  const result = await checkV5Prerequisites(modelPath, { producer: true }, operations);
  assert.equal(result.status, 'PASS');
  assert.equal(v5PreflightExitCode(result), 0);
  assert.deepEqual(commands.filter(command => command[1] === 'image').map(command => command.at(-1)), [V5_FORECASTING_IMAGE, V5_POSTGRES_IMAGE, V5_NODE_IMAGE]);
  assert.deepEqual(commands[0], ['python3', '--version']);
  readOnly(commands);
});

// Exercise native file hashing and CLI exit codes without a model or Docker resource.
test('native CLI distinguishes missing, unreadable, directory and corrupt model paths', async () => {
  const { mkdtemp, writeFile, chmod, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const directory = await mkdtemp(resolve(tmpdir(), 'bloodledger-v5-preflight-test-'));
  const corrupt = resolve(directory, 'corrupt.json');
  const unreadable = resolve(directory, 'unreadable.json');
  const cli = resolve('tests/forecasting/v5-runtime-prerequisites.mjs');
  try {
    await writeFile(corrupt, 'corrupt synthetic bytes');
    await writeFile(unreadable, 'unreadable synthetic bytes', { mode: 0o000 });
    for (const [path, exit, status] of [
      [undefined, 2, 'BLOCKED'], [resolve(directory, 'missing.json'), 2, 'BLOCKED'],
      [directory, 2, 'BLOCKED'], [corrupt, 1, 'FAIL'],
      ...(process.getuid?.() === 0 ? [] : [[unreadable, 2, 'BLOCKED']]),
    ]) {
      const env = { ...process.env };
      delete env.BLOODLEDGER_V5_MODEL_TEST_PATH;
      if (path) env.BLOODLEDGER_V5_MODEL_TEST_PATH = path;
      const result = spawnSync(process.execPath, [cli, '--producer'], { env, encoding: 'utf8' });
      assert.equal(result.status, exit);
      const evidence = JSON.parse(result.stdout);
      assert.equal(evidence.status, status);
      assert.equal(evidence.phase, 'PREREQUISITES_ONLY');
      assert.equal(result.stderr, '');
    }
  } finally {
    await chmod(unreadable, 0o600);
    await rm(directory, { recursive: true, force: true });
  }
});
test('native CLI rejects unsupported arguments safely', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, ['tests/forecasting/v5-runtime-prerequisites.mjs', '--unknown'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).reason, 'Unsupported preflight argument');
  assert.equal(result.stderr, '');
});
