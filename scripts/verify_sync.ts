import { queryTable, listTables } from './egdesk-helpers.ts';

async function verify() {
    try {
        const reports = await queryTable('dashboard_master');
        const res = await listTables();
        const physicalTables = (res.tables || res).map((t: any) => t.tableName || t);
        
        console.log("--- Sync Verification ---");
        for (const report of reports) {
            const exists = physicalTables.includes(report.tableName);
            console.log(`Report: ${report.name} (${report.reportId})`);
            console.log(`  Master TableName: ${report.tableName}`);
            console.log(`  Physical Exists: ${exists ? 'YES' : 'MISSING'}`);
            
            if (!exists) {
                // Try to find a table starting with tb_reportId
                const likelyTable = physicalTables.find((t: any) => t.startsWith(`tb_${report.reportId}_`));
                if (likelyTable) {
                    console.log(`  Likely migrated to: ${likelyTable}`);
                }
            }
        }
    } catch (err) {
        console.error("Verification failed:", err);
    }
}

verify();
