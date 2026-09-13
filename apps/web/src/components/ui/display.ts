export function formatManilaDateTime(value:string|null):string {
  return value
    ? new Intl.DateTimeFormat("en-PH", { timeZone:"Asia/Manila", dateStyle:"medium", timeStyle:"short" }).format(new Date(value))
    : "Not yet projected";
}

export function formatBloodType(value:string):string {
  return value.replace("_POSITIVE", "+").replace("_NEGATIVE", "-").replaceAll("_", " ");
}

export const humanizeCode = (value:string) => value.replaceAll("_", " ");

export function statusClassName(value:string):string {
  if (["CRITICAL", "FAILED", "COMPROMISED", "REJECTED"].includes(value)) return "status critical";
  if (["WARNING", "DELAYED", "PENDING"].includes(value)) return "status warning";
  return "status ";
}
