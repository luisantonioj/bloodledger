import { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";

export const RECORDS_PER_PAGE = 20;

export function useRecordPagination<T>(records: T[], resetKey = "") {
  const key = `${resetKey}|${records.length}`;
  const [selection, setSelection] = useState({ key, page: 0 });
  const pageCount = Math.max(1, Math.ceil(records.length / RECORDS_PER_PAGE));
  const page = selection.key === key ? Math.min(selection.page, pageCount - 1) : 0;
  return { page, pageCount, total: records.length, items: records.slice(page * RECORDS_PER_PAGE, (page + 1) * RECORDS_PER_PAGE), onPage: (next: number) => setSelection({ key, page: Math.max(0, Math.min(next, pageCount - 1)) }) };
}

export function RecordPagination({ total, page = 0, onPage, label = "Records", ready = true }: { total: number; page?: number; onPage?: (page: number) => void; label?: string; ready?: boolean }) {
  const pageCount = Math.max(1, Math.ceil(total / RECORDS_PER_PAGE));
  const current = Math.min(page, pageCount - 1);
  const paths = ["M5 6v12M17 6l-6 6 6 6", "m14 6-6 6 6 6", "m10 6 6 6-6 6", "M19 6v12M7 6l6 6-6 6"];
  const button = (index: number, name: string, next: number, disabled: boolean) => <button className="button compact inventory-page-arrow" type="button" aria-label={name} title={name} disabled={!ready || disabled || !onPage} onClick={() => onPage?.(next)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[index]}/></svg></button>;
  return <div className="record-pagination-shell"><nav className="inventory-pagination record-pagination" aria-label={label + " pagination"}>
    <div className="inventory-page-controls">
      {button(0, "First page", 0, current === 0)}{button(1, "Previous page", current - 1, current === 0)}
      <span className="inventory-page-count" aria-live="polite">Page {current + 1} of {pageCount}</span>
      {button(2, "Next page", current + 1, current === pageCount - 1)}{button(3, "Last page", pageCount - 1, current === pageCount - 1)}
    </div>
    <span className="inventory-page-records" aria-live="polite">{!ready ? "Records unavailable" : total ? `${current * RECORDS_PER_PAGE + 1}–${Math.min((current + 1) * RECORDS_PER_PAGE, total)} of ${total} records` : "0 records"}</span>
  </nav></div>;
}

type TableChild = ReactElement<{ children?: ReactNode }>;
// Paginate only body rows; headers, empty-state rows and row actions remain intact.
export function PaginatedTable({ children, total, resetKey = "", label = "Records", className = "table-wrap", ready = true }: { children: TableChild; total: number; resetKey?: string; label?: string; className?: string; ready?: boolean }) {
  const pagination = useRecordPagination(Array.from({ length: total }), resetKey);
  const table = cloneElement(children, {}, Children.map(children.props.children, child => {
    if (!isValidElement<{ children?: ReactNode }>(child) || child.type !== "tbody" || total === 0) return child;
    const rows = Children.toArray(child.props.children);
    return cloneElement(child, {}, rows.slice(pagination.page * RECORDS_PER_PAGE, (pagination.page + 1) * RECORDS_PER_PAGE));
  }));
  return <><div className={className}>{table}</div><RecordPagination {...pagination} label={label} ready={ready}/></>;
}
