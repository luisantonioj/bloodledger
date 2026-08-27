import { useEffect, type ReactNode } from "react";

export function PreviewModal({ title, description, onClose, children, footer }: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, [onClose]);

  return <div className="preview-modal-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
      <header><div><p className="eyebrow">Frontend-only preview</p><h2 id="preview-modal-title">{title}</h2><p>{description}</p></div><button type="button" aria-label="Close dialog" onClick={onClose}>×</button></header>
      <div className="preview-modal-body">{children}</div>
      <footer>{footer ?? <button type="button" className="button" onClick={onClose}>Close preview</button>}</footer>
    </section>
  </div>;
}
