import { queryTable, listTables, updateRows } from './egdesk-helpers.ts';

async function fix() {
    try {
        const reports = await queryTable('dashboard_master');
        const res = await listTables();
        const physicalTables = (res.tables || res).map((t: any) => t.tableName || t);
        
        console.log("--- Sync Fixer ---");
        for (const report of reports) {
            const exists = physicalTables.includes(report.tableName);
            
            if (!exists) {
                console.log(`Report: ${report.name} (${report.reportId}) - Table ${report.tableName} is MISSING.`);
                
                // Try to find a table starting with tb_reportId
                const likelyTable = physicalTables.find((t: any) => t.startsWith(`tb_${report.reportId}_`));
                if (likelyTable) {
                    console.log(`  Found likely table: ${likelyTable}. Updating dashboard_master...`);
                    await updateRows('dashboard_master', { tableName: likelyTable }, { filters: { reportId: String(report.reportId) } });
                    console.log(`  Updated dashboard_master for ${report.reportId}.`);
                } else {
                    console.log(`  Could not find a likely table for ${report.reportId}.`);
                }
            }
        }
        
        // Special case for 'user' table
        const userTable = physicalTables.find((t: any) => t.startsWith('tb_user_'));
        if (userTable) {
            console.log(`\nSpecial Fix for 'user' table: ${userTable}`);
            // renameTable(userTable, 'user')
            // Many system tools might expect exactly 'user'.
            // Let's check if we can rename it.
            // But wait, if we rename it to 'user', we should also update dashboard_master to 'user'.
            
            // Actually, let's try to rename it back to 'user' to ensure compatibility with all tools.
            const { renameTable } = require('./egdesk-helpers.ts');
            try {
                await renameTable(userTable, 'user');
                console.log(`  Renamed ${userTable} back to 'user'.`);
                await updateRows('dashboard_master', { tableName: 'user' }, { filters: { reportId: 'user' } });
                console.log(`  Updated dashboard_master for user report.`);
            } catch (e: any) {
                console.error(`  Failed to rename user table: ${e.message}`);
            }
        }
        
    } catch (err) {
        console.error("Fix failed:", err);
    }
}

fix();
