export function DashboardReadState({error, loading=false, retained=false, onRetry}:{error?:string;loading?:boolean;retained?:boolean;onRetry:()=>void}) {
  return <div className={"dashboard-read-state"+(loading?" is-loading":"")} role={loading?"status":"alert"}>
    <span className="dashboard-read-icon" aria-hidden="true">{loading?"…":"!"}</span>
    <div className="dashboard-read-copy"><strong>{loading?"Loading dashboard":retained?"Dashboard could not refresh":"Unable to load dashboard data"}</strong><p>{loading?"Fetching the latest authorized information.":retained?"Your last confirmed view remains available below.":"Inventory information is temporarily unavailable. You can retry to load it."}</p>{error&&<details><summary>View details</summary><p>{error}</p></details>}</div>
    {!loading&&<button className="button compact" onClick={onRetry}>Retry</button>}
  </div>;
}
