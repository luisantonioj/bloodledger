// node-postgres returns timestamptz as Date; String(date) drops milliseconds, which would truncate
// returned times and break (time, id) cursors. Always serialize through toISOString.
export function isoTimestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
export function nullableIsoTimestamp(value: unknown): string | null {
  return value === null || value === undefined ? null : isoTimestamp(value);
}
