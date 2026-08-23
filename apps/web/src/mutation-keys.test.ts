import { describe, expect, it } from "vitest";
import { newMutationKeys } from "./mutation-keys";

describe("mutation evidence identifiers",()=>{
  it("creates API-compatible acknowledgement identifiers",()=>{
    const keys=newMutationKeys(()=>"01234567-89ab-4cde-8f01-23456789abcd");
    expect(keys.idempotencyKey).toMatch(/^IDEM_[A-Z0-9_-]{1,59}$/);
    expect(keys.correlationId).toMatch(/^CORR_[0-9A-F]{32}$/);
  });
  it("fails closed for a malformed entropy source",()=>expect(()=>newMutationKeys(()=>"not-a-uuid")).toThrow());
});
