import { humanizeCode, statusClassName } from "../../components/ui/display";
import type { V2Command } from "../../services/api/v2";
import { COMMAND_PRESENTATION } from "./command-state";

export function CommandStatusCard({ command, pollError, onClear, summary }: { command: V2Command; pollError: string; onClear: () => void; summary?: {complete: string; detail?: string} }) {
  const presentation = COMMAND_PRESENTATION[command.status];
  const details = <>
    <dl><div><dt>Resource</dt><dd className="mono">{command.resourceId}</dd></div><div><dt>Command</dt><dd className="mono">{command.commandId}</dd></div><div><dt>Correlation</dt><dd className="mono">{command.correlationId}</dd></div></dl>
    {command.safeErrorCode && <p className="v2-command-error" role={summary ? undefined : "alert"}>Safe code: {command.safeErrorCode}</p>}
  </>;
  if (summary) return <section className="transfer-update-notice" data-tone={presentation.tone} aria-live="polite">
    <h3>{command.status === "COMMITTED" ? summary.complete : presentation.terminal ? "Transfer update needs attention" : "Waiting for confirmation"}</h3>
    <p>{command.status === "COMMITTED" ? summary.detail ?? "The transfer record is up to date." : presentation.terminal ? "Check the current transfer before trying again." : pollError ? "We’re still checking the result. Keep this attempt open." : "The update was sent. The transfer status will change after confirmation."}</p>
    <details><summary>Technical details</summary><p>{presentation.label}</p>{details}</details>
    {presentation.terminal && <button className="button compact" type="button" onClick={onClear}>Dismiss status</button>}
  </section>;
  return <section className="v2-command-card" aria-live="polite">
    <header><div><p className="eyebrow">Asynchronous command</p><h3>{presentation.label}</h3></div><span className={statusClassName(command.status)}>{humanizeCode(command.status)}</span></header>
    <p>{presentation.detail}</p>
    {details}
    {pollError && <p className="v2-command-warning" role="status">Status check delayed: {pollError}. The accepted command was not resubmitted.</p>}
    {presentation.terminal && <button className="button compact" type="button" onClick={onClear}>Dismiss status</button>}
  </section>;
}
