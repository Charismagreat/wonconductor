import { queryTable, updateRows } from './egdesk-helpers.ts';
import { DbSyncService } from './lib/services/db-sync-service.ts';

async function restorePhysical() {
    try {
        console.log("Restoring physical schemas via Blue-Green migration...");

        const reports = await queryTable('dashboard_master');

        for (const report of reports) {
            if (!report.tableName || !report.columns) continue;
            
            const columns = JSON.parse(report.columns);
            // If columns only has system columns, skip (or maybe it's already "restored" but empty)
            if (columns.length <= 3) continue; 

            console.log(`Migrating physical table for: ${report.name} (${report.reportId})`);
            
            // Current "old" columns are just system columns in reality, but DbSyncService needs to know what's physically there.
            // But wait! If I tell DbSyncService that oldColumns = [], it will just create a new table with all columns.
            const oldColumns: any[] = [
                { name: '__created_at', type: 'date' },
                { name: '__updated_at', type: 'date' },
                { name: '__creator_id', type: 'string' }
            ];

            const newTableName = await DbSyncService.migratePhysicalTable(
                report.reportId,
                report.name,
                report.tableName,
                oldColumns,
                columns
            );

            console.log(`  New table created: ${newTableName}`);

            // Update dashboard_master with new table name
            await updateRows('dashboard_master', {
                tableName: newTableName
            }, { filters: { id: String(report.id) } });
        }

        console.log("Physical restoration completed.");

    } catch (err) {
        console.error("Restoration failed:", err);
    }
}

restorePhysical();
