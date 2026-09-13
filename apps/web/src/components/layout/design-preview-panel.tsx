type PreviewTheme = "light" | "dark";
type PreviewDensity = "compact" | "regular";
type PreviewAccent = "blood" | "blue" | "green";

export function DesignPreviewPanel({ open, theme, density, accent, onOpen, onClose, onTheme, onDensity, onAccent }: {
  open: boolean;
  theme: PreviewTheme;
  density: PreviewDensity;
  accent: PreviewAccent;
  onOpen: () => void;
  onClose: () => void;
  onTheme: (value: PreviewTheme) => void;
  onDensity: (value: PreviewDensity) => void;
  onAccent: (value: PreviewAccent) => void;
}) {
  if (!open) return <button type="button" className="preview-panel-launcher" onClick={onOpen} aria-label="Open design preview controls"><span>◐</span> Design preview</button>;
  return <aside className="preview-panel" aria-label="Design preview controls">
    <header><div><strong>Design preview</strong><small>Local visual state only</small></div><button type="button" aria-label="Close design preview controls" onClick={onClose}>×</button></header>
    <div className="preview-panel-body">
      <section><span>Theme</span><div className="preview-segment"><button type="button" className={theme === "light" ? "active" : ""} onClick={() => onTheme("light")}>Light</button><button type="button" className={theme === "dark" ? "active" : ""} onClick={() => onTheme("dark")}>Dark</button></div></section>
      <section><span>Accent</span><div className="preview-swatches"><button type="button" className={accent === "blood" ? "active blood" : "blood"} aria-label="Blood red accent" onClick={() => onAccent("blood")}/><button type="button" className={accent === "blue" ? "active blue" : "blue"} aria-label="Blue accent" onClick={() => onAccent("blue")}/><button type="button" className={accent === "green" ? "active green" : "green"} aria-label="Green accent" onClick={() => onAccent("green")}/></div></section>
      <section><span>Density</span><div className="preview-segment"><button type="button" className={density === "compact" ? "active" : ""} onClick={() => onDensity("compact")}>Compact</button><button type="button" className={density === "regular" ? "active" : ""} onClick={() => onDensity("regular")}>Regular</button></div></section>
      <p>These controls do not persist preferences or alter application data.</p>
    </div>
  </aside>;
}
