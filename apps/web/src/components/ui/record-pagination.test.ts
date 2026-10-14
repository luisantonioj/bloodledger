// BL-WEB-05/06: bounded record presentation with preserved headers and empty states.
import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaginatedTable, RecordPagination } from "./record-pagination";

describe("shared record pagination", () => {
  it("limits a table to twenty rows without removing its header", () => {
    const children = h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Reference"))), h("tbody", {}, Array.from({ length: 51 }, (_, index) => h("tr", { key: index }, h("td", {}, `RECORD_${index}`)))));
    const html = renderToStaticMarkup(h(PaginatedTable, { total: 51, children }));
    expect(html.match(/RECORD_\d+/g)).toHaveLength(20);
    expect(html).toContain("Reference"); expect(html).toContain("1–20 of 51 records"); expect(html).toContain("Page 1 of 3");
  });
  it("keeps an empty-state row without counting it as a record", () => {
    const children = h("table", {}, h("tbody", {}, h("tr", {}, h("td", { colSpan: 4 }, "No records yet"))));
    const html = renderToStaticMarkup(h(PaginatedTable, { total: 0, children }));
    expect(html).toContain("No records yet"); expect(html).toContain("0 records"); expect(html).toContain("Page 1 of 1");
  });
  it("shows the partial final page and disables forward buttons", () => {
    const html = renderToStaticMarkup(h(RecordPagination, { total: 51, page: 2, onPage: () => {} }));
    expect(html).toContain("41–51 of 51 records"); expect(html).toContain("Page 3 of 3");
    expect(html).toMatch(/aria-label="Next page"[^>]*disabled/); expect(html).toMatch(/aria-label="Last page"[^>]*disabled/);
  });
  it("does not label unavailable records as zero", () => {
    const html = renderToStaticMarkup(h(RecordPagination, { total: 0, ready: false }));
    expect(html).toContain("Records unavailable"); expect(html).not.toContain("0 records");
  });
});
