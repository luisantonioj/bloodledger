import { AggregateTable, AlertAggregateTable, TransferSummaryTable } from "../../components/ui/aggregate-tables";
import type { Consortium } from "../../services/api/types";

export function ConsortiumView({data}:{data:Consortium}) {
  const confirmed=data.inventory.reduce((sum,item)=>sum+item.confirmedCount,0);
  const alerts=data.alerts.reduce((sum,item)=>sum+item.count,0);
  const transfers=data.transferSummary.reduce((sum,item)=>sum+item.transferCount,0);
  return <><p className="report-note">Application-level city aggregate. PRC and secondary hospitals are not represented as Fabric peer organizations.</p><div className="stats"><article><span>Ledger-confirmed units</span><strong>{confirmed}</strong></article><article><span>Aggregate alerts</span><strong>{alerts}</strong></article><article><span>Transfers</span><strong>{transfers}</strong></article></div><h3>Inventory by institution</h3><AggregateTable items={data.inventory}/><h3>Alert summary</h3><AlertAggregateTable items={data.alerts}/><h3>Transfer summary</h3><TransferSummaryTable items={data.transferSummary}/></>;
}
