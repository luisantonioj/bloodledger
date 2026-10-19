import {defineConfig} from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({...base,testIgnore:[],testMatch:"**/reviewed-intake-enabled.spec.ts",webServer:{...base.webServer,env:{VITE_BLOODLEDGER_CORRECTED_INTAKE_READY:"true",VITE_BLOODLEDGER_REVIEWED_INTAKE_READY:"true"}}});
