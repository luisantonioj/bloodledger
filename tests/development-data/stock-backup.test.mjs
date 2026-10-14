// TP-JOP-D17 / TP-STOCK-01 / NFR-05: confirm, apply and resume bind the exact validated backup.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateBackup} from '../../scripts/development-data/stock-cli.mjs';
test('TP-JOP-D17: the validated backup hash binds the approval, execution and instance',async()=>{
 const backup=join(await mkdtemp(join(tmpdir(),'stock-backup-')),'before.dump');
 await writeFile(backup,Buffer.from('PGDMP synthetic test bytes'));
 const hash=createHash('sha256').update(Buffer.from('PGDMP synthetic test bytes')).digest('hex');
 process.env.DEVELOPMENT_VALIDATED_BACKUP_SHA256=hash;process.env.DEVELOPMENT_VALIDATED_BACKUP_INSTANCE_ID='INSTANCE_SYNTH';
 const execution={backupSha256:hash,target:{instanceId:'INSTANCE_SYNTH'}};
 assert.equal(await validateBackup({backup,'approve-backup':hash},execution),hash);
 await assert.rejects(validateBackup({backup,'approve-backup':'0'.repeat(64)},execution),/STOCK_BACKUP_APPROVAL_MISMATCH/);
 await assert.rejects(validateBackup({backup,'approve-backup':hash},{...execution,backupSha256:'1'.repeat(64)}),/STOCK_BACKUP_EXECUTION_MISMATCH/);
 await assert.rejects(validateBackup({backup,'approve-backup':hash},{...execution,target:{instanceId:'OTHER'}}),/STOCK_BACKUP_TARGET_MISMATCH/);
});
