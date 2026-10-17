import {defineConfig} from "@playwright/test";
import base from "./playwright.config";
// ADR-049 receipt flow; the readiness flag is enabled only in this isolated test build.
export default defineConfig({...base,testIgnore:[],testMatch:"**/receipt-verification-enabled.spec.ts",webServer:{...base.webServer,command:"npm run build && vite preview --host 127.0.0.1 --port 4174",url:"http://127.0.0.1:4174",reuseExistingServer:false,env:{VITE_BLOODLEDGER_RECEIPT_VERIFICATION_READY:"true"}}});
