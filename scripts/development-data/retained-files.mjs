// TP-STOCK-01 / NFR-12: read-only identity/secret byte and retained mount checks.
import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { digest, canonical } from './scenario.mjs';
import { fileDigest } from './stock-review.mjs';
import { privateJson, savePrivate } from './institution-maintenance.mjs';
import { requireStock } from './stock-plan.mjs';

export async function hashTree(root, prefix = '') {
  const result = [];
  for(const name of (await readdir(root)).sort()) {
    const path = join(root,name), info = await lstat(path), relative = prefix + name;
    requireStock(!info.isSymbolicLink(), 'STOCK_IDENTITY_SYMLINK_UNREVIEWED');
    if(info.isDirectory()) result.push(...await hashTree(path,relative+'/'));
    else {requireStock(info.isFile(),'STOCK_IDENTITY_FILE_INVALID');result.push({path:relative,sha256:fileDigest(await readFile(path)),mode:info.mode & 0o777});}
  }
  return result;
}
export function compareRetainedFiles(before, after) {
  requireStock(before.classification === 'SIMULATION_ONLY' && after.classification === 'SIMULATION_ONLY' && canonical(before.files) === canonical(after.files) && canonical(before.mounts) === canonical(after.mounts) && canonical(before.volumes) === canonical(after.volumes), 'STOCK_RETAINED_FILES_OR_VOLUMES_CHANGED');
}
async function capture() {
  const root = resolve(process.env.BLOODLEDGER_FABRIC_GENERATED_ROOT ?? 'network/generated');
  const files = [];
  for(const part of ['organizations','channel-artifacts']) files.push(...(await hashTree(join(root,part))).map(file=>({...file,path:part+'/'+file.path})));
  const environment = resolve(process.env.BLOODLEDGER_DEV_ENV_FILE ?? '.env');
  files.push({path:'PRIVATE_RUNTIME_ENV',sha256:fileDigest(await readFile(environment)),mode:(await lstat(environment)).mode & 0o777});
  const mounts = {}, volumes = {};
  for(const container of ['bloodledger-postgres-1','bloodledger-ca-mediatrix-1','bloodledger-ca-orderer-1','bloodledger-orderer0-1','bloodledger-peer0-mediatrix-1']) {
    mounts[container] = JSON.parse(execFileSync('docker',['inspect',container,'--format','{{json .Mounts}}'],{encoding:'utf8'})).sort((a,b)=>a.Destination.localeCompare(b.Destination));
    for(const mount of mounts[container]) if(mount.Type === 'volume') {
      requireStock(mount.Name.startsWith('bloodledger_'),'STOCK_PROJECT_VOLUME_REQUIRED');
      volumes[mount.Name] = execFileSync('docker',['volume','inspect',mount.Name,'--format','{{.CreatedAt}}'],{encoding:'utf8'}).trim();
    }
  }
  return {classification:'SIMULATION_ONLY',files,mounts,volumes,capturedAt:new Date().toISOString()};
}
export async function main(args=process.argv.slice(2)) {
  const action=args.shift();requireStock(['capture','compare'].includes(action),'STOCK_RETAINED_FILES_ACTION_INVALID');
  const options={};for(let i=0;i<args.length;i+=2){requireStock(['--output','--baseline'].includes(args[i]) && args[i+1] && !options[args[i]],'STOCK_RETAINED_FILES_ARGUMENT_INVALID');options[args[i]]=args[i+1];}
  requireStock(options['--output'] && (action !== 'compare' || options['--baseline']),'STOCK_RETAINED_FILES_ARGUMENT_INVALID');
  const current = await capture();
  if(action === 'compare') compareRetainedFiles(await privateJson(options['--baseline']),current);
  await savePrivate(options['--output'],current);
  console.log(canonical({result:action === 'compare'?'PASS':'CAPTURED',classification:'SIMULATION_ONLY',identityAndSecretFiles:current.files.length,retainedVolumes:Object.keys(current.volumes).length,fingerprint:digest({files:current.files,mounts:current.mounts,volumes:current.volumes})}));
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'STOCK_RETAINED_FILES_CAPTURE_FAILED');process.exitCode=2;});
