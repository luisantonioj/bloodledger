import { useEffect, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { readCompleteCensusIndex, type CensusSnapshot } from "../../services/api/census-index";

export interface CheckpointRecordsRead { snapshots: CensusSnapshot[] | null; busy: boolean; error: string; loadedAt: number | null }

// All saved stock records visible to a PRC account (every blood bank). Refreshes with the dashboard.
// `regulatory` lets any ROLE-04 (network-scope) account read them, e.g. the Reports page.
export function useCheckpointRecords(principal: Principal, regulatory = false): CheckpointRecordsRead {
  const enabled = principal.roleId === "ROLE-04" && (regulatory || principal.accountCategory === "PRC");
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<CheckpointRecordsRead>({ snapshots: null, busy: enabled, error: "", loadedAt: null });
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("bloodledger:dashboard-refresh", refresh);
    return () => window.removeEventListener("bloodledger:dashboard-refresh", refresh);
  }, []);
  useEffect(() => {
    if (!enabled) { setState({ snapshots: null, busy: false, error: "", loadedAt: null }); return; }
    const controller = new AbortController();
    setState(previous => ({ ...previous, busy: true, error: "" }));
    readCompleteCensusIndex(principal, controller.signal)
      .then(index => { if (!controller.signal.aborted) setState({ snapshots: index.snapshots, busy: false, error: "", loadedAt: Date.now() }); })
      .catch(reason => { if (!controller.signal.aborted) setState({ snapshots: null, busy: false, error: reason instanceof Error ? reason.message : "Saved stock records are unavailable.", loadedAt: null }); });
    return () => controller.abort();
  }, [enabled, principal.accountId, principal.institutionId, revision]);
  return state;
}
