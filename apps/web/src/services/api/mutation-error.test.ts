import { describe, expect, it } from "vitest";
import { ApiRequestError } from "./client";
import { mutationError } from "./mutation-error";

describe("J4 / TP-JOP-D01/D02 rejected command handling", () => {
  it("discards only a rejected time attempt and mentions device clock on repetition", () => {
    const error = new ApiRequestError(400, "Rejected", "V2_COMMAND_TIME_OUT_OF_WINDOW");
    expect(mutationError(error)).toMatchObject({discardAttempt:true, requiresCorrection:false, timeRejected:true});
    expect(mutationError(error).message).not.toContain("device clock");
    expect(mutationError(error, 1).message).toContain("device clock");
  });
  it.each([[400,"REQUEST_INVALID"],[413,"REQUEST_BODY_TOO_LARGE"],[415,"REQUEST_MEDIA_TYPE_UNSUPPORTED"]] as const)("requires correction for %i %s", (status, code) => {
    expect(mutationError(new ApiRequestError(status, "Rejected", code))).toMatchObject({discardAttempt:true, requiresCorrection:true, timeRejected:false});
  });
  it.each([new TypeError("Network unavailable"), new ApiRequestError(503,"Unavailable"), new ApiRequestError(409,"Population writer active","OPERATIONAL_STOCK_WRITER_LOCKED")])("preserves ambiguous/retryable attempts", error => {
    expect(mutationError(error)).toMatchObject({discardAttempt:false,requiresCorrection:false});
  });
  it.each(["COMPONENT_LABEL_NOT_EXPIRED","COMPONENT_EXPIRY_RESERVATION_ACTIVE","COMPONENT_ALREADY_EXPIRED","COMPONENT_EXPIRY_TRANSITION_INVALID","COMPONENT_VERSION_CONFLICT","V2_1_CONTRACT_REQUIRED","V2_IDEMPOTENCY_CONFLICT"])("gives actionable 409 %s", code => {
    const result = mutationError(new ApiRequestError(409,"Unhelpful server text",code));
    expect(result).toMatchObject({discardAttempt:true,requiresCorrection:true});
    expect(result.message).not.toContain("Unhelpful");
    if (code === "COMPONENT_EXPIRY_RESERVATION_ACTIVE") expect(result.message).toContain("Cancel the active reservation");
  });
});
