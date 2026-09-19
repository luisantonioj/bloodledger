import { humanizeCode, statusClassName } from "../../components/ui/display";
import type { V2Command } from "../../services/api/v2";
import { COMMAND_PRESENTATION } from "./command-state";

export function CommandStatusCard({ command, pollError, onClear }: { command: V2Command; pollError: string; onClear: () => void }) {
  const presentation = COMMAND_PRESENTATION[command.status];
  return <section className="v2-command-card" aria-live="polite">
    <header><div><p className="eyebrow">Asynchronous command</p><h3>{presentation.label}</h3></div><span className={statusClassName(command.status)}>{humanizeCode(command.status)}</span></header>
    <p>{presentation.detail}</p>
    <dl><div><dt>Resource</dt><dd className="mono">{command.resourceId}</dd></div><div><dt>Command</dt><dd className="mono">{command.commandId}</dd></div><div><dt>Correlation</dt><dd className="mono">{command.correlationId}</dd></div></dl>
    {command.safeErrorCode && <p className="v2-command-error" role="alert">Safe code: {command.safeErrorCode}</p>}
    {pollError && <p className="v2-command-warning" role="status">Status check delayed: {pollError}. The accepted command was not resubmitted.</p>}
    {presentation.terminal && <button className="button compact" type="button" onClick={onClear}>Dismiss status</button>}
  </section>;
}
