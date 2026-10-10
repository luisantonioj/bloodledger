export function ActionIcon({kind}:{kind:"download"|"upload"|"scanner"}){
 const path=kind==="download"?"M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4":kind==="upload"?"M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4":"M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M7 12h10";
 return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg>;
}
