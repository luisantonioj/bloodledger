import {useLiveData} from "./use-live-data";
export function useValidatedRead<T>(endpoint:string|null,parse:(value:unknown)=>T){
 const state=useLiveData<unknown>(endpoint);let data:T|undefined,error=state.error;
 if(!error&&state.data!==undefined)try{data=parse(state.data);}catch{error="Current evidence could not be verified. Refresh to try again.";}
 return {...state,data,error};
}
