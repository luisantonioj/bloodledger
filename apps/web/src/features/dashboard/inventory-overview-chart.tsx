import { StockThresholdSegment } from "./stock-threshold-segment";
import { classifyStock, stockThresholds, stockClassificationPolicy, stockSegments } from "./stock-classification";
import { useStockEvidence } from "./use-stock-evidence";
import { formatBloodType } from "../../components/ui/display";
import { useState, type CSSProperties } from "react";
import type { Aggregate } from "../../services/api/types";
import { componentLabel } from "../transfers/requester-transfer-data";
import { inventoryOverviewComponents, summarizeInventoryByComponent } from "./inventory-overview";

export function InventoryOverviewChart({ items, institutionId }: { items: Aggregate[]; institutionId?: string }) {
  const [component, setComponent] = useState("ALL");
  const evidence = useStockEvidence(institutionId, items);
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
      <div className="inventory-overview-legend" aria-label="Inventory status legend">
        <span><i className="critical" />Critical</span><span><i className="low" />Low</span><span><i className="adequate" />Adequate</span><span><i className="surplus" />Surplus</span>
        {!evidence.counts && <span><i className="unknown" />Classification unavailable</span>}
      </div>
    </div>
    <div className="inventory-overview-scroll" tabIndex={0} role="region" aria-label="Scrollable inventory chart" style={chartStyle}>
      <div className="inventory-overview-frame">
        <div className="inventory-overview-axis-title">Quantity (units)</div>
        <div className="inventory-overview-axis" aria-hidden="true">{ticks.map((tick, index) => <span key={tick} style={{ "--tick-index": index } as CSSProperties}>{tick}</span>)}</div>
        <div className="inventory-overview-chart" role="list" aria-label="Ledger-confirmed inventory by blood type and component">
          {summary.map(group => <div className="inventory-overview-group" role="listitem" key={group.bloodType} aria-label={formatBloodType(group.bloodType)}>
            <div className="inventory-overview-products" role="list" aria-label={`${formatBloodType(group.bloodType)} components`}>
              {group.components.map(item => {
                const barHeight = item.confirmed / maximum * 100;
                const eligible = evidence.counts ? evidence.counts.get(group.bloodType + ":" + item.component) ?? 0 : null;
                const band = classifyStock(group.bloodType, item.component, eligible);
                const segments = stockSegments(group.bloodType, item.component, item.confirmed, eligible);
                const description = `${formatBloodType(group.bloodType)} ${componentLabel(item.component)}: ${item.confirmed} confirmed units, ${item.available} available; ${eligible === null ? "eligible count unavailable" : `${eligible} eligible units`}; ${band ?? "classification unavailable"}`;
                return <div className={`inventory-overview-bar stock-${band ?? "unknown"}`} role="listitem" key={item.component} aria-label={description}>
                  <div className="inventory-overview-track">
                    <strong aria-hidden="true" style={{ bottom: `calc(${barHeight}% + 9px)` }}>{item.confirmed}</strong>
                    <span className="inventory-overview-fill threshold-segmented-fill" style={{ height: `${barHeight}%` }}>
                      {segments.map(segment => <StockThresholdSegment key={segment.band} segment={segment} total={item.confirmed} product={`${formatBloodType(group.bloodType)} ${componentLabel(item.component)}`}/>)}
                    </span>
                  </div>
                  <span className="inventory-overview-product-label">{componentLabel(item.component)}<small className={`stock-band-label stock-band-${band ?? "unknown"}`}>{band ? band[0].toUpperCase() + band.slice(1) : "Unavailable"}</small></span>
                </div>;
              })}
            </div>
            <span className="inventory-overview-label">{formatBloodType(group.bloodType)}</span>
          </div>)}
        </div>
      </div>
    </div>
    {evidence.error && <p className="inventory-overview-note" role="status">{evidence.error}</p>}
    <details className="stock-policy-details"><summary>Stock-level thresholds</summary><p>{stockClassificationPolicy.version} · effective {stockClassificationPolicy.effectiveDate}. Invented project demonstration values, not institutional clinical levels. Current own-institution AVAILABLE units only; reserved and expired units are excluded. Missing evidence stays unavailable.</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Blood group</th><th>Component</th><th>Critical</th><th>Low</th><th>Adequate</th><th>Surplus</th></tr></thead><tbody>{summary.flatMap(group => group.components.map(product => { const t = stockThresholds(group.bloodType, product.component); return t ? <tr key={group.bloodType+product.component}><td>{formatBloodType(group.bloodType)}</td><td>{componentLabel(product.component)}</td><td>0–{t.criticalMax}</td><td>{t.criticalMax+1}–{t.lowMax}</td><td>{t.lowMax+1}–{t.adequateMax}</td><td>{t.adequateMax+1}+</td></tr> : null; }))}</tbody></table></div></details>
    <p className="inventory-overview-note">Each bar fills the threshold ranges from bottom to top. Heights show confirmed units; gray portions are not eligible for threshold colors. Hover or focus a segment for its range. Official project demonstration bands; Surplus is not forecast surplus or transfer approval.</p>
  </section>;
}
