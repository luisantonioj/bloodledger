// Loaded only by the explicit visual-review Vite plugin; never by the production app.
import { useEffect, useState } from "react";
import type { Principal } from "../../../apps/web/src/auth/permissions";
import { ApplicationShell } from "../../../apps/web/src/components/layout/application-shell";
import { visibleNavigation,canonicalPagePath } from "../../../apps/web/src/config/navigation";
import { requestJson } from "../../../apps/web/src/services/api/client";
import { PageContent } from "../../../apps/web/src/app/page-content";

export function App() {
  const [principal, setPrincipal] = useState<Principal>();
  const [error, setError] = useState("");
  const path = location.pathname;
  useEffect(() => {
    requestJson<{ principal: Principal }>("/api/v1/auth/session?reviewPage=" + encodeURIComponent(path))
      .then(value => setPrincipal(value.principal))
      .catch(() => setError("Synthetic review session unavailable. Reload this review page."));
  }, [path]);
  if (!principal) return <main className="login-panel"><h1>{error || "Loading synthetic review page…"}</h1></main>;
  const links = visibleNavigation(principal);
  const activePath = canonicalPagePath(principal,path);
  return <ApplicationShell principal={principal} path={activePath} navigation={links}
    onNavigate={next => location.assign(next)} onSignOut={() => location.assign("/")}>
    <PageContent path={activePath} principal={principal}/>
  </ApplicationShell>;
}
