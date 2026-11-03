// Panel revision Franze #6: bounded synchronization workload and resilience experiment. Run only through
// tests/api/workload-resilience.sh, which creates and drops an isolated validation database. Commands go through
// the real durable queue, worker, Fabric Gateway and projector; they are synthetic SUBMIT_TRANSFER requests with
// run-unique IDs. Measures accept -> ledger VALID -> projected latency, throughput, outage recovery, lease
// recovery after an abandoned claim, and exactly-once outcomes. SIMULATION_ONLY; one development host.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { createPoolFromEnvironment } from "../build/src/database.js";
import { PostgresV2Projector } from "../build/src/database-v2.js";
import { FabricGatewayInterviewCore } from "../build/src/fabric.js";
import { provisionSyntheticAccount } from "../build/src/synthetic-account.js";
import { PostgresV2CommandStore } from "../build/src/v2-command.js";
import { V2CommandWorker } from "../build/src/v2-worker.js";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []));
const run = args.run; if (!/^[A-Z0-9]{1,10}$/.test(run ?? "")) throw new Error("WORKLOAD_RUN_ID_INVALID");
const report = args.report; if (!report) throw new Error("WORKLOAD_REPORT_REQUIRED");
const sizes = (args.sizes ?? "10,25,50").split(",").map(Number);
const workers = Number(args.workers ?? 4);
const outageSeconds = Number(args["outage-seconds"] ?? 60);
const peerContainer = args["peer-container"] ?? "bloodledger-peer0-mediatrix-1";
const postgresContainer = args["postgres-container"] ?? null; // Opt-in: restarting PostgreSQL affects every client of that container.
const pool = createPoolFromEnvironment();
const store = new PostgresV2CommandStore(pool), projector = new PostgresV2Projector(pool), fabric = new FabricGatewayInterviewCore();
const actorInstitutionId = "INST_DIVINE_LOVE", actorUserId = "USR_DIVINE_LOVE";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null; };
const summary = (values) => ({ n: values.length, p50: percentile(values, 50), p95: percentile(values, 95), max: values.length ? Math.max(...values) : null });
const docker = (...command) => execFileSync("docker", command, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
const healthy = async (container, timeoutMs = 120_000) => { const start = Date.now(); while (Date.now() - start < timeoutMs) { const status = docker("inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", container); if (status === "healthy" || status === "running") return; await pause(1000); } throw new Error(`${container} did not become healthy`); };

async function provision() {
  const migrator = new Pool({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT), database: process.env.POSTGRES_DB, user: process.env.POSTGRES_MIGRATOR_USER, password: process.env.POSTGRES_MIGRATOR_PASSWORD });
  const password = randomBytes(24).toString("base64url");
  try {
    await provisionSyntheticAccount(migrator, { institutionId: actorInstitutionId, institutionDisplayName: "Synthetic Divine Love Workload", institutionCategory: "HOSPITAL", userId: actorUserId, username: "synth_divine_love_workload", userDisplayName: "Synthetic Divine Love Workload", roleId: "ROLE-03", password });
    await provisionSyntheticAccount(migrator, { institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix Workload", institutionCategory: "HOSPITAL", userId: "USR_MEDIATRIX_ADMIN", username: "synth_mediatrix_workload", userDisplayName: "Synthetic Mediatrix Workload", roleId: "ROLE-02", password });
  } finally { await migrator.end(); }
}

async function enqueue(scenario, count) {
  const accepted = new Map();
  for (let index = 0; index < count; index++) {
    const transferId = `TRF_WL_${run}_${scenario}_${index}`, correlationId = `CORR_${randomBytes(16).toString("hex").toUpperCase()}`, acceptedAt = new Date();
    const { command } = await store.enqueue({ commandId: `CMD_WL_${run}_${scenario}_${index}`, idempotencyKey: `IDEM_WL_${run}_${scenario}_${index}`, resourceType: "TRANSFER", resourceId: transferId, operation: "SUBMIT_TRANSFER",
      payload: { transferId, sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: actorInstitutionId, bloodType: "O_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", quantity: 1, urgency: "ROUTINE", requestTime: acceptedAt.toISOString(), actorUserId, eventTime: acceptedAt.toISOString(), correlationId },
      correlationId, actorUserId, actorInstitutionId, acceptedAt: acceptedAt.toISOString() });
    accepted.set(command.commandId, { acceptedMs: acceptedAt.getTime(), transferId });
  }
  return accepted;
}

// Concurrent workers drain the queue with the real Gateway and projector; timings are taken around each call.
async function drain(accepted, { timeoutMs = 15 * 60_000, onCommit } = {}) {
  const timings = new Map(), submissions = new Map(); let lastCommitMs = null;
  const ledger = {
    submit: async (command) => { submissions.set(command.commandId, (submissions.get(command.commandId) ?? 0) + 1); const result = await fabric.submit(command); const at = Date.now(); timings.set(command.commandId, { ...timings.get(command.commandId), committedMs: at }); lastCommitMs = at; onCommit?.(timings.size); return result; },
    project: async (command, committed) => { await projector.project(command, committed); timings.set(command.commandId, { ...timings.get(command.commandId), projectedMs: Date.now() }); },
  };
  const started = Date.now(); const deadline = started + timeoutMs;
  const done = () => [...accepted.keys()].every((id) => timings.get(id)?.projectedMs);
  await Promise.all(Array.from({ length: workers }, async (_, index) => {
    const worker = new V2CommandWorker(store, ledger, `V2WORKER_WL_${run}_${index}`);
    while (!done() && Date.now() < deadline) { const result = await worker.runOnce(new Date()); if (result.status === "IDLE" || result.status === "RETRY_WAIT") await pause(250); }
  }));
  return { startedMs: started, finishedMs: Date.now(), timings, submissions, lastCommitMs };
}

async function verify(accepted, drained) {
  const ids = [...accepted.keys()];
  const commands = await pool.query("SELECT command_id,status,ledger_transaction_id,attempt_count FROM app.v2_commands WHERE command_id=ANY($1)", [ids]);
  const projected = await pool.query("SELECT transfer_id,ledger_transaction_id FROM app.v2_transfer_requests WHERE transfer_id=ANY($1)", [[...accepted.values()].map((item) => item.transferId)]);
  const committed = commands.rows.filter((row) => row.status === "COMMITTED");
  const transactions = new Set(commands.rows.map((row) => row.ledger_transaction_id).filter(Boolean));
  const projectedTx = new Set(projected.rows.map((row) => row.ledger_transaction_id));
  return {
    accepted: ids.length, committed: committed.length, lost: ids.length - committed.length,
    distinctLedgerTransactions: transactions.size, projectedRows: projected.rowCount,
    duplicateProjections: projected.rowCount - new Set(projected.rows.map((row) => row.transfer_id)).size,
    queueEqualsProjection: [...transactions].every((tx) => projectedTx.has(tx)) && transactions.size === projectedTx.size,
    maxAttempts: Math.max(...commands.rows.map((row) => Number(row.attempt_count))),
    // Retries after a failed submission (for example while the peer is down); duplicates show in the counts above.
    commandsWithRetriedSubmission: [...drained.submissions.values()].filter((count) => count > 1).length,
  };
}

function measure(accepted, drained) {
  const toCommit = [], toProject = [];
  for (const [id, item] of accepted) { const timing = drained.timings.get(id); if (timing?.committedMs) toCommit.push(timing.committedMs - item.acceptedMs); if (timing?.projectedMs) toProject.push(timing.projectedMs - item.acceptedMs); }
  const seconds = (drained.finishedMs - drained.startedMs) / 1000;
  return { acceptToLedgerValidMs: summary(toCommit), acceptToProjectedMs: summary(toProject), wallSeconds: Number(seconds.toFixed(3)), committedPerSecond: Number((toProject.length / seconds).toFixed(3)) };
}

const results = { experiment: "WORKLOAD_RESILIENCE_V1", run, classification: "SIMULATION_ONLY", host: "single development host; one Mediatrix peer, one Raft orderer", workers, scenarios: [] };
try {
  await provision();
  for (const size of sizes) {
    const accepted = await enqueue(`LOAD${size}`, size); const drained = await drain(accepted);
    const outcome = await verify(accepted, drained); results.scenarios.push({ scenario: `concurrent-${size}`, ...measure(accepted, drained), outcome });
    assert.equal(outcome.lost, 0); assert.equal(outcome.duplicateProjections, 0); assert.equal(outcome.distinctLedgerTransactions, size);
  }
  { // Peer outage: stop the only peer after a third of the commands commit, restart it after outageSeconds.
    const size = 25, accepted = await enqueue("OUTAGE", size); let stoppedAt = null, startedAt = null;
    const drained = await drain(accepted, { onCommit: (count) => { if (count >= Math.floor(size / 3) && stoppedAt === null) { stoppedAt = Date.now(); docker("stop", peerContainer); setTimeout(async () => { docker("start", peerContainer); await healthy(peerContainer); startedAt = Date.now(); }, outageSeconds * 1000); } } });
    const outcome = await verify(accepted, drained);
    results.scenarios.push({ scenario: "peer-outage", outageSeconds, ...measure(accepted, drained), recoverySecondsAfterPeerStart: startedAt && drained.lastCommitMs ? Number(((drained.lastCommitMs - startedAt) / 1000).toFixed(3)) : null, outcome });
    assert.equal(outcome.lost, 0); assert.equal(outcome.duplicateProjections, 0);
  }
  { // Abandoned claims: a worker claims commands and stops; the 30-second lease returns them to the queue.
    const size = 5, accepted = await enqueue("LEASE", size); const abandonedAt = Date.now();
    for (let index = 0; index < size; index++) await store.claim(`V2WORKER_WL_${run}_CRASHED`, new Date());
    const drained = await drain(accepted); const outcome = await verify(accepted, drained);
    results.scenarios.push({ scenario: "abandoned-claim", ...measure(accepted, drained), recoverySecondsAfterAbandon: Number(((drained.finishedMs - abandonedAt) / 1000).toFixed(3)), outcome });
    assert.equal(outcome.lost, 0); assert.equal(outcome.duplicateProjections, 0);
  }
  if (postgresContainer) { // Opt-in PostgreSQL restart while commands are queued.
    const size = 10, accepted = await enqueue("PGRESTART", size); docker("restart", postgresContainer); await healthy(postgresContainer);
    const drained = await drain(accepted); const outcome = await verify(accepted, drained);
    results.scenarios.push({ scenario: "postgres-restart", ...measure(accepted, drained), outcome });
    assert.equal(outcome.lost, 0);
  }
  await writeFile(report, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results.scenarios.map(({ scenario, acceptToProjectedMs, committedPerSecond, outcome }) => ({ scenario, p95Ms: acceptToProjectedMs.p95, committedPerSecond, lost: outcome.lost, duplicates: outcome.duplicateProjections }))));
} finally { await pool.end(); }
