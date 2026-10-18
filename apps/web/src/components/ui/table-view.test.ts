// BL-WEB-05/06 refinement: header sort and column visibility keep default order and table format.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ColumnPicker, readStoredView, SortableHeader, sortRows, timeValue, useTableView, type TableColumn } from "./table-view";
import { PaginatedTable } from "./record-pagination";

interface Row { id: string; count: number | null; time: string | null }
const columns: TableColumn<Row>[] = [
  { id: "id", label: "Reference", sortValue: row => row.id },
  { id: "count", label: "Count", sortValue: row => row.count },
  { id: "time", label: "Time", sortValue: row => timeValue(row.time) },
  { id: "actions", label: "Actions", hideable: false },
];
const rows: Row[] = [
  { id: "UNIT-10", count: 3, time: "2026-10-02T00:00:00Z" },
  { id: "UNIT-2", count: null, time: "2026-10-01T00:00:00Z" },
  { id: "UNIT-1", count: 3, time: null },
  { id: "UNIT-3", count: 1, time: "2026-10-03T00:00:00Z" },
];

function storage(values: Record<string, string> = {}) {
  return { getItem: (key: string) => values[key] ?? null, setItem: (key: string, value: string) => { values[key] = value; } };
}

const RowHeader = SortableHeader<Row>, RowPicker = ColumnPicker<Row>;

function Table({ data }: { data: Row[] }) {
  const view = useTableView("unit-test", columns, data);
  return h("div", {}, h(RowPicker, { view }), h(PaginatedTable, { total: data.length, resetKey: view.sortKey, children:
    h("table", {}, h("thead", {}, h("tr", {}, ...columns.map(column => h(RowHeader, { key: column.id, view, id: column.id, children: column.label })))),
      h("tbody", {}, view.rows.map(row => h("tr", { key: row.id }, view.isVisible("id") && h("td", {}, row.id), view.isVisible("count") && h("td", {}, String(row.count)), view.isVisible("time") && h("td", {}, row.time ?? "-"), h("td", {}, "Open")))),
      ) }), h("output", {}, `${view.visibleCount}|${view.sortDescription}`));
}

afterEach(() => vi.unstubAllGlobals());

describe("table view sorting", () => {
  it("sorts strings naturally, numbers and times, keeping ties stable", () => {
    expect(sortRows(rows, row => row.id, "asc").map(row => row.id)).toEqual(["UNIT-1", "UNIT-2", "UNIT-3", "UNIT-10"]);
    expect(sortRows(rows, row => row.count, "asc").map(row => row.id)).toEqual(["UNIT-3", "UNIT-10", "UNIT-1", "UNIT-2"]);
    expect(sortRows(rows, row => row.count, "desc").map(row => row.id)).toEqual(["UNIT-10", "UNIT-1", "UNIT-3", "UNIT-2"]);
    expect(sortRows(rows, row => timeValue(row.time), "desc").map(row => row.id)).toEqual(["UNIT-3", "UNIT-10", "UNIT-2", "UNIT-1"]);
  });
  it("keeps missing values last in both directions", () => {
    expect(sortRows(rows, row => row.count, "asc").at(-1)?.id).toBe("UNIT-2");
    expect(sortRows(rows, row => row.count, "desc").at(-1)?.id).toBe("UNIT-2");
  });
});

describe("table view rendering", () => {
  it("preserves supplied order and all headers by default", () => {
    vi.stubGlobal("localStorage", storage());
    const html = renderToStaticMarkup(h(Table, { data: rows }));
    expect(html.match(/UNIT-\d+/g)).toEqual(["UNIT-10", "UNIT-2", "UNIT-1", "UNIT-3"]);
    expect(html).toContain("4|Default order");
    expect(html).not.toContain("aria-sort");
    expect(html).toContain(">Reference<svg");
    expect(html).toContain("<th>Actions</th>");
  });
  it("applies a stored sort and hidden column, keeping the action column", () => {
    vi.stubGlobal("localStorage", storage({ "bloodledger.table-view.v1.unit-test": JSON.stringify({ sortId: "id", direction: "desc", hidden: ["time", "actions"] }) }));
    const html = renderToStaticMarkup(h(Table, { data: rows }));
    expect(html.match(/UNIT-\d+/g)).toEqual(["UNIT-10", "UNIT-3", "UNIT-2", "UNIT-1"]);
    expect(html).toContain('aria-sort="descending"');
    expect(html).not.toContain(">Time<svg"); expect(html).not.toContain("<input");
    expect(html).toContain("Actions");
    expect(html).toContain("3|Reference descending");
  });
  it("still paginates twenty rows after sorting", () => {
    vi.stubGlobal("localStorage", storage({ "bloodledger.table-view.v1.unit-test": JSON.stringify({ sortId: "id", direction: "asc", hidden: [] }) }));
    const many = Array.from({ length: 45 }, (_, index) => ({ id: `UNIT-${index}`, count: index, time: null }));
    const html = renderToStaticMarkup(h(Table, { data: many }));
    expect(html.match(/<td>UNIT-\d+<\/td>/g)).toHaveLength(20);
    expect(html).toContain("<td>UNIT-0</td>"); expect(html).toContain("1–20 of 45 records");
  });
  it("never hides every data column, even from stored state", () => {
    vi.stubGlobal("localStorage", storage({ "bloodledger.table-view.v1.unit-test": JSON.stringify({ hidden: ["id", "count", "time"] }) }));
    const html = renderToStaticMarkup(h(Table, { data: rows }));
    expect(html).toContain(">Reference<svg"); expect(html).toContain("4|Default order");
  });
  it("works when storage throws", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(() => renderToStaticMarkup(h(Table, { data: rows }))).not.toThrow();
  });
});

describe("stored view validation", () => {
  const ids = columns.map(column => column.id);
  it("ignores corrupt, unknown, or all-hidden storage", () => {
    vi.stubGlobal("localStorage", storage({ "bloodledger.table-view.v1.a": "{not json", "bloodledger.table-view.v1.b": JSON.stringify({ sortId: "gone", direction: "asc", hidden: ["gone", "count"] }), "bloodledger.table-view.v1.c": JSON.stringify({ hidden: ids }) }));
    expect(readStoredView("a", ids)).toEqual({ hidden: [] });
    expect(readStoredView("b", ids)).toEqual({ hidden: ["count"] });
    expect(readStoredView("c", ids)).toEqual({ hidden: [] });
  });
});
