// Reproducible local benchmark; no retained API, accounts, photos or model activation.
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2),get=(name,fallback)=>{const index=args.indexOf('--'+name);return index<0?fallback:args[index+1];};
const manifestPath=resolve(get('manifest','')),output=resolve(get('output',''));
if(!get('manifest')||!get('output')||!['baseline','regions'].includes(get('mode')))throw Error('Use --manifest --output --mode baseline|regions --split train|validation [--contrast original|contrast]');
if(!output.startsWith(join(root,'build')+'/')&&!output.startsWith('/tmp/'))throw Error('Output must be private');
if(existsSync(output))throw Error('Refusing to overwrite benchmark output');
const mode=get('mode'),split=get('split','validation');if(!['train','validation','test'].includes(split))throw Error('Unsupported split');
execFileSync('python3',[join(root,'scripts/ocr/experiment.py'),'validate','--manifest',manifestPath,'--complete'],{stdio:'pipe'});
const manifest=JSON.parse(readFileSync(manifestPath)),labels=new Map(manifest.labels.map(row=>[row.labelId,row]));
const candidateId=get('candidate',mode==='baseline'?'TESSERACT_BASELINE_V1':'TESSERACT_REGIONS_'+get('contrast','original').toUpperCase()+'_V1');
if(split==='test'){
 if(!get('selection'))throw Error('Held-out inference requires frozen validation selection');
 execFileSync('python3',['-c','import json,sys; from pathlib import Path; sys.path.insert(0,sys.argv[1]); from experiment import digest; m=json.load(open(sys.argv[2])); s=json.load(open(sys.argv[3])); assert s["datasetHash"]==digest(m) and s["candidateId"]==sys.argv[4]',join(root,'scripts/ocr'),manifestPath,resolve(get('selection')),candidateId],{stdio:'pipe'});
}

const sourcePaths=['scripts/ocr/run-browser.mjs','scripts/ocr/browser-baseline.ts','contracts/synthetic-label-layout-v1.json','package-lock.json','apps/web/src/features/receipts/receipt-ocr.ts','apps/web/src/features/receipts/label-extraction.ts','apps/web/src/features/receipts/field-regions.ts','apps/web/src/features/receipts/label-profiles.ts','apps/web/src/features/receipts/label-image-preparation.ts','apps/web/src/features/receipts/scan-review-data.ts','apps/capture-pwa/src/capture-policy.ts'];
const codeHash=createHash('sha256');for(const name of sourcePaths)codeHash.update(name).update(readFileSync(join(root,name)));
const codeArtifactHash=codeHash.digest('hex');
const assetRoot=join(root,'apps/capture-pwa/public/ocr-assets'),assetHash=createHash('sha256');
function hashAssets(folder){for(const entry of readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const full=join(folder,entry.name);if(entry.isDirectory())hashAssets(full);else if(entry.isFile())assetHash.update(relative(assetRoot,full)).update(readFileSync(full));}}
hashAssets(assetRoot);const engineAssetsHash=assetHash.digest('hex');
const configuration={nodeVersion:process.version,mode,contrast:get('contrast','original'),seed:20261017,workerLifecycle:'new-worker-per-image',timingBoundary:'preparation-and-worker-startup-through-recognition'};

const server=spawn('npm',['run','dev','--workspace','@bloodledger/web','--','--host','127.0.0.1','--port','4184','--strictPort'],{cwd:root,env:{...process.env,BLOODLEDGER_VITE_CACHE_DIR:join(root,'apps/web/node_modules/.vite-ocr-benchmark'),VITE_BLOODLEDGER_LABEL_EXTRACTION_PREVIEW:'true',BLOODLEDGER_LOCAL_ACCOUNT_SWITCHER:'false'},stdio:'ignore'});
let browser;const rows=[];
try{
 let ready=false;for(let attempt=0;attempt<50;attempt++){if(server.exitCode!==null)throw Error('Isolated Vite failed');try{const response=await fetch('http://127.0.0.1:4184/');if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}if(!ready)throw Error('Isolated Vite unavailable');
 browser=await chromium.launch({headless:true});configuration.browserVersion=browser.version();
 if(split==='test')execFileSync('python3',['-c','import json,sys; sys.path.insert(0,sys.argv[1]); from experiment import digest; s=json.load(open(sys.argv[2])); assert s["candidateFingerprint"]==digest(json.loads(sys.argv[3]))',join(root,'scripts/ocr'),resolve(get('selection')),JSON.stringify({codeArtifactHash,engineAssetsHash,configuration})],{stdio:'pipe'});
 const context=await browser.newContext();const page=await context.newPage();let downloaded=0;const assetsSeen=new Set();
 await context.route(/\/api\/v[12]\//,route=>route.abort());
 await context.route('**/__ocr_benchmark__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Private synthetic OCR benchmark</title>'}));
 await context.route('**/capture/ocr-assets/**',route=>{const suffix=new URL(route.request().url()).pathname.split('/ocr-assets/')[1],assets=join(root,'apps/capture-pwa/public/ocr-assets'),path=resolve(assets,suffix??'');if(!suffix||relative(assets,path).startsWith('..'))return route.abort();const data=readFileSync(path);if(!assetsSeen.has(suffix)){downloaded+=data.length;assetsSeen.add(suffix);}return route.fulfill({body:data,contentType:suffix.endsWith('.js')?'application/javascript':suffix.endsWith('.gz')?'application/gzip':'application/octet-stream'});});
 await page.goto('http://127.0.0.1:4184/__ocr_benchmark__');
 for(const image of manifest.images.filter(row=>labels.get(row.labelId).split===split)){
  const label=labels.get(image.labelId),bytes=readFileSync(resolve(dirname(manifestPath),image.path));
  const prediction=await page.evaluate(async({base64,mode,profileId,contrast,baselineUrl})=>{
   const module=await import('/src/features/receipts/receipt-ocr.ts'),{defaultExtractionOptions}=await import('/src/features/receipts/label-image-controls.tsx');
   const data=Uint8Array.from(atob(base64),char=>char.charCodeAt(0)),file=new File([data],'synthetic.png',{type:'image/png'}),options=defaultExtractionOptions();options.profileId=profileId;options.preparation.contrast=contrast;
   const baseline=mode==='baseline'?await import(baselineUrl):null;
   const started=performance.now();try{const review=baseline?await baseline.recognizeBaseline(file):await module.recognizeReceiptDraft(file,new AbortController().signal,()=>{},options);
   return {latencyMs:performance.now()-started,fields:Object.fromEntries(Object.keys(review.draft).map(field=>[field,{candidate:review.draft[field]||null,reviewState:review.extraction?.fields[field].state??(review.draft[field]?'recognized':'missing'),source:review.extraction?.fields[field].source??'OCR',originalConfidence:review.originalConfidence?.[field]??review.extraction?.fields[field].confidence??null,policyRoundedConfidence:review.originalConfidence?.[field]!==undefined?Math.round(review.originalConfidence[field]):review.extraction?.fields[field].confidence!=null?Math.round(review.extraction.fields[field].confidence):null,eligibleForSubmission:Boolean(review.verified)}])),peakMemoryBytes:null,jsHeapSnapshotBytes:performance.memory?.usedJSHeapSize??null};}catch{return {latencyMs:performance.now()-started,fields:{},safeErrorCode:"OCR_RECOGNITION_FAILED",peakMemoryBytes:null};}
  },{base64:bytes.toString('base64'),mode,profileId:label.profileId,contrast:get('contrast','original'),baselineUrl:'/@fs'+root+'/scripts/ocr/browser-baseline.ts'});
  rows.push({imageId:image.imageId,candidateId,candidateBoundary:"END_TO_END_EXTRACTION",codeArtifactHash,engineAssetsHash,configuration,...prediction,latencyPhase:"cold",downloadBytes:downloaded});
 }
 writeFileSync(output,rows.map(row=>JSON.stringify(row)).join('\n')+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({candidateId,images:rows.length,split,liveApiUsed:false}));
}finally{await browser?.close();server.kill('SIGTERM');}
