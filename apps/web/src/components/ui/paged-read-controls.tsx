export function PagedReadControls({ready,count,nextCursor,busy,error,loadMore}:{ready:boolean;count:number;nextCursor?:string|null;busy:boolean;error:string;loadMore:()=>void}){
 return <div className="paged-read-controls">{error&&<p role="alert">{error}</p>}{ready&&<><span>{count} loaded rows · {nextCursor===null?"All rows loaded":"More available"}</span>{nextCursor&&<button className="button compact" disabled={busy} onClick={loadMore}>{busy?"Loading…":"Load more"}</button>}</>}</div>;
}
