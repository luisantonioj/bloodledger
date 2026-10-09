import { Client } from 'pg';
import { runner } from 'node-pg-migrate';
const client=new Client({host:'127.0.0.1',user:'postgres',database:'bloodledger_accounts_test'});
await client.connect();
try{
  await client.query("CREATE ROLE bloodledger_migrator LOGIN; CREATE ROLE bloodledger_app LOGIN; GRANT bloodledger_migrator TO postgres");
  await client.query("SET ROLE bloodledger_migrator");
  // The disposable database is owned by the migrator, like the retained host.
  await client.query("RESET ROLE; ALTER DATABASE bloodledger_accounts_test OWNER TO bloodledger_migrator; SET ROLE bloodledger_migrator");
  await runner({dbClient:client,direction:'up',dir:new URL('../../../database/migrations',import.meta.url).pathname,ignorePattern:'README\\.md',migrationsSchema:'public',migrationsTable:'pgmigrations',log:()=>{}});
}finally{await client.end();}
process.env.POSTGRES_DB='bloodledger_accounts_test';process.env.POSTGRES_MIGRATOR_USER='bloodledger_migrator';process.env.POSTGRES_APP_USER='bloodledger_app';
await import('./institution-accounts-probe.mjs');
