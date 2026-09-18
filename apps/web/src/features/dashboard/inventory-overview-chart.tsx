import { formatBloodType } from "../../components/ui/display";
import type { Aggregate } from "../../services/api/types";
import { summarizeInventoryByBloodType } from "./inventory-overview";

export function InventoryOverviewChart({ items }: { items: Aggregate[] }) {
  const summary = summarizeInventoryByBloodType(items);
  const maximum = Math.max(1, ...summary.map((item) => item.confirmed));

  return (
    <section className="inventory-overview-card" aria-labelledby="inventory-overview-title">
      <header>
        <div>
          <h2 id="inventory-overview-title">Blood inventory overview</h2>
          <p>Ledger-confirmed totals by blood type for this institution scope.</p>
        </div>
        <div className="inventory-overview-legend" aria-label="Inventory chart legend">
          <span><i className="confirmed" aria-hidden="true" />Confirmed total</span>
          <span><i className="available" aria-hidden="true" />Available subset</span>
        </div>
      </header>
      <div className="inventory-overview-scroll">
        <div className="inventory-overview-chart" role="list" aria-label="Ledger-confirmed inventory by blood type">
          {summary.map((item) => {
            const barHeight = item.confirmed === 0 ? 0 : Math.max(4, (item.confirmed / maximum) * 100);
            const availableHeight = item.confirmed === 0 ? 0 : (item.available / item.confirmed) * 100;
            return (
              <div
                className="inventory-overview-bar"
                role="listitem"
                aria-label={`${formatBloodType(item.bloodType)}: ${item.confirmed} confirmed units, ${item.available} available`}
                key={item.bloodType}
              >
                <div className="inventory-overview-track" aria-hidden="true">
                  <strong className="mono" style={{ bottom: `calc(${barHeight}% + 9px)` }}>{item.confirmed}</strong>
                  <span className="inventory-overview-fill" style={{ height: `${barHeight}%` }}>
                    {item.available > 0 && <i style={{ height: `${availableHeight}%` }} />}
                  </span>
                </div>
                <span className="inventory-overview-label mono">{formatBloodType(item.bloodType)}</span>
                <small>{item.available} available</small>
              </div>
            );
          })}
        </div>
      </div>
      <p className="inventory-overview-note">Availability is shown only from committed <span className="mono">AVAILABLE</span> records. No shortage, surplus, or redistributability threshold is inferred in the browser.</p>
    </section>
  );
}
