import { retryAfterContextChange } from "../../services/api/client";
import { useEffect, useState } from "react";
import { readV2Components, type V2Component } from "../../services/api/v2";
import { eligibleStockCounts } from "./stock-classification";

export function useStockEvidence(institutionId: string | undefined, refreshKey: unknown) {
  const [evidence, setEvidence] = useState<{institutionId: string; components: V2Component[]; fetchedAt: number}>();
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let closed = false, sequence = 0;
    if (!institutionId) { setEvidence(undefined); setError(""); return; }
    const read = async () => {
      const current = ++sequence;
      try {
        const response = await retryAfterContextChange(() => readV2Components("V2.1"), () => !closed && current === sequence), fetchedAt = Date.now();
        if (closed || current !== sequence) return;
        if (!eligibleStockCounts(response.components, institutionId, fetchedAt, fetchedAt)) throw Error("Invalid stock scope");
        setEvidence({institutionId, components: response.components, fetchedAt}); setNow(fetchedAt); setError("");
      } catch {
        if (!closed && current === sequence) { setEvidence(undefined); setError("Stock classification unavailable: current component evidence could not be verified."); }
      }
    };
    void read();
    const timer = setInterval(() => { if (!document.hidden) void read(); }, 30000);
    const visible = () => { if (!document.hidden) void read(); };
    document.addEventListener("visibilitychange", visible);
    return () => { closed = true; clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [institutionId, refreshKey]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const counts = evidence && evidence.institutionId === institutionId ? eligibleStockCounts(evidence.components, institutionId!, evidence.fetchedAt, now) : null;
  return {counts, error, evaluatedAt: counts && evidence ? evidence.fetchedAt : null};
}
