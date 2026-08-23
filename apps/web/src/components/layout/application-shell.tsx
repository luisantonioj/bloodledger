import type { ReactNode } from "react";
import type { Principal } from "../../auth/permissions";
import type { NavigationItem } from "../../config/navigation";

export function ApplicationShell({ principal, path, navigation, onNavigate, onSignOut, children }: {
  principal: Principal;
  path: string;
  navigation: NavigationItem[];
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const currentLabel = navigation.find((item) => item.href === path)?.label ?? "Unavailable";
  return <div className="shell"><aside className="side"><div className="brand"><span className="mark">BL</span>BloodLedger</div><div className="context"><strong>{principal.institutionDisplayName}</strong><span>{principal.roleDisplayName}</span></div><nav className="nav">{navigation.map((item) => <a key={item.href} href={item.href} aria-current={path === item.href ? "page" : undefined} onClick={event => { event.preventDefault(); onNavigate(item.href); }}>{item.label}</a>)}</nav><div className="footer">{principal.displayName}<br/><button className="button" onClick={onSignOut}>Sign out</button></div></aside><main className="main"><header className="top"><span>BloodLedger / {currentLabel}</span><span className="simulation">SIMULATION ONLY</span></header>{children}</main></div>;
}
