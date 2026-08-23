export function pollingDelay(failures:number):number{return Math.min(30_000,2_000*2**Math.min(failures,4))}
