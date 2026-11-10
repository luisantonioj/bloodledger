import { useCallback, useEffect } from "react";
import type { Principal } from "../../auth/permissions";
import { usePagedRead } from "../../hooks/use-paged-read";
import { canReadPrcSupply, parsePrcSupplyList, type PrcSupplyRequest } from "../../services/api/prc-supply";

// PRC supply requests still awaiting an outcome (not fulfilled, declined or cancelled).
export const OPEN_SUPPLY_STATUSES = ["SUBMITTED", "ACKNOWLEDGED"];
export const openSupplyCount = (rows: PrcSupplyRequest[] | null) => rows ? rows.filter(row => OPEN_SUPPLY_STATUSES.includes(row.status)).length : null;

export interface PrcSupplyRead { rows: PrcSupplyRequest[] | null; busy: boolean; error: string }

// Reads every page for PRC accounts so dashboard counts and tables cover all requests,
// not just the first batch. rows is null while loading or when the read is unavailable.
export function usePrcSupplyRequests(principal: Principal): PrcSupplyRead {
  const enabled = principal.accountCategory === "PRC" && canReadPrcSupply(principal);
  const parser = useCallback((value: unknown) => parsePrcSupplyList(value, principal), [principal]);
  const list = usePagedRead(enabled ? "/api/v2/prc-supply-requests" : null, parser, "requestId", principal.accountCategory + "|" + principal.institutionId);
  const { nextCursor, busy, error, loadMore, refresh } = list;
  useEffect(() => { if (nextCursor && !busy && !error) loadMore(); }, [nextCursor, busy, error]);
  useEffect(() => {
    window.addEventListener("bloodledger:dashboard-refresh", refresh);
    return () => window.removeEventListener("bloodledger:dashboard-refresh", refresh);
  }, [refresh]);
  const complete = enabled && list.ready && !nextCursor && !error;
  return { rows: complete ? list.rows : null, busy: enabled && (busy || Boolean(nextCursor)), error: enabled ? error : "" };
}
