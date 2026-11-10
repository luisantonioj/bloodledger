export interface TableReport {title:string;scope:string;filters:string;headers:string[];rows:(string|number|null|undefined)[][];filename:string}

type Rgb = [number, number, number];
const INK: Rgb = [14, 18, 24], MUTED: Rgb = [105, 113, 129], PRIMARY: Rgb = [154, 27, 27], LINE: Rgb = [220, 214, 200], PANEL: Rgb = [250, 248, 243], HEAD: Rgb = [15, 22, 32];
const MARGIN = 36;
const DISCLAIMER = "SIMULATION_ONLY · Snapshot of loaded records. This PDF does not approve a request or confirm a pending command, and is not a clinical or regulatory record.";
const LOGO_PATH = "/bloodledger-logo-updated.png";

// The source logo is 1000 px; a 192 px PNG keeps each PDF small while staying sharp at print size.
let logoRequest: Promise<string | null> | undefined;
function loadLogo(): Promise<string | null> {
  logoRequest ??= new Promise<string | null>(resolve => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 192;
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, 192, 192);
        resolve(canvas.toDataURL("image/png"));
      } catch { resolve(null); }
    };
    image.onerror = () => resolve(null);
    image.src = LOGO_PATH;
  }).then(value => { if (!value) logoRequest = undefined; return value; });
  return logoRequest;
}

const manilaTime = (date: Date) => new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date) + " (Asia/Manila)";

// "Loaded rows only; Blood type: ALL; Sort: Unit ID descending" -> readable label/value pairs.
export function parseReportFilters(filters: string) {
  const parts = filters.split(";").map(part => part.trim()).filter(Boolean);
  const pairs = parts.map(part => { const index = part.indexOf(":"); return index > 0 ? { label: part.slice(0, index).trim(), value: part.slice(index + 1).trim() } : { label: "", value: part }; });
  const sort = pairs.find(pair => pair.label.toLowerCase() === "sort")?.value ?? "Default order";
  const notes = pairs.filter(pair => !pair.label).map(pair => pair.value);
  const applied = pairs.filter(pair => pair.label && pair.label.toLowerCase() !== "sort").map(pair => `${pair.label}: ${/^(ALL|None)$/i.test(pair.value) ? "All" : pair.value.replaceAll("_", " ")}`);
  return { sort, notes, applied };
}

// "Synthetic Mediatrix · SIMULATION_ONLY · Off-chain" -> facility plus the remaining qualifiers.
export function parseReportScope(scope: string) {
  const parts = scope.split("·").map(part => part.trim()).filter(Boolean);
  return { facility: parts[0] ?? scope, qualifiers: parts.slice(1).filter(part => part !== "SIMULATION_ONLY") };
}

// Column widths from content: each column gets roughly its typical text width (capped), then all
// columns scale to fit the page. Long IDs wrap inside their own column instead of crushing others.
function columnWidths(doc: { getTextWidth: (text: string) => number }, headers: string[], body: string[][], available: number, padding: number) {
  const sample = body.slice(0, 300);
  const longestWord = (value: string) => Math.max(0, ...value.split(/\s+/).map(word => doc.getTextWidth(word)));
  const columns = headers.map((header, index) => {
    const cells = sample.map(row => row[index] ?? "");
    const widths = cells.map(cell => doc.getTextWidth(cell)).sort((a, b) => a - b);
    const typical = widths.length ? widths[Math.floor((widths.length - 1) * 0.9)] : 0;
    // Ordinary words (statuses, names) never split; very long IDs (over 90 pt) may wrap.
    // Headers stay on one line where they fit (bold header text is ~10% wider than body text).
    const minimum = Math.min(Math.max(doc.getTextWidth(header) * 1.1, ...cells.map(longestWord)), 90) + padding;
    return { minimum, desired: Math.max(minimum, Math.min(typical + padding, 190)) };
  });
  const minimumTotal = columns.reduce((sum, column) => sum + column.minimum, 0), desiredTotal = columns.reduce((sum, column) => sum + column.desired, 0);
  const widths = desiredTotal <= available
    ? columns.map(column => column.desired * available / desiredTotal)
    : columns.map(column => column.minimum + (column.desired - column.minimum) * Math.max(0, available - minimumTotal) / Math.max(1, desiredTotal - minimumTotal));
  return Object.fromEntries(widths.map((width, index) => [index, { cellWidth: width }]));
}

// Export only the supplied authorized snapshot. No rereads or mutation requests.
export async function exportTablePdf(report: TableReport) {
  if (!report.rows.length) throw new Error("No records in this view to export.");
  const [{ jsPDF }, { autoTable }, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), loadLogo()]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), inner = width - MARGIN * 2;
  const { facility, qualifiers } = parseReportScope(report.scope), { sort, notes, applied } = parseReportFilters(report.filters);
  doc.setProperties({ title: report.title, author: "BloodLedger", subject: "Recorded snapshot · " + facility, creator: "BloodLedger" });
  const text = (rgb: Rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const fill = (rgb: Rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const draw = (rgb: Rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  // The logo, or the original lettered mark if the image cannot be loaded.
  const mark = (x: number, y: number, size: number) => {
    if (logo) { doc.addImage(logo, "PNG", x, y, size, size, "bloodledger-logo", "FAST"); return; }
    fill(PRIMARY); doc.roundedRect(x, y, size, size, 5, 5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(size * 0.55); text([255, 255, 255]); doc.text("B", x + size / 2, y + size * 0.7, { align: "center" });
  };

  // Page 1 header: logo, wordmark, simulation badge and a thin brand rule.
  mark(MARGIN, 26, 34);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); text(INK); doc.text("BloodLedger", MARGIN + 44, 41);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); text(MUTED); doc.text("Blood inventory coordination", MARGIN + 44, 53);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  const badge = "SIMULATION ONLY", badgeWidth = doc.getTextWidth(badge) + 16;
  draw(PRIMARY); doc.setLineWidth(0.8); doc.roundedRect(width - MARGIN - badgeWidth, 30, badgeWidth, 15, 7.5, 7.5, "S");
  text(PRIMARY); doc.text(badge, width - MARGIN - badgeWidth / 2, 40, { align: "center" });
  draw(PRIMARY); doc.setLineWidth(1.4); doc.line(MARGIN, 70, width - MARGIN, 70);

  // Title and facility.
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); text(INK); doc.text(report.title, MARGIN, 100);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); text(MUTED); doc.text([facility, ...qualifiers].join("  ·  "), MARGIN, 116);

  // Summary panel: generated time, record count, sort order and each applied filter.
  const cells: [string, string][] = [["Generated", manilaTime(new Date())], ["Records", report.rows.length.toLocaleString("en-PH") + (notes.length ? "  (" + notes.join("; ").toLowerCase() + ")" : "")], ["Sort", sort]];
  const cellWidth = inner / cells.length;
  doc.setFontSize(9);
  const filterLines: string[] = doc.splitTextToSize(applied.length ? applied.join("     ") : "None", inner - 84);
  const panelTop = 130, panelHeight = 58 + (filterLines.length - 1) * 11;
  fill(PANEL); draw(LINE); doc.setLineWidth(0.6); doc.roundedRect(MARGIN, panelTop, inner, panelHeight, 6, 6, "FD");
  cells.forEach(([label, value], index) => {
    const x = MARGIN + 12 + index * cellWidth;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); text(MUTED); doc.text(label.toUpperCase(), x, panelTop + 17);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); text(INK); doc.text(doc.splitTextToSize(value, cellWidth - 20)[0], x, panelTop + 30);
  });
  draw(LINE); doc.setLineWidth(0.5); doc.line(MARGIN + 12, panelTop + 39, width - MARGIN - 12, panelTop + 39);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); text(MUTED); doc.text("FILTERS", MARGIN + 12, panelTop + 52);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); text(INK); doc.text(filterLines, MARGIN + 60, panelTop + 52);

  const body = report.rows.map(row => row.map(value => value == null || value === "" ? "Not available" : String(value)));
  const fontSize = report.headers.length >= 8 ? 7.5 : 8.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
  const columnStyles = columnWidths(doc, report.headers, body, inner, 15);
  autoTable(doc, {
    startY: panelTop + panelHeight + 16,
    head: [report.headers],
    body,
    columnStyles,
    theme: "plain",
    rowPageBreak: "avoid",
    showHead: "everyPage",
    margin: { top: 64, left: MARGIN, right: MARGIN, bottom: 46 },
    styles: { font: "helvetica", fontSize, cellPadding: { top: 5.5, bottom: 5.5, left: 7, right: 7 }, overflow: "linebreak", textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.5 } },
    headStyles: { fillColor: HEAD, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, lineWidth: 0 },
    alternateRowStyles: { fillColor: PANEL },
    didDrawPage: data => {
      // Compact running header on continuation pages.
      if (data.pageNumber > 1) {
        mark(MARGIN, 22, 22);
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); text(INK); doc.text(report.title, MARGIN + 30, 37);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); text(MUTED); doc.text(facility, width - MARGIN, 37, { align: "right" });
        draw(LINE); doc.setLineWidth(0.6); doc.line(MARGIN, 50, width - MARGIN, 50);
      }
      // Footer on every page.
      draw(LINE); doc.setLineWidth(0.6); doc.line(MARGIN, height - 34, width - MARGIN, height - 34);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); text(MUTED);
      doc.text(DISCLAIMER, MARGIN, height - 22, { maxWidth: inner - 90 });
    },
  });
  // Page numbers are drawn once the total is known so "Page X of Y" stays right-aligned.
  const total = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
    doc.setPage(pageNumber);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); text(MUTED);
    doc.text(`Page ${pageNumber} of ${total}`, width - MARGIN, height - 22, { align: "right" });
  }
  doc.save(report.filename + ".pdf");
}
