import { useEffect, useState } from "react";
import { humanizeCode } from "../../components/ui/display";
import { readCommandPage, type V2Command } from "../../services/api/v2";
import { CommandStatusCard } from "./command-status-card";
import { useCommandStatus } from "./use-command-status";

export function CommandRecoveryWorkspace({ actorKey }: { actorKey: string }) {
  const [commands, setCommands] = useState<V2Command[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const status = useCommandStatus();
  async function recover(nextCursor?: string) {
    try {
      const page = await readCommandPage(nextCursor);
      setCommands((previous) => nextCursor ? [...previous, ...page.items] : page.items);
      setCursor(page.nextCursor);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Command recovery is unavailable."); }
  }
  useEffect(() => { setCommands([]); status.clear(); void recover(); }, [actorKey]);
  return <section className="v2-operation-card"><header><div><p className="eyebrow">Actor-scoped recovery</p><h3>Recent commands</h3><p>Reload or a lost response does not create a replacement submission. Check the server status first.</p></div><button className="button compact" type="button" onClick={() => void recover()}>Refresh</button></header>
    {error && <p role="alert">{error}</p>}
    {commands.length === 0 ? <p>No commands returned for this authenticated actor.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Command</th><th>Resource</th><th>Status</th><th></th></tr></thead><tbody>{commands.map((command) => <tr key={command.commandId}><td className="mono">{command.commandId}</td><td>{command.resourceId}</td><td>{humanizeCode(command.status)}</td><td><button className="button compact" type="button" onClick={() => status.accept(command)}>Track</button></td></tr>)}</tbody></table></div>}
    {cursor && <button className="button compact" type="button" onClick={() => void recover(cursor)}>Load more</button>}
    {status.command && <CommandStatusCard command={status.command} pollError={status.pollError} onClear={status.clear}/>}
  </section>;
}
