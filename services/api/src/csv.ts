export function csvCell(value: string | number): string {
  let safe = String(value);
  if (/^[=+@\s-]/.test(safe)) safe = "'" + safe;
  return '"' + safe.replaceAll('"', '""') + '"';
}
