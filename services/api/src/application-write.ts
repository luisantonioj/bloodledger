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

export interface TransferRequestCommand {
  transferId: string;
  destinationInstitutionId: string;
  actorUserId: string;
  bloodType: "A_POSITIVE" | "O_POSITIVE";
  component: "RED_BLOOD_CELLS" | "PLATELETS";
  quantity: number;
  urgency: "ROUTINE" | "URGENT" | "CRITICAL";
  requestTime: string;
  eventTime: string;
  correlationId: string;
  idempotencyKey: string;
  payloadSha256: string;
  transferEventId: string;
  auditEventId: string;
}

export interface TransferRequestResult {
  transferId: string;
  status: "PENDING";
  ledgerVersion: number;
  ledgerTransactionId: string;
  projectedAt: string;
  replayed: boolean;
  classification: "SIMULATION_ONLY";
}

export interface TransferRejectionCommand {
  transferId: string;
  sourceInstitutionId: string;
  actorUserId: string;
  expectedVersion: number;
  reasonCode: string;
  eventTime: string;
  correlationId: string;
  idempotencyKey: string;
  payloadSha256: string;
  transferEventId: string;
  auditEventId: string;
}

export interface TransferRejectionResult {
  transferId: string;
  status: "REJECTED";
  reasonCode: string;
  ledgerVersion: number;
  ledgerTransactionId: string;
  projectedAt: string;
  replayed: boolean;
  classification: "SIMULATION_ONLY";
}

export interface ApplicationWriteRepository {
  acknowledgeAlert(input: AlertAcknowledgementInput): Promise<AlertAcknowledgementResult | null>;
  submitTransferRequest(input: TransferRequestCommand): Promise<TransferRequestResult>;
  rejectTransfer(input: TransferRejectionCommand): Promise<TransferRejectionResult | null>;
}
