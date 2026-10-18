import { useEffect, useRef, useState, type ReactNode } from "react";

// Shared header sort and column visibility for record tables. Default order is the
// order the caller supplies; only column ids and sort direction are persisted.
export type SortValue = string | number | null | undefined;
export type SortDirection = "asc" | "desc";
export interface TableColumn<T> { id: string; label: string; sortValue?: (row: T) => SortValue; hideable?: boolean }
interface StoredView { sortId?: string; direction?: SortDirection; hidden: string[] }

const STORAGE_PREFIX = "bloodledger.table-view.v1.";

export function readStoredView(tableId: string, columnIds: string[]): StoredView {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + tableId);
    if (!raw) return { hidden: [] };
    const parsed = JSON.parse(raw) as Partial<StoredView>;
    const known = new Set(columnIds);
    const hidden = Array.isArray(parsed.hidden) ? parsed.hidden.filter((id): id is string => typeof id === "string" && known.has(id)) : [];
    const valid = typeof parsed.sortId === "string" && known.has(parsed.sortId) && (parsed.direction === "asc" || parsed.direction === "desc");
    return { hidden: hidden.length >= columnIds.length ? [] : hidden, ...(valid ? { sortId: parsed.sortId, direction: parsed.direction } : {}) };
  } catch { return { hidden: [] }; }
}

function writeStoredView(tableId: string, view: StoredView) {
  try { globalThis.localStorage?.setItem(STORAGE_PREFIX + tableId, JSON.stringify(view)); } catch { /* storage blocked: keep in-memory view */ }
}

function compareValues(a: SortValue, b: SortValue): number {
  const aMissing = isMissing(a), bMissing = isMissing(b);
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}

// Stable; missing values stay last in both directions.
export function sortRows<T>(rows: T[], sortValue: (row: T) => SortValue, direction: SortDirection): T[] {
  return rows.map((row, index) => ({ row, index, value: sortValue(row) })).sort((a, b) => {
    const base = compareValues(a.value, b.value);
    const ordered = isMissing(a.value) || isMissing(b.value) || direction === "asc" ? base : -base;
    return ordered || a.index - b.index;
  }).map(entry => entry.row);
}

function isMissing(value: SortValue) { return value === null || value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value)); }

export function timeValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export interface TableView<T> {
  tableId: string;
  columns: TableColumn<T>[];
  rows: T[];
  sortId?: string;
  direction?: SortDirection;
  sortKey: string;
  sortDescription: string;
  visibleCount: number;
  isVisible: (id: string) => boolean;
  toggleSort: (id: string) => void;
  setHidden: (id: string, hidden: boolean) => void;
  reset: () => void;
}

export function useTableView<T>(tableId: string, columns: TableColumn<T>[], rows: T[]): TableView<T> {
  const columnIds = columns.map(column => column.id);
  const [view, setView] = useState<StoredView>(() => readStoredView(tableId, columnIds));
  const update = (next: StoredView) => { setView(next); writeStoredView(tableId, next); };
  const sortColumn = view.sortId && view.direction ? columns.find(column => column.id === view.sortId && column.sortValue) : undefined;
  const sorted = sortColumn?.sortValue && view.direction ? sortRows(rows, sortColumn.sortValue, view.direction) : rows;
  const hideableIds = columns.filter(column => column.hideable !== false).map(column => column.id);
  const storedHidden = view.hidden.filter(id => hideableIds.includes(id));
  // At least one data column always stays visible.
  const hidden = new Set(storedHidden.length >= hideableIds.length ? [] : storedHidden);
  const direction = sortColumn ? view.direction : undefined;
  return {
    tableId, columns, rows: sorted, sortId: sortColumn?.id, direction,
    sortKey: sortColumn ? `${sortColumn.id}:${direction}` : "default",
    sortDescription: sortColumn ? `${sortColumn.label} ${direction === "asc" ? "ascending" : "descending"}` : "Default order",
    visibleCount: columns.length - hidden.size,
    isVisible: id => !hidden.has(id),
    toggleSort: id => {
      if (!columns.some(column => column.id === id && column.sortValue)) return;
      if (sortColumn?.id !== id) update({ ...view, sortId: id, direction: "asc" });
      else if (direction === "asc") update({ ...view, sortId: id, direction: "desc" });
      else update({ hidden: view.hidden });
    },
    setHidden: (id, hide) => {
      const next = hide ? [...new Set([...view.hidden, id])] : view.hidden.filter(entry => entry !== id);
      if (next.filter(entry => hideableIds.includes(entry)).length >= hideableIds.length) return;
      update({ ...view, hidden: next });
    },
    reset: () => update({ hidden: [] }),
  };
}

// Same header text; the indicator is CSS-only so header text content is unchanged.
export function SortableHeader<T>({ view, id, children, className }: { view: TableView<T>; id: string; children: ReactNode; className?: string }) {
  if (!view.isVisible(id)) return null;
  const column = view.columns.find(entry => entry.id === id);
  const active = view.sortId === id;
  const ariaSort = active ? (view.direction === "asc" ? "ascending" : "descending") : undefined;
  if (!column?.sortValue) return <th className={className}>{children}</th>;
  const next = !active ? "ascending" : view.direction === "asc" ? "descending" : "default order";
  return <th className={className} aria-sort={ariaSort}><button type="button" className="table-sort-button" title={`Sort by ${column.label}: ${next}`} onClick={() => view.toggleSort(id)}>{children}</button></th>;
}

// The menu mounts only while open so its checkbox labels never shadow page fields.
export function ColumnPicker<T>({ view }: { view: TableView<T> }) {
  const hideable = view.columns.filter(column => column.hideable !== false);
  const customized = view.sortId !== undefined || view.visibleCount < view.columns.length;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) {
        setOpen(false);
        if (event instanceof KeyboardEvent) root.current?.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return <details ref={root} className="table-column-picker" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="button compact" aria-label={`Choose visible columns${customized ? " (customized)" : ""}`}>Columns{customized && <span className="table-column-picker-dot" aria-hidden="true"/>}</summary>
    {open && <div className="table-column-picker-menu" role="group" aria-label="Visible columns">
      {hideable.map(column => {
        const visible = view.isVisible(column.id);
        return <label key={column.id}><input type="checkbox" checked={visible} disabled={visible && hideable.filter(entry => view.isVisible(entry.id)).length <= 1} onChange={event => view.setHidden(column.id, !event.target.checked)}/>{column.label}</label>;
      })}
      <button type="button" className="table-column-picker-reset" onClick={view.reset} disabled={!customized}>Reset view</button>
    </div>}
  </details>;
}

// Omitted when fewer than two columns can be hidden; header sort still applies.
export function TableViewBar<T>({ view }: { view: TableView<T> }) {
  if (view.columns.filter(column => column.hideable !== false).length < 2) return null;
  return <div className="table-view-bar"><ColumnPicker view={view}/></div>;
}

// Columns for tables that already have PDF export headers/rows: each column sorts
// by its exported text unless an override (for example a timestamp) is supplied.
// Placeholder text such as "Not available" sorts with missing values, last.
const EXPORT_PLACEHOLDERS = new Set(["—", "-", "Not available", "Not recorded", "Not committed", "Unavailable"]);
export function columnsFromExport<T>(headers: readonly string[], exportRow: (row: T) => readonly (string | number | null | undefined)[], overrides: Record<string, Partial<TableColumn<T>>> = {}): TableColumn<T>[] {
  return headers.map((label, index) => ({ id: label, label, sortValue: (row: T) => { const value = exportRow(row)[index]; return typeof value === "string" && EXPORT_PLACEHOLDERS.has(value) ? null : value; }, ...overrides[label] }));
}
