import { formatManilaDateTime } from "../../components/ui/display";
import { useLiveData } from "../../hooks/use-live-data";

type LocationEvidenceView = { reservationId: string; evidence: Array<{ evidenceId: string; phase: "DISPATCH" | "RECEIPT"; institutionId: string; capturedAt: string; accuracyMetres: number; source: "DEVICE" | "FACILITY_FALLBACK"; fallbackReason: string | null; facilityMatched: boolean; coordinates: { latitude: number; longitude: number } | null }> };

/** TC-G03: read-only checkpoint audit; coordinates appear only for the institution that captured them. */
export function ReservationLocationAudit({ reservationId, version }: { reservationId: string; version: number }) {
  const state = useLiveData<LocationEvidenceView>(`/api/v2/reservations/${encodeURIComponent(reservationId)}/location-evidence?v=${version}`);
  const rows = state.data?.evidence ?? [];
  return <section className="reservation-location-audit" aria-label="Checkpoint location evidence"><h4>Checkpoint locations</h4>
    {state.error && !state.data ? <p className="muted">Location evidence is unavailable.</p>
      : !state.data ? <p role="status">Loading location evidence…</p>
      : !rows.length ? <p>No checkpoint location recorded for this reservation.</p>
      : <table className="data-table"><thead><tr><th>Checkpoint</th><th>Time</th><th>Source</th><th>Facility match</th><th>Accuracy</th><th>Point</th></tr></thead><tbody>{rows.map(row => <tr key={row.evidenceId}>
        <td>{row.phase === "DISPATCH" ? "Dispatch" : "Receipt"}</td><td>{formatManilaDateTime(row.capturedAt)}</td>
        <td>{row.source === "DEVICE" ? "Device" : "Facility fallback" + (row.fallbackReason ? ` (${row.fallbackReason.toLowerCase().replaceAll("_", " ")})` : "")}</td>
        <td>{row.facilityMatched ? "Matched" : "Not matched"}</td><td>±{Math.round(row.accuracyMetres)} m</td>
        <td>{row.coordinates ? `${row.coordinates.latitude.toFixed(5)}, ${row.coordinates.longitude.toFixed(5)}` : "Restricted to capturing facility"}</td></tr>)}</tbody></table>}
  </section>;
}
