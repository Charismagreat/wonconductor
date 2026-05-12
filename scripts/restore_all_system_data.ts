import { deleteRows, insertRows, queryTable } from './egdesk-helpers';
import * as fs from 'fs';
import * as path from 'path';

async function restoreSystemData() {
    console.log('Restoring system data from backups...');
    
    const backups = [
        { file: 'micro_app_projects_backup.json', table: 'micro_app_projects' },
        { file: 'dashboard_chart_backup.json', table: 'dashboard_chart' },
        { file: 'workspace_item_backup.json', table: 'workspace_item' },
        { file: 'department_backup.json', table: 'department' }
    ];

    for (const b of backups) {
        try {
            const backupPath = path.join(process.cwd(), b.file);
            if (!fs.existsSync(backupPath)) {
                console.log(`Skipping ${b.table}: backup file not found.`);
                continue;
            }

            const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            if (!Array.isArray(backupData) || backupData.length === 0) {
                console.log(`Skipping ${b.table}: backup is empty.`);
                continue;
            }

            console.log(`Restoring ${b.table} (${backupData.length} rows)...`);

            // 1. Clear existing rows
            // We use a range of IDs to clear since empty filters are not allowed
            await deleteRows(b.table, { ids: Array.from({length: 1000}, (_, i) => i + 1) })
                .catch(() => {});
            
            // 2. Insert data
            const rowsToInsert = backupData.map((row: any) => {
                const { id, __created_at, __updated_at, __creator_id, createdBy, userId, ownerId, ...rest } = row;
                
                // Map old user IDs to new one (21)
                const mappedCreatorId = (createdBy === '1' || userId === '1' || ownerId === '1' || __creator_id === '1') ? '21' : (__creator_id || createdBy || userId || ownerId || '21');

                return {
                    ...rest,
                    userId: (userId === '1' || row.userId === '1') ? '21' : (userId || row.userId),
                    createdBy: (createdBy === '1' || row.createdBy === '1') ? '21' : (createdBy || row.createdBy),
                    __created_at: __created_at || new Date().toISOString(),
                    __updated_at: __updated_at || new Date().toISOString(),
                    __creator_id: mappedCreatorId
                };
            });

            await insertRows(b.table, rowsToInsert);
            console.log(`  Successfully restored ${b.table}.`);

        } catch (err: any) {
            console.error(`Failed to restore ${b.table}:`, err.message);
        }
    }

    console.log('System data restoration completed.');
}

restoreSystemData();
