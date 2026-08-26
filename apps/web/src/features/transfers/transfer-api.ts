import { requestJson } from "../../services/api/client";
import type { MutationKeys } from "../../services/api/mutation-keys";

export interface VersionedTransferPayload {
  expectedVersion: number;
  eventTime: string;
  correlationId: string;
}

export interface ReasonedTransferPayload extends VersionedTransferPayload {
  reasonCode: string;
}

export interface TransferLocation {
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  source: "FACILITY_FALLBACK";
  fallbackReason: string;
  capturedAt: string;
}

export interface LocatedTransferPayload extends VersionedTransferPayload {
  location: TransferLocation;
}

export interface CreateTransferPayload {
  bloodType: string;
  component: string;
  quantity: number;
  urgency: string;
  requestTime: string;
  eventTime: string;
  correlationId: string;
}

type TransferMutationResult = { ledgerTransactionId?: string; ledgerVersion?: number };
export type CreateTransferResult = TransferMutationResult & { transferId?: string };
export type ApproveTransferResult = TransferMutationResult & { selectedUnitIds?: string[] };
export type DispatchTransferResult = TransferMutationResult & { locationEvidence?: { evidenceId: string } };
export type CancelTransferResult = TransferMutationResult & { releasedUnitIds?: string[] };

function mutationInit(keys: MutationKeys, payload: object): RequestInit {
  return {
    method: "POST",
    headers: { "Idempotency-Key": keys.idempotencyKey },
    body: JSON.stringify(payload),
  };
}

function transferPath(transferId: string, action: string): string {
  return `/api/v1/transfers/${encodeURIComponent(transferId)}/${action}`;
}

export function transferDetailPath(transferId: string): string {
  return `/api/v1/transfers/${encodeURIComponent(transferId)}`;
}

export function createTransfer(payload: CreateTransferPayload, keys: MutationKeys): Promise<CreateTransferResult> {
  return requestJson("/api/v1/transfers", mutationInit(keys, payload), "Transfer request failed.");
}

export function approveTransfer(transferId: string, payload: VersionedTransferPayload, keys: MutationKeys): Promise<ApproveTransferResult> {
  return requestJson(transferPath(transferId, "approval"), mutationInit(keys, payload), "Transfer approval failed.");
}

export function rejectTransfer(transferId: string, payload: ReasonedTransferPayload, keys: MutationKeys): Promise<TransferMutationResult> {
  return requestJson(transferPath(transferId, "rejection"), mutationInit(keys, payload), "Transfer rejection failed.");
}

export function delayTransfer(transferId: string, payload: ReasonedTransferPayload, keys: MutationKeys): Promise<TransferMutationResult> {
  return requestJson(transferPath(transferId, "delay"), mutationInit(keys, payload), "Delay reporting failed.");
}

export function resumeTransfer(transferId: string, payload: VersionedTransferPayload, keys: MutationKeys): Promise<TransferMutationResult> {
  return requestJson(transferPath(transferId, "resume"), mutationInit(keys, payload), "Resuming transit failed.");
}

export function receiveTransfer(transferId: string, payload: LocatedTransferPayload, keys: MutationKeys): Promise<TransferMutationResult> {
  return requestJson(transferPath(transferId, "receipt"), mutationInit(keys, payload), "Transfer receipt failed.");
}

export function startTransferTransit(transferId: string, payload: VersionedTransferPayload, keys: MutationKeys): Promise<TransferMutationResult> {
  return requestJson(transferPath(transferId, "transit-start"), mutationInit(keys, payload), "Starting transit failed.");
}

export function dispatchTransfer(transferId: string, payload: LocatedTransferPayload, keys: MutationKeys): Promise<DispatchTransferResult> {
  return requestJson(transferPath(transferId, "dispatch"), mutationInit(keys, payload), "Transfer dispatch failed.");
}

export function cancelTransfer(transferId: string, payload: ReasonedTransferPayload, keys: MutationKeys): Promise<CancelTransferResult> {
  return requestJson(transferPath(transferId, "cancellation"), mutationInit(keys, payload), "Transfer cancellation failed.");
}
