export const invalidRead = () => new Error("The read response is incomplete or inconsistent.");
export function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))throw invalidRead();return value as Record<string,unknown>;}
export function text(value:unknown):string{if(typeof value!=="string"||!value)throw invalidRead();return value;}
export function nullableText(value:unknown){return value===null?null:text(value);}
export function choice<const T extends readonly string[]>(value:unknown,values:T):T[number]{if(typeof value!=="string"||!values.includes(value))throw invalidRead();return value as T[number];}
export function nullableChoice<const T extends readonly string[]>(value:unknown,values:T):T[number]|null{return value===null?null:choice(value,values);}
export function timestamp(value:unknown){const result=text(value);if(!/(Z|[+-]\d{2}:\d{2})$/.test(result)||!Number.isFinite(Date.parse(result)))throw invalidRead();return result;}
export function nullableTimestamp(value:unknown){return value===null?null:timestamp(value);}
export function integer(value:unknown){if(!Number.isSafeInteger(value)||Number(value)<1)throw invalidRead();return Number(value);}
export function stringList(value:unknown){if(!Array.isArray(value))throw invalidRead();const values=value.map(text);if(new Set(values).size!==values.length)throw invalidRead();return values;}
