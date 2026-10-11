import type { V2ExpiryState } from "../../services/api/v2";

export function ExpiryState({ state }: { state: V2ExpiryState }) {
  const presentation = {
    CURRENT: { tone: "", label: "Label current" },
    LABEL_EXPIRED_PENDING_EVALUATION: { tone: "warning", label: "Label expired — evaluation pending; not usable" },
    EXPIRED: { tone: "critical", label: "Expired" },
    LABEL_EXPIRED_NOT_IN_INVENTORY: { tone: "warning", label: "Label expired — outside available/reserved inventory" },
  }[state];
  return <span className={"status " + presentation.tone} title={state}>{presentation.label}</span>;
}
