import { useState } from "react";
import type { Principal } from "../auth/permissions";
import { OfflineBanner } from "../components/ui/offline-banner";
import { UnitCaptureWorkspace } from "../features/receipts/unit-capture-workspace";
import { BankUnitScannerBody } from "../features/transactions/bank-unit-scanner";
import type { PhoneScanner } from "./phone-scanner-mode";

/** Scanner-only screen for phones: same capture workflow as the web mobile scanner, without other pages. */
export function PhoneScannerShell({ principal, scanner, onSignOut }: { principal: Principal; scanner: PhoneScanner; onSignOut: () => void }) {
  const [direction, setDirection] = useState<"Inbound" | "Outbound" | null>(null), [locked, setLocked] = useState(false);
  const eyebrow = scanner === "RECEIPT" ? "Inbound only" : direction;
  return <div className="phone-scanner-shell">
    <header className="phone-scanner-header">
      <img className="bloodledger-logo" src="/bloodledger-logo-updated.png" alt="BloodLedger logo"/>
      <div><h1>{scanner === "RECEIPT" ? "Mobile Receipt Scanner" : "Mobile Blood Unit Scanner"}</h1><span className="receipt-eyebrow">{principal.institutionDisplayName}{eyebrow ? " · " + eyebrow : ""}</span></div>
      <button className="sign-out" type="button" disabled={locked} onClick={onSignOut} title="Sign out" aria-label="Sign out"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
    </header>
    <OfflineBanner/>
    <main className="receipt-scanner-content phone-scanner-content" aria-label={scanner === "RECEIPT" ? "Mobile receipt scanner" : "Mobile blood unit scanner"}>
      {scanner === "RECEIPT" ? <UnitCaptureWorkspace principal={principal} direction="Inbound" onLockChange={setLocked}/>
        : <BankUnitScannerBody principal={principal} direction={direction} onDirection={setDirection} onLockChange={setLocked}/>}
    </main>
  </div>;
}
