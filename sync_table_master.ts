import { queryTable, insertRows, listTables, getTableSchema } from './egdesk-helpers';

async function syncTableMaster() {
    try {
        console.log('Starting Legacy Sync for table_master...');
        
        // 1. Get all physical tables from the database
        const tablesResult = await listTables();
        const physicalTables = Array.isArray(tablesResult) ? tablesResult : (tablesResult?.tables || []);
        
        // 2. Get existing table_master entries to avoid duplicates
        const existingMasterRaw = await queryTable('table_master', { limit: 10000 }).catch(() => []);
        const existingMaster = Array.isArray(existingMasterRaw) ? existingMasterRaw : (existingMasterRaw as any)?.rows || [];
        const existingNames = new Set(existingMaster.map((t: any) => t.tableName));
        
        const newEntries: any[] = [];
        
        for (const table of physicalTables) {
            const tName = typeof table === 'string' ? table : (table.tableName || table.name);
            if (!tName || existingNames.has(tName)) continue;

            console.log(`Discovering new physical table: ${tName}`);
            
            // Determine category
            let category = 'SYSTEM';
            if (tName.startsWith('tb_')) category = 'EXCEL';
            else if (tName.startsWith('tpl_')) category = 'INDUSTRY';
            
            // Try to get actual schema if possible
            let schema = '[]';
            try {
                const schemaRes = await getTableSchema(tName).catch(() => null);
                const columns = Array.isArray(schemaRes) ? schemaRes : (schemaRes as any)?.columns || (schemaRes as any)?.schema || [];
                if (columns.length > 0) {
                    schema = JSON.stringify(columns);
                }
            } catch (e) {}
            
            newEntries.push({
                tableName: tName,
                displayName: tName.toUpperCase(),
                category: category,
                schema: schema,
                createdAt: new Date().toISOString()
            });
            
            existingNames.add(tName);
        }
        
        if (newEntries.length > 0) {
            await insertRows('table_master', newEntries);
            console.log(`Successfully registered ${newEntries.length} new tables in table_master.`);
        } else {
            console.log('No new tables to register.');
        }
        
    } catch (err) {
        console.error('Sync failed:', err);
    }
}

syncTableMaster();
