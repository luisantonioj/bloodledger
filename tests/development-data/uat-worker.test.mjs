// J9: the UAT worker control refuses unsafe starts and controls only the worker process.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const script = new URL('../../scripts/development-data/uat-worker.sh', import.meta.url).pathname;
const fakeDocker = `#!/usr/bin/env bash
state="$FAKE_ROOT/worker-running"; printf '%s\\n' "$*" >>"$FAKE_ROOT/docker.log"
case "$1" in
  inspect) echo "\${FAKE_RUNNING:-true}"; exit 0 ;;
  exec)
    shift
    if [[ "$1" == -d ]]; then touch "$state"; exit 0; fi
    container="$1"; shift
    if [[ "$container" == bloodledger-postgres-1 ]]; then
      query="\${*: -1}"
      case "$query" in
        *operational_stock_runs*) echo "\${FAKE_LOCK:-0}" ;;
        *"v2_commands WHERE status NOT IN"*) echo "\${FAKE_V2:-0}" ;;
        *scan_events*) echo "\${FAKE_V1:-0}" ;;
        *"GROUP BY"*) echo 'COMMITTED|3' ;;
      esac
      exit 0
    fi
    if [[ "$1" == kill ]]; then rm -f "$state"; exit 0; fi
    [[ -f "$state" ]] && echo 42
    exit 0 ;;
esac
exit 0
`;

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'uat-worker-'));
  writeFileSync(join(root, 'docker'), fakeDocker); chmodSync(join(root, 'docker'), 0o755);
  const run = (args, env = {}) => spawnSync('bash', [script, ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${root}:${process.env.PATH}`, FAKE_ROOT: root, ...env } });
  return { root, run, running: () => existsSync(join(root, 'worker-running')), log: () => readFileSync(join(root, 'docker.log'), 'utf8'), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('J9 worker start refuses a stopped API, an active population lock and unreviewed pending commands', () => {
  const h = harness();
  try {
    assert.match(h.run(['start'], { FAKE_RUNNING: 'false' }).stderr, /API_CONTAINER_NOT_RUNNING/);
    assert.match(h.run(['start'], { FAKE_LOCK: '1' }).stderr, /POPULATION_WRITER_LOCK_ACTIVE/);
    const pending = h.run(['start'], { FAKE_V2: '2' });
    assert.equal(pending.status, 1);
    assert.match(pending.stderr, /PENDING_COMMANDS_PRESENT: 2 V2 and 0 V1/);
    assert.equal(h.running(), false);
    assert.equal(h.run(['start', '--confirm-pending'], { FAKE_V2: '2' }).status, 0);
    assert.equal(h.running(), true);
  } finally { h.cleanup(); }
});

test('J9 worker start, duplicate refusal, status and stop touch only the worker process', () => {
  const h = harness();
  try {
    assert.match(h.run(['status']).stdout, /worker: STOPPED\npending V2 commands: 0; pending V1 scans: 0; population writer lock: 0/);
    assert.equal(h.run(['start']).status, 0);
    assert.match(h.log(), /exec -d bloodledger-persistent-api sh -c FABRIC_SYNC_ENABLED=true FABRIC_V2_SYNC_ENABLED=true exec node services\/api\/build\/src\/worker-main\.js/);
    assert.match(h.run(['start']).stderr, /WORKER_ALREADY_RUNNING/);
    assert.match(h.run(['status']).stdout, /worker: RUNNING \(pid 42\)/);
    assert.match(h.run(['stop']).stdout, /worker stopped/);
    assert.match(h.log(), /exec bloodledger-persistent-api kill -TERM 42/);
    assert.doesNotMatch(h.log(), /restart|rm -f|stop bloodledger|compose/);
    assert.equal(h.run(['bogus']).status, 2);
  } finally { h.cleanup(); }
});
