import { formatBloodType } from "../../components/ui/display";
import type { CSSProperties } from "react";
import type { Aggregate } from "../../services/api/types";
import { summarizeInventoryByBloodType } from "./inventory-overview";

// Supplied only by the isolated visual-review host, never by a dashboard API response.
export type SampleStockIndicator = { bloodType: string; status: "critical" | "low" | "adequate" | "surplus"; surplus: number };

export function InventoryOverviewChart({ items, sampleIndicators }: { items: Aggregate[]; sampleIndicators?: SampleStockIndicator[] }) {
  const summary = summarizeInventoryByBloodType(items);
  const maximum = Math.ceil(Math.max(5, ...summary.map(item => item.confirmed)) / 5) * 5;
  const ticks = Array.from({ length: 6 }, (_, index) => maximum * (5 - index) / 5);
  return <section className="inventory-overview-card" aria-labelledby="inventory-overview-title">
    <header>
      <div><h2 id="inventory-overview-title">Blood Inventory Overview</h2>{sampleIndicators && <p>Sample stock indicators for design review.</p>}</div>
      <a className="inventory-overview-link" href="/inventory">View inventory →</a>
    </header>
    <div className="inventory-overview-scroll">
      <div className="inventory-overview-legend" aria-label="Inventory status legend">
        <span><i className="critical" />Critical</span><span><i className="low" />Low</span><span><i className="adequate" />Adequate</span><span><i className="surplus" />Surplus / available to redistribute</span>
      </div>
      <div className="inventory-overview-frame">
        <div className="inventory-overview-axis-title">Quantity (units)</div>
        <div className="inventory-overview-axis" aria-hidden="true">{ticks.map((tick, index) => <span key={tick} style={{ "--tick-index": index } as CSSProperties}>{tick}</span>)}</div>
        <div className="inventory-overview-chart" role="list" aria-label="Ledger-confirmed inventory by blood type">
          {summary.map(item => {
            const sample = sampleIndicators?.find(indicator => indicator.bloodType === item.bloodType);
            const barHeight = item.confirmed / maximum * 100;
            const surplus = sample ? Math.min(item.confirmed, Math.max(0, sample.surplus)) : 0;
            return <div className={`inventory-overview-bar stock-${sample?.status ?? "unknown"}`} role="listitem" key={item.bloodType}
              aria-label={`${formatBloodType(item.bloodType)}: ${item.confirmed} confirmed units, ${item.available} available; ${sample ? `sample ${sample.status}, ${surplus} sample surplus` : "stock status and surplus unavailable"}`}>
              <div className="inventory-overview-track" aria-hidden="true">
                <strong style={{ bottom: `calc(${barHeight}% + 9px)` }}>{item.confirmed}</strong>
                <span className="inventory-overview-fill" style={{ height: `${barHeight}%` }}>
                  {surplus > 0 && <i style={{ height: `${surplus / item.confirmed * 100}%` }} />}
                </span>
              </div>
              <span className="inventory-overview-label">{formatBloodType(item.bloodType)}</span>
              {sample && <small>{surplus > 0 ? `${surplus} surplus · sample` : `${sample.status} · sample`}</small>}
            </div>;
          })}
        </div>
      </div>
    </div>
    {sampleIndicators && <p className="inventory-overview-note">Sample status and surplus values are for visual review only.</p>}
  </section>;
}
