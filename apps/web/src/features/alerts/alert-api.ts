import { requestJson } from "../../services/api/client";
import type { MutationKeys } from "../../services/api/mutation-keys";

export interface AlertAcknowledgementPayload {
  correlationId: string;
}

export interface AlertAcknowledgementResult {
  alertId: string;
  acknowledgedAt: string;
  replayed: boolean;
  classification: "SIMULATION_ONLY";
}

export function acknowledgeAlert(alertId: string, payload: AlertAcknowledgementPayload, keys: MutationKeys): Promise<AlertAcknowledgementResult> {
  return requestJson(`/api/v1/alerts/${encodeURIComponent(alertId)}/acknowledgements`, {
    method: "POST",
    headers: { "Idempotency-Key": keys.idempotencyKey },
    body: JSON.stringify(payload),
  }, "Acknowledgement failed.");
}
