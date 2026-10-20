import { useEffect, useState } from "react";

/** Network-loss notice (TC-O03, NFR offline behavior): pages keep their last confirmed data and never show it as live. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  if (!offline) return null;
  return <div className="offline-banner" role="status" aria-live="polite"><strong>Offline</strong> — showing last confirmed data. Changes cannot be submitted until the connection returns.</div>;
}
