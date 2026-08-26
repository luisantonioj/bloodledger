import { useEffect, useState } from "react";
import type { Principal } from "../auth/permissions";
import { ApplicationShell } from "../components/layout/application-shell";
import { visibleNavigation } from "../config/navigation";
import { LoginPage } from "../features/auth/login-page";
import { requestJson } from "../services/api/client";
import { PageContent } from "./page-content";

export function App() {
  const [principal, setPrincipal] = useState<Principal>();
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState(location.pathname);

  useEffect(() => {
    requestJson<{ principal: Principal }>("/api/v1/auth/session")
      .then((value) => setPrincipal(value.principal))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onPopState = () => setPath(location.pathname);
    addEventListener("popstate", onPopState);
    return () => removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPath: string) {
    history.pushState(null, "", nextPath);
    setPath(nextPath);
  }

  async function signOut() {
    await requestJson("/api/v1/auth/session", { method: "DELETE" }).catch(() => undefined);
    setPrincipal(undefined);
    navigate("/");
  }

  if (loading) return <main className="login-panel"><h1>Restoring session...</h1></main>;
  if (!principal) return <LoginPage onAuthenticated={setPrincipal}/>;

  return <ApplicationShell principal={principal} path={path} navigation={visibleNavigation(principal)} onNavigate={navigate} onSignOut={() => void signOut()}><PageContent path={path} principal={principal}/></ApplicationShell>;
}
