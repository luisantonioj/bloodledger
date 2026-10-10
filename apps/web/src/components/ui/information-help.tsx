import { useId, useState } from "react";

export function InformationHelp({ label, children, id }: { label: string; children: React.ReactNode; id?: string }) {
  const generatedId = useId();
  const tooltipId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  return <span className="request-form-help" onMouseEnter={() => setOpen(true)} onMouseLeave={event => {if (!event.currentTarget.contains(document.activeElement)) setOpen(false);}} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);}} onKeyDown={event => {if (event.key === "Escape") {setOpen(false); event.stopPropagation();}}}>
    <button type="button" className="request-form-help-button" aria-label={label + " information"} aria-describedby={tooltipId} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}>i</button>
    <span id={tooltipId} role="tooltip" className="request-form-help-tooltip" hidden={!open}>{children}</span>
  </span>;
}
