import { useEffect, useState } from "react";
import type { Principal } from "../auth/permissions";
import { OperatorVerification } from "../auth/operator-verification";
import { ApplicationShell } from "../components/layout/application-shell";
import { visibleNavigation } from "../config/navigation";
import { AccessPage } from "../features/auth/access-page";
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
    const ended = () => { setPrincipal(undefined); setPath("/"); };
    addEventListener("bloodledger:session-ended", ended);
    return () => removeEventListener("bloodledger:session-ended", ended);
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
    setLoading(true);
    setPrincipal(undefined);
    navigate("/");
    await requestJson("/api/v1/auth/session", { method: "DELETE" }).catch(() => undefined);
    setLoading(false);
  }

  if (loading) return <main className="login-panel"><h1>Restoring session...</h1></main>;
  if (!principal) return <AccessPage onAuthenticated={setPrincipal}/>;

  const navigation = visibleNavigation(principal);
  return <OperatorVerification key={principal.accountId ?? principal.userId} principal={principal}><ApplicationShell principal={principal} path={path} navigation={navigation} onNavigate={navigate} onSignOut={() => void signOut()}>{navigation.some(item => item.href === path) ? <PageContent key={principal.userId + path} path={path} principal={principal}/> : <div className="empty" role="alert">This account cannot access this page.</div>}</ApplicationShell></OperatorVerification>;
}
