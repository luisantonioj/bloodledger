export function RefreshIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.36-6.36L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.36 6.36L3 16M8 16H3v5"/></svg>;
}

export function RefreshButton({busy=false,onRefresh}:{busy?:boolean;onRefresh:()=>void}) {
  return <button className="button compact dashboard-refresh" type="button" onClick={onRefresh} disabled={busy} aria-busy={busy}><RefreshIcon/>{busy ? "Refreshing…" : "Refresh"}</button>;
}
