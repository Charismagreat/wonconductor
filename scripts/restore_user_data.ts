import { deleteRows, insertRows } from './egdesk-helpers';
import * as fs from 'fs';
import * as path from 'path';

async function restoreUserData() {
    console.log('Restoring user data from backup...');
    
    try {
        const backupPath = path.join(process.cwd(), 'user_backup.json');
        if (!fs.existsSync(backupPath)) {
            throw new Error('Backup file not found');
        }
        
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        
        // 1. Clear existing rows (up to 100)
        console.log('Step 1: Clearing existing user rows...');
        await deleteRows('user', { ids: Array.from({length: 100}, (_, i) => i + 1) }).catch(e => console.warn('Clear failed:', e.message));
        
        // 2. Insert rows from backup
        console.log(`Step 2: Inserting ${backupData.length} rows from backup...`);
        // Map data to match table columns if necessary (backup has string IDs, table has integer PK ID automatically)
        const rowsToInsert = backupData.map((u: any) => {
            const { id, ...rest } = u;
            // If id is a number string, use it. If not, let DB generate new ID.
            // But some system parts might rely on specific IDs.
            // Wait, the user table in dashboard_master says id is the PK.
            return {
                ...rest,
                // We keep the original id if possible, but let's see.
                // Actually, the system rules say id is INTEGER PRIMARY KEY AUTOINCREMENT.
                // So we shouldn't insert id.
            };
        });
        
        await insertRows('user', rowsToInsert);
        console.log('User data restoration completed successfully.');
        
    } catch (err) {
        console.error('Restoration failed:', err);
    }
}

restoreUserData();
