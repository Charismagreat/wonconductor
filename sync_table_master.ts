import { queryTable, insertRows, listTables, getTableSchema } from './src/egdesk-helpers';

async function syncTableMaster() {
    try {
        console.log('Starting Legacy Sync for table_master...');
        
        // 1. Get all reports from dashboard_master
        const reports = await queryTable('dashboard_master', { limit: 10000 }).catch(() => []);
        const reportRows = Array.isArray(reports) ? reports : (reports?.rows || []);
        
        // 2. Get existing table_master entries to avoid duplicates
        const existingMaster = await queryTable('table_master', { limit: 10000 }).catch(() => []);
        const existingNames = new Set(existingMaster.map((t: any) => t.tableName));
        
        const newEntries: any[] = [];
        
        for (const report of reportRows) {
            if (report.tableName && !existingNames.has(report.tableName)) {
                console.log(`Registering legacy table: ${report.tableName} (${report.name})`);
                
                // Try to get actual schema if possible
                let schema = report.columns;
                try {
                    const physicalSchema = await getTableSchema(report.tableName).catch(() => null);
                    if (physicalSchema) {
                        schema = JSON.stringify(physicalSchema);
                    }
                } catch (e) {}
                
                newEntries.push({
                    tableName: report.tableName,
                    displayName: report.name,
                    category: report.tableName.startsWith('tpl_') ? 'INDUSTRY' : 'EXCEL',
                    schema: schema,
                    createdAt: report.createdAt || new Date().toISOString()
                });
                
                existingNames.add(report.tableName);
            }
        }
        
        // 3. Register System Tables that are not reports but are important
        const systemTables = [
            'user', 'dashboard_master', 'dashboard_data', 'dashboard_access', 
            'table_master', 'workflow_steering', 'notification', 'department', 'source_view_settings'
        ];
        
        for (const sysTable of systemTables) {
            if (!existingNames.has(sysTable)) {
                console.log(`Registering system table: ${sysTable}`);
                newEntries.push({
                    tableName: sysTable,
                    displayName: sysTable,
                    category: 'SYSTEM',
                    createdAt: new Date().toISOString()
                });
                existingNames.add(sysTable);
            }
        }
        
        if (newEntries.length > 0) {
            await insertRows('table_master', newEntries);
            console.log(`Successfully registered ${newEntries.length} tables in table_master.`);
        } else {
            console.log('No new tables to register.');
        }
        
    } catch (err) {
        console.error('Sync failed:', err);
    }
}

syncTableMaster();
