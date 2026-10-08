// TP-STOCK-01 diagnostic only: no sessions, database, Fabric or approval.
import { readFile,writeFile } from 'node:fs/promises';
import { allocateLabels,validateScenarioBytes,requireStock } from '../../scripts/development-data/stock-plan.mjs';
import { recognizeScenarios } from '../../scripts/development-data/ocr.mjs';
import { digest,canonical } from '../../scripts/development-data/scenario.mjs';
const scenario=validateScenarioBytes(await readFile(process.argv[2]));
const labels=allocateLabels(scenario,digest('ISOLATED_OCR_DIAGNOSTIC_ONLY'),1000,Buffer.alloc(32,2));
const recognized=await recognizeScenarios(labels);
requireStock(recognized.length===522 && recognized.every(l=>['donationNumber','bloodType','collectedAt','expiresAt'].every(k=>l.ocr[k]>=90)),'STOCK_OCR_DIAGNOSTIC_FAILED');
if(process.argv[3])await writeFile(process.argv[3],canonical(recognized)+'\n',{flag:'wx',mode:0o600});
console.log(canonical({classification:'SIMULATION_ONLY',diagnosticOnly:true,recognizedUnits:recognized.length,componentTypes:new Set(recognized.map(l=>l.componentType)).size,evidenceSha256:digest(recognized),minimumFieldConfidence:Math.min(...recognized.flatMap(l=>Object.values(l.ocr))),rawImagesOrTextPersisted:false,liveTargetPreview:'NOT_RUN'}));
