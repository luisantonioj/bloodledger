import {defineConfig} from "@playwright/test";
import base from "./playwright.config";
// PA-OCR-03 is enabled only in this isolated fixture build, never on the retained host.
export default defineConfig({...base,testIgnore:[],testMatch:"**/corrected-intake-enabled.spec.ts",webServer:{...base.webServer,env:{VITE_BLOODLEDGER_CORRECTED_INTAKE_READY:"true"}}});
