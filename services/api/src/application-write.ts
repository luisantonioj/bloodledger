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

export interface TransferApprovalCommand {
  transferId: string;
  sourceInstitutionId: string;
  actorUserId: string;
  expectedVersion: number;
  eventTime: string;
  correlationId: string;
  idempotencyKey: string;
  payloadSha256: string;
  transferEventId: string;
  auditEventId: string;
}

export interface TransferApprovalResult {
  transferId: string;
  status: "APPROVED";
  selectedUnitIds: string[];
  ledgerVersion: number;
  ledgerTransactionId: string;
  projectedAt: string;
  replayed: boolean;
  classification: "SIMULATION_ONLY";
}

export interface TransferDispatchCommand {
  transferId: string;
  sourceInstitutionId: string;
  actorUserId: string;
  expectedVersion: number;
  eventTime: string;
  correlationId: string;
  idempotencyKey: string;
  payloadSha256: string;
  transferEventId: string;
  auditEventId: string;
  locationEvidence: {
    evidenceId: string;
    evidenceDigest: string;
    institutionId: string;
    phase: "DISPATCH";
    latitude: number;
    longitude: number;
    accuracyMetres: number;
    source: "DEVICE" | "FACILITY_FALLBACK";
    fallbackReason: "DEVICE_UNAVAILABLE" | "PERMISSION_DENIED" | "SIGNAL_UNAVAILABLE" | null;
    capturedAt: string;
    facilityMatched: boolean;
    fallback: boolean;
    policyVersion: "SYNTHETIC_LOCATION_V1";
    classification: "SYNTHETIC_DATA";
    deleteAfter: string;
  };
}

export interface TransferDispatchResult {
  transferId: string;
  status: "DISPATCHED";
  dispatchedUnitIds: string[];
  locationEvidence: {
    evidenceId: string;
    capturedAt: string;
    source: "DEVICE" | "FACILITY_FALLBACK";
    facilityMatched: boolean;
    fallback: boolean;
    policyVersion: "SYNTHETIC_LOCATION_V1";
  };
  ledgerVersion: number;
  ledgerTransactionId: string;
  projectedAt: string;
  replayed: boolean;
  classification: "SIMULATION_ONLY";
}

export interface TransferCancellationCommand {
  transferId: string;
  actorInstitutionId: string;
  actorRoleId: "ROLE-02" | "ROLE-03";
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

export interface TransferCancellationResult {
  transferId: string;
  status: "CANCELLED";
  reasonCode: string;
  releasedUnitIds: string[];
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
  approveTransfer(input: TransferApprovalCommand): Promise<TransferApprovalResult | null>;
  cancelTransfer(input: TransferCancellationCommand): Promise<TransferCancellationResult | null>;
  dispatchTransfer(input: TransferDispatchCommand): Promise<TransferDispatchResult | null>;
  rejectTransfer(input: TransferRejectionCommand): Promise<TransferRejectionResult | null>;
}
