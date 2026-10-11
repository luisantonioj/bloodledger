export function RefreshButton({busy=false,onRefresh}:{busy?:boolean;onRefresh:()=>void}) {
  return <button className="button compact dashboard-refresh" type="button" onClick={onRefresh} disabled={busy} aria-busy={busy}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4v6h6M20 20v-6h-6M5 14a8 8 0 0 0 14 4M19 10a8 8 0 0 0-14-4"/></svg>{busy ? "Refreshing…" : "Refresh"}</button>;
}
