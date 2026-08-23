import { AggregateTable, AlertAggregateTable, TransferSummaryTable } from "../../components/ui/aggregate-tables";
import { formatManilaDateTime } from "../../components/ui/display";
import type { Report } from "../../services/api/types";

export function ReportView({data}:{data:Report}) {
  return <><div className="report-toolbar"><p><strong>SIMULATION ONLY.</strong> {data.disclaimer}<br/>Generated {formatManilaDateTime(data.generatedAt)}.</p><a className="button" href="/api/v1/reports/inventory.csv" download>Download simulation CSV</a></div><h3>Inventory aggregate</h3><AggregateTable items={data.inventory}/><h3>Alert aggregate</h3><AlertAggregateTable items={data.alerts}/><h3>Transfer aggregate</h3><TransferSummaryTable items={data.transferSummary}/></>;
}
