const dateFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

export function RecordTime({ value }: { value: string | null }) {
  if (!value) return <>—</>;
  const date = new Date(value);
  return <time className="transaction-time" dateTime={value}><span>{dateFormat.format(date)}</span><small>{timeFormat.format(date)}</small></time>;
}
