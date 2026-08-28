import { useState, type ReactNode } from "react";
import { DesignPreviewPanel } from "./design-preview-panel";
import type { Principal } from "../../auth/permissions";
import type { NavigationItem } from "../../config/navigation";

const iconPaths: Record<string, string> = {
  "/": "M4 4h6v7H4V4Zm10 0h6v4h-6V4ZM4 15h6v5H4v-5Zm10-3h6v8h-6v-8Z",
  "/inventory": "m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4",
  "/transfers": "M7 7h13l-3-3m0 13H4l3 3",
  "/alerts": "m12 3 9 16H3l9-16Zm0 6v4m0 3v.5",
  "/consortium": "M9 15l6-6m-3-3 1-1a4 4 0 1 1 5.6 5.6L17 12M7 12l-1.6 1.6A4 4 0 0 0 11 19.2L12 18",
  "/audit": "M5 4h11l3 3v13H5V4Zm3 4h5m-5 4h8m-8 4h6",
  "/reporting": "M4 20V10m6 10V4m6 16v-7m5 7V8",
  "/accounts": "M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0M18 6h4m-2-2v4",
  "/profile": "M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
};

const sectionFor = (href: string) => href === "/" ? "Overview"
  : ["/inventory"].includes(href) ? "Inventory"
    : ["/transfers", "/alerts", "/audit"].includes(href) ? "Requests & activity"
      : ["/consortium", "/reporting"].includes(href) ? "Oversight"
        : ["/accounts"].includes(href) ? "Administration" : "Account";

function NavigationIcon({ href }: { href: string }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={iconPaths[href]} /></svg>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "BL";
}

export function ApplicationShell({ principal, path, navigation, onNavigate, onSignOut, children }: {
  principal: Principal;
  path: string;
  navigation: NavigationItem[];
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const currentLabel = navigation.find((item) => item.href === path)?.label ?? "Unavailable";
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [density, setDensity] = useState<"compact" | "regular">("regular");
  const [accent, setAccent] = useState<"blood" | "blue" | "green">("blood");
  let previousSection = "";
  return <div className={`shell preview-${theme} preview-${density} preview-accent-${accent}`}>
    <aside className="side">
      <div className="side-brand"><span className="mark">B</span><span><strong>Blood<em>ledger</em></strong><small>Inventory management</small></span></div>
      <div className="facility-context">
        <span>Current institution</span>
        <strong>{principal.institutionDisplayName}</strong>
        <small><i aria-hidden="true"/>Authenticated session</small>
      </div>
      <nav className="nav" aria-label="Primary navigation">
        {navigation.map((item) => {
          const section = sectionFor(item.href);
          const showSection = section !== previousSection;
          previousSection = section;
          return <div className="nav-entry" key={item.href}>
            {showSection && <div className="nav-section-label">{section}</div>}
            <a href={item.href} aria-label={item.label} aria-current={path === item.href ? "page" : undefined} onClick={event => { event.preventDefault(); onNavigate(item.href); }}>
              <NavigationIcon href={item.href}/><span>{item.label}</span>{item.badge && <small className="nav-badge">{item.badge}</small>}
            </a>
          </div>;
        })}
      </nav>
      <div className="session-footer">
        <button className="session-profile" onClick={() => onNavigate("/profile")} aria-label="Open profile">
          <span className="session-avatar">{initials(principal.displayName)}</span>
          <span><strong>{principal.displayName}</strong><small>{principal.roleDisplayName}</small></span>
        </button>
        <button className="sign-out" onClick={onSignOut} title="Sign out" aria-label="Sign out">↪</button>
      </div>
    </aside>
    <main className="main">
      <header className="top">
        <div className="breadcrumbs"><span>BloodLedger</span><i>/</i><strong>{currentLabel}</strong></div>
        <div className="global-search"><span aria-hidden="true">⌕</span><input aria-label="Search records" placeholder="Search records..." value={search} onFocus={() => setSearchOpen(true)} onChange={event => setSearch(event.target.value)}/>{searchOpen && <div className="search-preview-popover"><header><strong>Search preview</strong><button type="button" aria-label="Close search preview" onClick={() => setSearchOpen(false)}>×</button></header>{search ? <><p>No connected results for <b>{search}</b>.</p><div><span>Inventory units</span><small>Search API unavailable</small></div><div><span>Transfers and requests</span><small>Search API unavailable</small></div><div><span>Audit references</span><small>Search API unavailable</small></div></> : <p>Enter a synthetic reference to preview the search layout. No records are queried.</p>}</div>}</div>
        <div className="top-preview-actions">
          {["ROLE-05","ROLE-06"].includes(principal.roleId) && <button type="button" className="pending-preview-button" onClick={() => onNavigate("/accounts")}><span>2</span> pending applications</button>}
          <div className="notification-preview">
            <button type="button" aria-label="Open notifications preview" onClick={() => setNotificationsOpen(value => !value)}>♢<i aria-hidden="true"/></button>
            {notificationsOpen && <div className="notification-preview-popover"><header><strong>Notifications</strong><button type="button" aria-label="Close notifications preview" onClick={() => setNotificationsOpen(false)}>×</button></header><div><span aria-hidden="true">i</span><p><strong>No connected notification feed</strong>Alert and application notices require scoped API contracts.</p></div></div>}
          </div>
        </div>
        <div className="top-status"><span><i aria-hidden="true"/>Authenticated scope</span><b>SIMULATION ONLY</b></div>
      </header>
      {children}
    <DesignPreviewPanel open={previewOpen} theme={theme} density={density} accent={accent} onOpen={() => setPreviewOpen(true)} onClose={() => setPreviewOpen(false)} onTheme={setTheme} onDensity={setDensity} onAccent={setAccent}/>
    </main>
  </div>;
}
