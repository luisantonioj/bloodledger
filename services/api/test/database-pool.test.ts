import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createPoolFromEnvironment } from "../src/database.js";

const environment = { POSTGRES_HOST: "127.0.0.1", POSTGRES_PORT: "5432", POSTGRES_DB: "bloodledger_test", POSTGRES_APP_USER: "synthetic_app", POSTGRES_APP_PASSWORD: "synthetic-test-only" };

test("TP-JOP-D14 a lost database connection does not end the API or worker process", async () => {
  const pool = createPoolFromEnvironment(environment);
  const logged: string[] = [];
  const original = console.error;
  console.error = (line: string) => { logged.push(line); };
  try {
    // An idle pooled client error is re-emitted on the pool; an unhandled "error" event would throw.
    assert.doesNotThrow(() => pool.emit("error", Object.assign(new Error("Connection terminated unexpectedly"), { code: "57P01" })));
    assert.deepEqual(JSON.parse(logged[0]), { level: "warn", msg: "database connection lost", safeErrorCode: "57P01" });
    // A checked-out client has no pool listener, so each new client gets its own.
    const client = new EventEmitter();
    pool.emit("connect", client);
    assert.doesNotThrow(() => client.emit("error", new Error("Connection terminated unexpectedly")));
  } finally {
    console.error = original;
    await pool.end();
  }
});
