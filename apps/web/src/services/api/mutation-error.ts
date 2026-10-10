import { ApiRequestError } from "./client";

// TP-JOP-D01/D02, FR-08/12: only rejected commands may discard their attempt.
export function mutationError(reason: unknown, previousTimeRejections = 0) {
  if (reason instanceof ApiRequestError) {
    if (reason.status === 400 && reason.code === "V2_COMMAND_TIME_OUT_OF_WINDOW") {
      return { discardAttempt: true, requiresCorrection: false, timeRejected: true,
        message: "The command time was rejected. Submit again with a fresh time and request key." +
          (previousTimeRejections > 0 ? " Check your device clock; it may be wrong." : "") };
    }
    const clientErrors: Record<string, string> = {
      REQUEST_INVALID: "The request body is invalid. Correct the input before submitting again.",
      REQUEST_BODY_TOO_LARGE: "The request is too large. Reduce the input before submitting again.",
      REQUEST_MEDIA_TYPE_UNSUPPORTED: "The request format is unsupported. Refresh the app before submitting again.",
    };
    if ([400, 413, 415].includes(reason.status) && reason.code && clientErrors[reason.code]) {
      return { discardAttempt: true, requiresCorrection: true, timeRejected: false, message: clientErrors[reason.code] };
    }
    const conflicts: Record<string, string> = {
      COMPONENT_LABEL_NOT_EXPIRED: "The label has not expired. Refresh the component before continuing.",
      COMPONENT_EXPIRY_RESERVATION_ACTIVE: "Cancel the active reservation through its authorized workflow before evaluating expiry.",
      COMPONENT_ALREADY_EXPIRED: "This component is already expired. Refresh its current state.",
      COMPONENT_EXPIRY_TRANSITION_INVALID: "Expiry cannot be evaluated from this inventory state. Refresh the component.",
      COMPONENT_VERSION_CONFLICT: "The component changed. Refresh it before evaluating expiry again.",
      V2_1_CONTRACT_REQUIRED: "Expiry evaluation requires the V2.1 contract. Refresh the app before continuing.",
      V2_IDEMPOTENCY_CONFLICT: "This request key conflicts with an earlier command. Refresh and review the current record.",
    };
    if (reason.status === 409 && reason.code && conflicts[reason.code]) {
      return { discardAttempt: true, requiresCorrection: true, timeRejected: false, message: conflicts[reason.code] };
    }
  }
  return { discardAttempt: false, requiresCorrection: false, timeRejected: false,
    message: reason instanceof Error ? reason.message : "The command was not accepted. Retry the same request." };
}
