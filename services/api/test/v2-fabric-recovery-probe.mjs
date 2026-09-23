import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { createPoolFromEnvironment } from "../build/src/database.js";
import { PostgresV2Projector } from "../build/src/database-v2.js";
import { FabricGatewayInterviewCore } from "../build/src/fabric.js";
import { provisionSyntheticAccount } from "../build/src/synthetic-account.js";
import { PostgresV2CommandStore } from "../build/src/v2-command.js";
import { V2CommandWorker } from "../build/src/v2-worker.js";

const phase = process.argv[2];
assert.ok(phase === "commit" || phase === "recover");
const pool = createPoolFromEnvironment();
const store = new PostgresV2CommandStore(pool);
const runSuffix = process.env.BLOODLEDGER_FABRIC_RECOVERY_RUN_SUFFIX ?? "01";
const commandId = `CMD_S6_FABRIC_RECOVERY_${runSuffix}`;
const actorInstitutionId = "INST_DIVINE_LOVE";
const actorUserId = "USR_DIVINE_LOVE";
const firstRunAt = new Date("2026-09-19T06:30:00.000Z");

try {
  if (phase === "commit") {
    const validationPassword = randomBytes(24).toString("base64url");
    const migrator = new Pool({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_MIGRATOR_USER,
      password: process.env.POSTGRES_MIGRATOR_PASSWORD,
    });
    try {
      await provisionSyntheticAccount(migrator, {
        institutionId: actorInstitutionId,
        institutionDisplayName: "Synthetic Divine Love Fabric Recovery",
        institutionCategory: "HOSPITAL",
        userId: actorUserId,
        username: "synth_divine_love_fabric_recovery",
        userDisplayName: "Synthetic Divine Love Fabric Recovery",
        roleId: "ROLE-03",
        password: validationPassword,
      });
      await provisionSyntheticAccount(migrator, {
        institutionId: "INST_MEDIATRIX",
        institutionDisplayName: "Synthetic Mediatrix Fabric Recovery",
        institutionCategory: "HOSPITAL",
        userId: "USR_MEDIATRIX_ADMIN",
        username: "synth_mediatrix_fabric_recovery",
        userDisplayName: "Synthetic Mediatrix Fabric Recovery",
        roleId: "ROLE-02",
        password: validationPassword,
      });
    } finally {
      await migrator.end();
    }

    const correlationId = `CORR_${"9".repeat(32)}`;
    await store.enqueue({
      commandId,
      idempotencyKey: `IDEM_S6_FABRIC_RECOVERY_${runSuffix}`,
      resourceType: "TRANSFER",
      resourceId: `TRF_S6_FABRIC_RECOVERY_${runSuffix}`,
      operation: "SUBMIT_TRANSFER",
      payload: {
        transferId: `TRF_S6_FABRIC_RECOVERY_${runSuffix}`,
        sourceInstitutionId: "INST_MEDIATRIX",
        destinationInstitutionId: actorInstitutionId,
        bloodType: "O_POSITIVE",
        componentType: "PACKED_RED_BLOOD_CELLS",
        quantity: 1,
        urgency: "ROUTINE",
        requestTime: "2026-09-19T06:29:00.000Z",
        actorUserId,
        eventTime: firstRunAt.toISOString(),
        correlationId,
      },
      correlationId,
      actorUserId,
      actorInstitutionId,
      acceptedAt: firstRunAt.toISOString(),
    });
    let submissionCount = 0;
    const fabric = new FabricGatewayInterviewCore();
    const worker = new V2CommandWorker(store, {
      submit: async (command) => {
        submissionCount += 1;
        try {
          return await fabric.submit(command);
        } catch (error) {
          console.error(JSON.stringify({ code: error?.code ?? null, retryable: error?.retryable ?? null, message: error instanceof Error ? error.message : "unknown Fabric error" }));
          throw error;
        }
      },
      project: async () => {
        throw Object.assign(new Error("intentional projection interruption"), { code: "PROJECTION_INTERRUPTED" });
      },
    }, "V2WORKER_S6_FABRIC_COMMIT");
    assert.deepEqual(await worker.runOnce(firstRunAt), { commandId, status: "RETRY_WAIT" });
    const pending = await store.get(commandId, actorInstitutionId, actorUserId);
    assert.equal(pending?.status, "LEDGER_COMMITTED_PROJECTION_PENDING");
    assert.equal(pending?.attemptCount, 1);
    assert.equal(submissionCount, 1);
    assert.ok(pending?.ledgerTransactionId);
    console.log(JSON.stringify({ phase, commandId, transactionId: pending.ledgerTransactionId, submissionCount, attemptCount: pending.attemptCount, status: pending.status }));
  } else {
    let submissionCount = 0;
    const projector = new PostgresV2Projector(pool);
    const worker = new V2CommandWorker(store, {
      submit: async () => {
        submissionCount += 1;
        throw new Error("committed command was resubmitted");
      },
      project: (command, committed) => projector.project(command, committed),
    }, "V2WORKER_S6_FABRIC_RECOVER");
    assert.deepEqual(await worker.runOnce(new Date("2026-09-19T06:31:00.000Z")), { commandId, status: "COMMITTED" });
    const committed = await store.get(commandId, actorInstitutionId, actorUserId);
    assert.equal(committed?.status, "COMMITTED");
    assert.equal(committed?.attemptCount, 2);
    assert.equal(submissionCount, 0);
    const projected = await pool.query(
      "SELECT ledger_transaction_id,ledger_version,status FROM app.v2_transfer_requests WHERE transfer_id=$1",
      [`TRF_S6_FABRIC_RECOVERY_${runSuffix}`],
    );
    assert.equal(projected.rowCount, 1);
    assert.equal(projected.rows[0].ledger_transaction_id, committed?.ledgerTransactionId);
    assert.equal(Number(projected.rows[0].ledger_version), 1);
    assert.equal(projected.rows[0].status, "PENDING");
    console.log(JSON.stringify({ phase, commandId, transactionId: committed?.ledgerTransactionId, submissionCount, attemptCount: committed?.attemptCount, finalVersion: 1, projectedRows: projected.rowCount, status: committed?.status }));
  }
} finally {
  await pool.end();
}
