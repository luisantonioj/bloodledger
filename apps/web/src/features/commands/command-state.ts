import type { V2CommandStatus } from "../../services/api/v2";

export interface CommandPresentation {
  label: string;
  detail: string;
  tone: "information" | "warning" | "success" | "critical";
  terminal: boolean;
}

export const COMMAND_PRESENTATION: Record<V2CommandStatus, CommandPresentation> = {
  QUEUED: { label: "Accepted and queued", detail: "The command is durable but no ledger commitment is claimed.", tone: "information", terminal: false },
  SUBMITTING: { label: "Submitting to ledger", detail: "The backend is processing the existing command.", tone: "information", terminal: false },
  RETRY_WAIT: { label: "Waiting to retry", detail: "The same command will retry; the browser does not resubmit it.", tone: "warning", terminal: false },
  LEDGER_COMMITTED_PROJECTION_PENDING: { label: "Ledger committed; projection pending", detail: "Commitment exists, but the read model is not current yet.", tone: "information", terminal: false },
  COMMITTED: { label: "Committed", detail: "The ledger and authorized projection have completed.", tone: "success", terminal: true },
  FAILED: { label: "Failed", detail: "The command stopped with a safe failure code and was not presented as committed.", tone: "critical", terminal: true },
  CONFLICT: { label: "Conflict", detail: "The command conflicts with current state and requires human review.", tone: "critical", terminal: true },
};
