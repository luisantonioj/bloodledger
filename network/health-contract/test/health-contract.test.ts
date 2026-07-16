import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import type { Context } from "fabric-contract-api";
import { HealthContract } from "../src/health-contract";

interface RecordedEvent {
  name: string;
  payload: Buffer;
}

class MockContext {
  public readonly state = new Map<string, Buffer>();
  public readonly events: RecordedEvent[] = [];
  public readonly clientIdentity = {
    getMSPID: () => "MediatrixMSP",
    getAttributeValue: (name: string) => ({
      "hf.EnrollmentID": "mediatrix-admin",
      "hf.Type": "admin",
    })[name] ?? null,
  };
  public readonly stub = {
    getState: async (key: string) => this.state.get(key) ?? Buffer.alloc(0),
    putState: async (key: string, value: Uint8Array) => {
      this.state.set(key, Buffer.from(value));
    },
    setEvent: (name: string, payload: Uint8Array) => {
      this.events.push({ name, payload: Buffer.from(payload) });
    },
  };
}

const asContext = (context: MockContext): Context => context as unknown as Context;
const expected = (probeId: string) => JSON.stringify({ probeId, status: "OK" });

test("S1-07 accepts all approved probe ID boundaries and characters", async () => {
  for (const probeId of ["A", "a".repeat(64), "Az09._-"]) {
    const context = new MockContext();
    assert.equal(await new HealthContract().RecordProbe(asContext(context), probeId), expected(probeId));
    assert.deepEqual([...context.state.keys()], [`health:${probeId}`]);
  }
});

test("S1-07 rejects empty, long, whitespace, separators, controls, and other characters", async () => {
  const invalid = [undefined, "", "a".repeat(65), "has space", "slash/value", "colon:value", "line\nbreak", "plus+value", "é"];
  for (const probeId of invalid) {
    const context = new MockContext();
    await assert.rejects(new HealthContract().RecordProbe(asContext(context), probeId as string), /HEALTH_PROBE_INVALID_ID/);
    assert.equal(context.state.size, 0);
    assert.equal(context.events.length, 0);
  }
});

test("S1-07 records the exact state and event, and ReadProbe returns equality", async () => {
  const context = new MockContext();
  const result = await new HealthContract().RecordProbe(asContext(context), "probe-01_A.z");
  assert.equal(result, expected("probe-01_A.z"));
  assert.equal(context.state.get("health:probe-01_A.z")?.toString("utf8"), result);
  assert.equal(await new HealthContract().ReadProbe(asContext(context), "probe-01_A.z"), result);
  assert.deepEqual(context.events, [{ name: "HealthProbeRecorded", payload: Buffer.from("probe-01_A.z") }]);
});

test("S1-07 duplicate submission is idempotent and emits no duplicate event", async () => {
  const context = new MockContext();
  const contract = new HealthContract();
  const first = await contract.RecordProbe(asContext(context), "duplicate-01");
  const second = await contract.RecordProbe(asContext(context), "duplicate-01");
  assert.equal(second, first);
  assert.equal(context.state.size, 1);
  assert.equal(context.events.length, 1);
});

test("S1-07 returns the stable safe not-found error", async () => {
  await assert.rejects(new HealthContract().ReadProbe(asContext(new MockContext()), "missing-01"), /HEALTH_PROBE_NOT_FOUND/);
});

test("S1-07 deterministic replay produces identical state, result, and event", async () => {
  const replay = async () => {
    const context = new MockContext();
    const result = await new HealthContract().RecordProbe(asContext(context), "replay_01");
    return { result, state: [...context.state], events: context.events };
  };
  assert.deepEqual(await replay(), await replay());
});

test("S1-07 accepts mediatrix-admin and rejects unauthorized identities", async () => {
  const approved = new MockContext();
  await assert.doesNotReject(new HealthContract().RecordProbe(asContext(approved), "authorized-01"));
  for (const identity of [
    { msp: "OtherMSP", enrollment: "mediatrix-admin", type: "admin" },
    { msp: "MediatrixMSP", enrollment: "peer0", type: "peer" },
    { msp: "MediatrixMSP", enrollment: "api-gateway", type: "client" },
  ]) {
    const context = new MockContext();
    Object.assign(context.clientIdentity, {
      getMSPID: () => identity.msp,
      getAttributeValue: (name: string) => name === "hf.EnrollmentID" ? identity.enrollment : name === "hf.Type" ? identity.type : null,
    });
    await assert.rejects(new HealthContract().RecordProbe(asContext(context), "forbidden-01"), /HEALTH_PROBE_FORBIDDEN/);
  }
});

test("S1-07 interface has one caller argument and no prohibited behavior or fields", async () => {
  assert.equal(HealthContract.prototype.RecordProbe.length, 2);
  assert.equal(HealthContract.prototype.ReadProbe.length, 2);
  const source = await readFile(resolve(process.cwd(), "src/health-contract.ts"), "utf8");
  for (const prohibited of [
    "Date.now", "new Date", "Math.random", "fetch(", "http://", "https://", "readFile", "writeFile",
    "database", "postgres", "inventory", "transfer", "hospital", "patient", "donor", "forecast", "BROA", "RPS",
    "timestamp", "transactionId", "certificate", "payload:",
  ]) {
    assert.equal(source.includes(prohibited), false, `prohibited contract token: ${prohibited}`);
  }
});
