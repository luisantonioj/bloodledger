export interface AlertAcknowledgementInput {
  alertId: string;
  userId: string;
  institutionId: string;
  idempotencyKey: string;
  payloadSha256: string;
  correlationId: string;
  auditEventId: string;
  acknowledgedAt: Date;
}

export interface AlertAcknowledgementResult {
  alertId: string;
  acknowledgedAt: string;
  replayed: boolean;
  classification: "SIMULATION_ONLY";
}

export interface ApplicationWriteRepository {
  acknowledgeAlert(input: AlertAcknowledgementInput): Promise<AlertAcknowledgementResult | null>;
}
