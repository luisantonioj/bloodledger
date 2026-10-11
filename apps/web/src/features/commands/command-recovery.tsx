import { useEffect, useRef, useState } from "react";
import { readCommand, readCommandByKey } from "../../services/api/v2";
import { CommandStatusCard } from "./command-status-card";
import { useCommandStatus } from "./use-command-status";

export function CommandRecovery({ resourceId, onRefresh }: { resourceId?: string; onRefresh: () => void }) {
  const command = useCommandStatus(onRefresh);
  const [id, setId] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [lookup, setLookup] = useState<"command" | "key">("command");
  const valid = lookup === "command" ? /^CMD_[A-Z0-9_-]+$/.test(id) : /^IDEM_[A-Z0-9_-]{1,59}$/.test(id);
  const mounted = useRef(true);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  async function recover() {
    if (busy || command.command || !valid) return;
    setBusy(true); setError("");
    try {
      const existing = lookup === "command" ? await readCommand("/api/v2/commands/" + id) : await readCommandByKey(id);
      if (!mounted.current) return;
      if (!existing) throw new Error("No accepted command was found for this request key. Nothing was resubmitted.");
      // Reconciliation commands use a case ID, so recover those in their own workspace.
      if (resourceId && existing.resourceId !== resourceId) throw new Error("This command belongs to a different resource. No command was resubmitted.");
      command.accept(existing);
      if (["COMMITTED", "FAILED", "CONFLICT"].includes(existing.status)) onRefresh();
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Command recovery unavailable."); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className="v2-operation-card"><h3>Recover accepted command</h3><p>Enter the saved command ID to resume status checks. Recovery never resubmits a command.</p>
    <form onSubmit={event => {event.preventDefault(); void recover();}}><label>Recovery lookup<select value={lookup} disabled={busy || !!command.command} onChange={event => {setLookup(event.target.value as "command" | "key");setId("");setError("");}}><option value="command">Command ID</option><option value="key">Saved request key</option></select></label><label>{lookup === "command" ? "Accepted command ID" : "Saved request key"}<input value={id} disabled={busy || !!command.command} onChange={event => setId(event.target.value)} required pattern={lookup === "command" ? "CMD_[A-Z0-9_-]+" : "IDEM_[A-Z0-9_-]{1,59}"}/></label><button className="button" disabled={busy || !!command.command || !valid}>{busy ? "Reading command…" : "Recover command status"}</button></form>
    {error && <p role="alert">{error}</p>}{command.command && <CommandStatusCard command={command.command} pollError={command.pollError} onClear={command.clear}/>}</section>;
}
