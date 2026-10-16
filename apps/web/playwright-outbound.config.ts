import {defineConfig} from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({...base,testIgnore:[],testMatch:"**/outbound-verification-enabled.spec.ts",webServer:{...base.webServer,command:"npm run build && vite preview --host 127.0.0.1 --port 4174",url:"http://127.0.0.1:4174",reuseExistingServer:false,env:{VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY:"true"}}});
