// Offline Tesseract baseline on the exact shared Pillow RGB crops used by TrOCR.
import {readFileSync, writeFileSync, existsSync, realpathSync} from 'node:fs';
import {resolve, dirname, relative, isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createWorker, OEM} from 'tesseract.js';
const require = createRequire(import.meta.url);
const args=process.argv.slice(2),get=name=>args[args.indexOf('--'+name)+1];
for(const key of ['crops','lang-path','output']) if(!args.includes('--'+key)) throw Error('Required --crops --lang-path --output');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=resolve(get('output'));
const parent=realpathSync(dirname(output));
if(!(parent===resolve(root,'build')||parent.startsWith(resolve(root,'build')+'/')||parent==='/tmp'||parent.startsWith('/tmp/'))) throw Error('Output must remain private');
if(existsSync(output)) throw Error('Refusing overwrite');
if(require('tesseract.js/package.json').version!=='7.0.0') throw Error('Tesseract version mismatch');
const source=realpathSync(get('crops')), base=dirname(source), plan=JSON.parse(readFileSync(source));
const boundary='GROUND_TRUTH_FIELD_CROPS_NOT_END_TO_END_EXTRACTION';
if(plan.candidateBoundary!==boundary||!['train','validation'].includes(plan.split)||plan.pillowVersion!=='11.3.0') throw Error('Invalid shared crop plan');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const lang=realpathSync(get('lang-path'));
const assetSha=sha(readFileSync(resolve(lang,'eng.traineddata.gz')));
if(assetSha!=='45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91') throw Error('Pinned local language hash mismatch');
const configuration={nodeVersion:process.version,tesseractVersion:'7.0.0',workerLifecycle:'reuse-worker-after-first-photo',oem:'LSTM_ONLY',segmentation:'DEFAULT',sharedCropManifestSha256:sha(readFileSync(source)),split:plan.split};
const codeArtifactHash=sha(Buffer.concat([readFileSync(fileURLToPath(import.meta.url)),readFileSync(resolve(root,'package-lock.json')),readFileSync(resolve(root,'scripts/ocr/field_crops.py'))]));
let worker;const rows=[];const initialization=performance.now();
try {
 worker=await createWorker('eng',OEM.LSTM_ONLY,{langPath:lang,cacheMethod:'none',logger:()=>{}});
 const startup=performance.now()-initialization;
 for(const [index,image] of plan.images.entries()) {
  const started=performance.now(),fields={};let safeErrorCode;
  for(const [field,crop] of Object.entries(image.crops)) {
   const path=realpathSync(resolve(base,crop.path)), rel=relative(base,path);
   if(rel.startsWith('..')||isAbsolute(rel)) throw Error('Crop path escape');
   const bytes=readFileSync(path);if(sha(bytes)!==crop.sha256)throw Error('Crop hash mismatch');
   try {
    const result=await worker.recognize(bytes);
    fields[field]={candidate:result.data.text.trim()||null,reviewState:result.data.text.trim()?'recognized':'missing',source:'OCR',eligibleForSubmission:false,originalConfidence:result.data.confidence};
   } catch {safeErrorCode='OCR_CROP_RECOGNITION_FAILED';fields[field]={candidate:null,reviewState:'needs review',source:'OCR',eligibleForSubmission:false};}
  }
  rows.push({imageId:image.imageId,candidateId:'TESSERACT_SHARED_FIELD_CROPS_V1',candidateBoundary:boundary,
   codeArtifactHash,engineAssetsHash:assetSha,configuration,fields,safeErrorCode,
   latencyMs:performance.now()-started+(index===0?startup:0),latencyPhase:index===0?'cold':'warm',
   downloadBytes:0,localLanguageBytes:readFileSync(resolve(lang,'eng.traineddata.gz')).length,peakMemoryBytes:null});
 }
 writeFileSync(output,rows.map(row=>JSON.stringify(row)).join('\n')+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({images:rows.length,boundary,networkDownloads:false,runtimeActivated:false}));
} finally {await worker?.terminate();}
