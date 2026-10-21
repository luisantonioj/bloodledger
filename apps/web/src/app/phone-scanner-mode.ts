import { useEffect, useState } from "react";
import type { Principal } from "../auth/permissions";
import { isRequester } from "../features/dashboard/requester-dashboard-data";

// Scans are captured on the phone only. A touch device at phone width opens the scanner-only screen;
// laptops keep the full web app and point staff to the phone for every scan step.
const PHONE_QUERY = "(pointer: coarse) and (max-width: 760px)";
const matchesPhone = () => typeof matchMedia === "function" && matchMedia(PHONE_QUERY).matches;

export function usePhoneScannerMode() {
  const [phone, setPhone] = useState(matchesPhone);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia(PHONE_QUERY), changed = () => setPhone(query.matches);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  return phone;
}

export type PhoneScanner = "BANK" | "RECEIPT";
export function phoneScannerFor(principal: Principal): PhoneScanner | undefined {
  if (principal.accountCategory ? principal.accountCategory === "BLOOD_BANK" : ["ROLE-01", "ROLE-02"].includes(principal.roleId)) return "BANK";
  if (isRequester(principal)) return "RECEIPT";
  return undefined;
}

export const SCAN_ON_PHONE_NOTE = "Scanning is done on the phone. Open BloodLedger on the phone and sign in; the scanner opens automatically.";
