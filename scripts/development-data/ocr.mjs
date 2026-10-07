import { createWorker, OEM } from 'tesseract.js';
import { chromium } from '@playwright/test';
import ts from 'typescript';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// Use the accepted parser and real line confidences. Raw images/text stay volatile.
export async function recognizeScenarios(scenarios) {
  const directory=resolve('build/development-parser');await mkdir(directory,{recursive:true});
  for(const name of ['types','capture-policy']) {
    const source=await readFile(`apps/capture-pwa/src/${name}.ts`,'utf8');
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('"./types"','"./types.mjs"');
    await writeFile(`${directory}/${name}.mjs`,compiled,{mode:0o600});
  }
  const {parseInboundOcrLines}=await import(pathToFileURL(`${directory}/capture-policy.mjs`));
  const browser=await chromium.launch({headless:true});
  const worker=await createWorker('eng',OEM.LSTM_ONLY,{langPath:resolve('apps/capture-pwa/public/ocr-assets/lang'),cacheMethod:'none',logger:()=>undefined});
  await worker.setParameters({tessedit_pageseg_mode:7});
  const evidence=[];
  try {
    const page=await browser.newPage();
    const fields=[['DONATION NO','donationNumber'],['BLOOD TYPE','bloodType'],['COMPONENT','componentType'],['COLLECTED AT','collectedAt'],['EXPIRES AT','expiresAt']];
    for(const scenario of scenarios) {
      const lines=[];
      for(const [field,key] of fields) {
        let recognized;
        // Known printed field regions; the recognized value is never corrected
        // or replaced by its expected value. Each confidence comes from OCR.
        for(const font of ['28px Arial','32px Arial','36px Arial','40px Arial','48px Arial','56px Arial','28px monospace','32px monospace','36px monospace','40px monospace','48px monospace','bold 28px Arial','bold 32px Arial','bold 36px Arial','bold 40px Arial']) {
          await page.setContent('<canvas width="2200" height="180"></canvas>');
          await page.evaluate(({value,font})=>{const canvas=document.querySelector('canvas'),context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,2200,180);context.fillStyle='black';context.font=font;context.fillText(value,35,100);},{value:field+': '+scenario[key],font});
          const image=await page.locator('canvas').screenshot();
          const result=await worker.recognize(image,{}, {blocks:true});
          const text=result.data.text.trim(); const confidence=result.data.confidence;
          if(text===field+': '+scenario[key]&&Math.round(confidence)>=90) {recognized={text,confidence};break;}
        }
        if(!recognized) {console.error('SEED_OCR_FIELD_REJECTED:'+key);throw new Error('SEED_OCR_EXACT_CONFIDENT_FIELD_REQUIRED');}
        lines.push(recognized);
      }
      const parsed=parseInboundOcrLines(lines);
      for(const key of Object.keys(parsed.label)) if(parsed.label[key]!==scenario[key]) throw new Error('SEED_OCR_EXACT_VALUE_MISMATCH');
      evidence.push({...scenario,ocr:parsed.fieldConfidence,capturedAt:new Date().toISOString(),engine:'TESSERACT_JS',engineVersion:'7.0.0',ocrMethod:'GENERATED_SYNTHETIC_LABEL_FIELD_REGIONS'});
    }
    return evidence;
  } finally {await worker.terminate();await browser.close();}
}
