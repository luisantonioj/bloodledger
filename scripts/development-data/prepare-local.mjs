// Private retained-stack configuration; never modifies accounts or the original .env.
import {Pool} from 'pg';
import {randomBytes} from 'node:crypto';import {writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';
process.loadEnvFile('.env');
const allowNewKeys=process.argv.includes('--initialize-missing-simulation-keys');
const required=['POSTGRES_DB','POSTGRES_ADMIN_USER','POSTGRES_MIGRATOR_USER','POSTGRES_MIGRATOR_PASSWORD','POSTGRES_APP_USER','POSTGRES_APP_PASSWORD'];
for(const key of required)if(!process.env[key])throw Error('LOCAL_CONFIGURATION_REQUIRED:'+key);
if(process.env.POSTGRES_DB!=='bloodledger_dev'||process.env.POSTGRES_APP_USER!=='bloodledger_app')throw Error('LOCAL_DEVELOPMENT_DATABASE_REQUIRED');
const keys=['SPRINT4_JWT_SECRET','SPRINT4_OPERATOR_CREDENTIAL','BLOODLEDGER_DONATION_ENCRYPTION_KEY','BLOODLEDGER_DONATION_LOOKUP_KEY'];
const values=Object.fromEntries([...required,...keys,'POSTGRES_ADMIN_PASSWORD','POSTGRES_HOST_PORT','SPRINT4_OPERATOR_ID','BLOODLEDGER_DONATION_ENCRYPTION_KEY_VERSION'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
if(keys.some(key=>!values[key]) && allowNewKeys) {
 const pool=new Pool({host:process.env.DEVELOPMENT_PG_HOST??'127.0.0.1',port:Number(process.env.POSTGRES_HOST_PORT??5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_APP_USER,password:process.env.POSTGRES_APP_PASSWORD});
 try {const count=(await pool.query('SELECT COUNT(*)::int AS count FROM app.v2_donations')).rows[0].count;if(count>0)throw Error('RESTORE_EXISTING_PRIVATE_KEYS_BEFORE_CONFIGURATION');}finally{await pool.end();}
}
for(const key of keys)if(!values[key]){if(!allowNewKeys)throw Error('PRESERVE_OR_EXPLICITLY_INITIALIZE_MISSING_KEY:'+key);values[key]=randomBytes(32).toString('hex');}
Object.assign(values,{API_HOST:'0.0.0.0',API_PORT:'3000',POSTGRES_HOST:'postgres',POSTGRES_PORT:'5432',WEB_ORIGIN:'http://127.0.0.1:5174',WEB_COOKIE_SECURE:'false',FABRIC_SYNC_ENABLED:'false',BLOODLEDGER_ACTIVE_WRITE_API_VERSION:'v2',BLOODLEDGER_ACTIVE_FORECAST_DATASET_VERSION:'SYNTHETIC_FORECAST_V4_RUNTIME_V1',FABRIC_PEER_ENDPOINT:'peer0-mediatrix:7051',BLOODLEDGER_REPOSITORY_ROOT:'/workspace'});
for(const value of Object.values(values))if(/[\r\n]/.test(value))throw Error('MULTILINE_CONFIGURATION_UNSUPPORTED');
const directory=resolve('build/development-local');await mkdir(directory,{recursive:true,mode:0o700});
await writeFile(directory+'/runtime.env',Object.entries(values).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600,flag:'wx'});
console.log('Private runtime configuration created. Existing keys retained; accounts unchanged. Keep runtime.env private.');
