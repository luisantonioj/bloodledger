import { formatBloodType } from "../../components/ui/display";

type ProductComparison = { bloodType: string; value: number | null; note?: string };
export function ProductComparisonChart({ rows, label, tone = "demand" }: { rows: ProductComparison[]; label: string; tone?: "demand" | "excess" }) {
  const maximum = Math.max(1, ...rows.map(row => row.value ?? 0));
  const amount = (value: number) => value.toLocaleString("en-PH", { maximumFractionDigits: 2 });
  return <div className={"analytics-product-chart analytics-chart-" + tone}>
    <div className="analytics-chart-column-headings"><span>Blood type</span><span>Units</span></div>
    <ul aria-label={label}>{rows.map(row => <li key={row.bloodType}>
      <strong>{formatBloodType(row.bloodType)}</strong>
      <div className="analytics-product-track" aria-hidden="true"><span style={{ width: (row.value === null ? 0 : row.value / maximum * 100) + "%" }}/></div>
      <div className="analytics-product-amount"><strong>{row.value === null ? "Unavailable" : amount(row.value)}</strong>{row.note && <small>{row.note}</small>}</div>
    </li>)}</ul>
    {!rows.length && <p className="analytics-chart-missing">{tone === "demand" ? "No results for this component. Missing forecasts are not zero demand." : "No results for this component. Missing evidence is not zero excess."}</p>}
    <p className="analytics-chart-footnote">Only blood types with returned records are shown. Each chart uses its own unit scale.</p>
  </div>;
}
