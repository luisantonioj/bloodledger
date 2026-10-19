import { useEffect, useMemo, useState } from "react";
import type { Principal } from "../../auth/permissions";
import { readCoordination, seriesQuery, type RpsPriorityView } from "../../services/api/coordination";

/** RPS rank and explanation for one pending request, within its supplier/blood type/component group. */
export interface RequestPriority { rank: number; groupSize: number; score: number; urgencyContribution: number; waitContribution: number; waitHours: number; policyVersion: string; runId: string | null }
interface PriorityRequest { transfer_id: string; source_institution_id?: string; blood_type: string; component_type: string }

/** Distinct series of the supplier's own requests; RPS only ranks requests that compete for the same stock. */
export function prioritySeries(requests: PriorityRequest[], institutionId: string): string[] {
  return [...new Set(requests.filter(row => row.source_institution_id === institutionId).map(row => row.blood_type + "|" + row.component_type))].sort();
}

/** Maps each ranked transfer to its RPS rank (FR-06, TC-T01/TC-T02). Advisory only; never reserves stock. */
export function priorityByTransfer(views: RpsPriorityView[]): Map<string, RequestPriority> {
  const byId = new Map<string, RequestPriority>();
  for (const view of views) {
    if (view.status !== "AVAILABLE") continue;
    for (const row of view.ranked) byId.set(row.transferId, { rank: row.rank, groupSize: view.ranked.length, score: row.score, urgencyContribution: row.urgencyContribution, waitContribution: row.waitContribution, waitHours: row.waitHours, policyVersion: view.policyVersion, runId: view.runId });
  }
  return byId;
}

export function useRequestPriorities(principal: Principal, requests: PriorityRequest[], enabled: boolean, refreshKey = 0) {
  const series = useMemo(() => enabled ? prioritySeries(requests, principal.institutionId) : [], [enabled, requests, principal.institutionId]);
  const key = series.join(",");
  const [state, setState] = useState<{ key: string; byId: Map<string, RequestPriority>; error: boolean }>({ key: "", byId: new Map(), error: false });
  useEffect(() => {
    if (!series.length) { setState({ key, byId: new Map(), error: false }); return; }
    const controller = new AbortController();
    void Promise.all(series.map(item => {
      const [bloodType, componentType] = item.split("|");
      return readCoordination<RpsPriorityView>("/api/v2/coordination/priority?" + seriesQuery(bloodType, componentType), principal.institutionId, controller.signal);
    })).then(views => { if (!controller.signal.aborted) setState({ key, byId: priorityByTransfer(views), error: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ key, byId: new Map(), error: true }); });
    return () => controller.abort();
  }, [key, principal.institutionId, refreshKey]);
  return { byId: state.key === key ? state.byId : new Map<string, RequestPriority>(), error: state.key === key && state.error };
}
