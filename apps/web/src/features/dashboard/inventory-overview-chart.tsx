import { formatBloodType } from "../../components/ui/display";
import { useState, type CSSProperties } from "react";
import type { Aggregate } from "../../services/api/types";
import { componentLabel } from "../transfers/requester-transfer-data";
import { inventoryOverviewComponents, summarizeInventoryByComponent } from "./inventory-overview";

export function InventoryOverviewChart({ items }: { items: Aggregate[] }) {
  const [component, setComponent] = useState("ALL");
  const components = inventoryOverviewComponents(items);
  const summary = summarizeInventoryByComponent(items, component);
  const productCount = summary[0]?.components.length ?? 1;
  const maximum = Math.ceil(Math.max(5, ...summary.flatMap(item => item.components.map(product => product.confirmed))) / 5) * 5;
  const ticks = Array.from({ length: 6 }, (_, index) => maximum * (5 - index) / 5);
  const chartStyle = {
    "--overview-groups": summary.length,
    "--overview-products": productCount,
    "--overview-width": `${Math.max(720, summary.length * productCount * 72)}px`,
  } as CSSProperties;
  return <section className="inventory-overview-card" aria-labelledby="inventory-overview-title">
    <header>
      <div><h2 id="inventory-overview-title">Blood Inventory Overview</h2></div>
      <a className="inventory-overview-link" href="/inventory">View inventory →</a>
    </header>
    <div className="inventory-overview-controls">
      <label>Blood component<span className="requester-select"><select aria-label="Inventory overview blood component" value={component} onChange={event => setComponent(event.target.value)}>
        <option value="ALL">All</option>
        {components.map(product => <option key={product} value={product}>{componentLabel(product)}</option>)}
      </select></span></label>
      <p>{component === "ALL" ? "Components shown side by side. Scroll to compare blood types." : `${componentLabel(component)} units by blood type.`}</p>
    </div>
    <div className="inventory-overview-scroll" tabIndex={0} role="region" aria-label="Scrollable inventory chart" style={chartStyle}>
      <div className="inventory-overview-legend" aria-label="Inventory status legend">
        <span><i className="unknown" />Stock classification unavailable: no approved stock-level policy (RQ-16)</span>
      </div>
      <div className="inventory-overview-frame">
        <div className="inventory-overview-axis-title">Quantity (units)</div>
        <div className="inventory-overview-axis" aria-hidden="true">{ticks.map((tick, index) => <span key={tick} style={{ "--tick-index": index } as CSSProperties}>{tick}</span>)}</div>
        <div className="inventory-overview-chart" role="list" aria-label="Ledger-confirmed inventory by blood type and component">
          {summary.map(group => <div className="inventory-overview-group" role="listitem" key={group.bloodType} aria-label={formatBloodType(group.bloodType)}>
            <div className="inventory-overview-products" role="list" aria-label={`${formatBloodType(group.bloodType)} components`}>
              {group.components.map(item => {
                const barHeight = item.confirmed / maximum * 100;
                const description = `${formatBloodType(group.bloodType)} ${componentLabel(item.component)}: ${item.confirmed} confirmed units, ${item.available} available; stock classification unavailable (RQ-16)`;
                return <div className="inventory-overview-bar stock-unknown" role="listitem" key={item.component} aria-label={description} title={description}>
                  <div className="inventory-overview-track" aria-hidden="true">
                    <strong style={{ bottom: `calc(${barHeight}% + 9px)` }}>{item.confirmed}</strong>
                    <span className="inventory-overview-fill" style={{ height: `${barHeight}%` }}>
                    </span>
                  </div>
                  <span className="inventory-overview-product-label">{componentLabel(item.component)}</span>
                </div>;
              })}
            </div>
            <span className="inventory-overview-label">{formatBloodType(group.bloodType)}</span>
          </div>)}
        </div>
      </div>
    </div>
    <p className="inventory-overview-note">Ledger-confirmed counts; AVAILABLE is a ledger state, not a usable-stock or surplus assessment. Synthetic source surplus is shown separately on Analytics.</p>
  </section>;
}
