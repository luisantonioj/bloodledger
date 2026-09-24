import { useCallback, useEffect, useState } from "react";
import { BloodTypeBadge } from "../../components/ui/aggregate-tables";
import { formatManilaDateTime, humanizeCode, statusClassName } from "../../components/ui/display";
import type { Principal } from "../../auth/permissions";
import { CensusDiscovery } from "../reporting/census-discovery";
import {
  readInboundIntake,
  readV2Components,
  type InboundIntakeResponse,
  type V2ComponentsResponse,
  type V2ContractVersion,
} from "../../services/api/v2";

export function V2InventoryView({ principal }: { principal: Principal }) {
  const [version, setVersion] = useState<V2ContractVersion>("V2");
  const [data, setData] = useState<V2ComponentsResponse>();
  const [intake, setIntake] = useState<InboundIntakeResponse>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<string>();
  const canReadIntake = ["ROLE-01", "ROLE-02"].includes(principal.roleId);

  const refresh = useCallback(async () => {
    if (!navigator.onLine) {
      setError("Offline. The last confirmed component projection is preserved below.");
      return;
    }
    setBusy(true);
    try {
      const [components, intakeStatus] = await Promise.all([
        readV2Components(version),
        canReadIntake ? readInboundIntake() : Promise.resolve(undefined),
      ]);
      setData(components);
      setIntake(intakeStatus);
      setRefreshedAt(new Date().toISOString());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "V2 component inventory is unavailable.");
    } finally {
      setBusy(false);
    }
  }, [canReadIntake, version]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return <div className="v2-inventory">
    <div className="v2-scope-bar">
      <div><span className="eyebrow">INTERVIEW_DERIVED_CORE_V2</span><strong>{principal.institutionDisplayName}</strong><small>Institution scope comes from the authenticated session.</small></div>
      <label>Contract view<select value={version} onChange={(event) => setVersion(event.target.value as V2ContractVersion)}><option value="V2">V2 core components</option><option value="V2.1">V2.1 including cryoprecipitate</option></select></label>
      <button className="button compact" onClick={() => void refresh()} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</button>
    </div>

    {error && <div className="v2-inline-state warning" role="status"><strong>Projection update unavailable</strong><span>{error}</span></div>}
    {!data && busy && <div className="empty"><strong>Loading V2 component inventory</strong>Waiting for the institution-scoped projection.</div>}
    {!data && !busy && <div className="empty" role="alert"><strong>V2 component inventory unavailable</strong>{error}</div>}

    {intake && <section className="v2-intake-status">
      <header><div><h3>Inbound intake status</h3><p>Queued, failed, and conflicted intake remains separate from committed inventory.</p></div><span>Scope: {humanizeCode(intake.scope)}</span></header>
      <div>{Object.entries(intake.statuses).length === 0
        ? <article><strong>0</strong><span>No intake commands recorded</span></article>
        : Object.entries(intake.statuses).map(([status, count]) => <article key={status}><strong>{count}</strong><span className={statusClassName(status)}>{humanizeCode(status)}</span></article>)}</div>
      <footer>Included inventory states: {intake.includedInventoryStatuses.map(humanizeCode).join(", ")}. Excluded intake: {intake.excludedFromInventory.map(humanizeCode).join(", ")}.</footer>
    </section>}

    {data && data.components.length === 0 && <div className="empty inventory-empty"><span className="empty-mark" aria-hidden="true">BL</span><strong>No committed V2 components</strong>No component projection is available for this institution and contract view. This is not displayed as zero city-wide stock.</div>}

    {data && data.components.length > 0 && <>
      <div className="transfer-table-head"><div><strong>Committed component registry</strong><span>Opaque IDs only; Donation No. and OCR material are never returned.</span></div><span>{data.components.length} components</span></div>
      <div className="table-wrap"><table className="data-table inventory-table"><thead><tr><th>Component</th><th>Blood type</th><th>Type</th><th>Status</th><th>Issuer</th><th>Reservation</th><th>Expiry</th><th>Version</th></tr></thead><tbody>{data.components.map((component) => <tr key={component.componentId}>
        <td><span className="unit-reference mono">{component.componentId}</span><small className="v2-secondary-id">{component.donationId}</small></td>
        <td><BloodTypeBadge value={component.bloodType}/></td>
        <td>{humanizeCode(component.componentType)}</td>
        <td><span className={statusClassName(component.inventoryStatus)}>{humanizeCode(component.inventoryStatus)}</span></td>
        <td className="mono">{component.issuerInstitutionId}</td>
        <td>{component.reservationId ? <><span className="mono">{component.reservationId}</span><small className="v2-secondary-id">Version {component.reservationVersion ?? "pending"}</small></> : "Not reserved"}</td>
        <td className="data-time">{formatManilaDateTime(component.expiresAt)}</td>
        <td>{component.inventoryVersion}</td>
      </tr>)}</tbody></table></div>
      <p className="v2-freshness">Last successful browser refresh: {refreshedAt ? formatManilaDateTime(refreshedAt) : "Unavailable"} · {version} · SIMULATION_ONLY</p>
    </>}
    {canReadIntake && <CensusDiscovery/>}
  </div>;
}
