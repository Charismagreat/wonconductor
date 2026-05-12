import { queryTable, getTableSchema, updateRows, listTables } from './egdesk-helpers';
import { DbSyncService } from './lib/services/db-sync-service';

async function applyAuditColumnsGlobally() {
  console.log('Applying audit columns (__created_at, __updated_at, __creator_id) globally...');

  const tables = await queryTable('table_master', { limit: 1000 });
  const excludeList = [
    'dashboard_master', 'table_master', 'dashboard_data', 'dashboard_access', 
    'system_settings', 'notification', 'source_view_settings', 'input_guardrail',
    'dashboard_data_history', 'sync_activity_log', 'sync_configurations',
    'ai_studio_session_persistence', 'ai_persistence_test', 'ai_studio_session',
    'user_data_files'
  ];

  for (const table of tables) {
    if (excludeList.includes(table.tableName)) {
      console.log(`Skipping system table: ${table.tableName}`);
      continue;
    }

    try {
      const physicalSchema = await getTableSchema(table.tableName);
      const columnNames = physicalSchema.map((c: any) => c.name);

      if (!columnNames.includes('__created_at')) {
        console.log(`Migrating table: ${table.tableName} (${table.displayName})...`);

        const oldColumns = physicalSchema.map((c: any) => ({
          name: c.name,
          displayName: c.name,
          type: (c.type === 'INTEGER' || c.type === 'REAL') ? 'number' : 'text'
        }));

        const newColumns = [...oldColumns];
        newColumns.push(
          { name: '__created_at', displayName: '생성일시', type: 'date' },
          { name: '__updated_at', displayName: '수정일시', type: 'date' },
          { name: '__creator_id', displayName: '작성자', type: 'text' }
        );

        // Migrate physical table
        const newTableName = await DbSyncService.migratePhysicalTable(
          table.tableName, // Use tableName as reportId
          table.displayName || table.tableName,
          table.tableName,
          oldColumns,
          newColumns
        );

        console.log(`  Successfully migrated ${table.tableName} -> ${newTableName}`);

        // Update dashboard_master if it exists
        const reports = await queryTable('dashboard_master', { 
            filters: { tableName: table.tableName } 
        });
        
        if (reports.length > 0) {
          for (const report of reports) {
            console.log(`  Updating dashboard_master for report ${report.id}...`);
            await updateRows('dashboard_master', {
              tableName: newTableName,
              columns: JSON.stringify(newColumns.map(c => ({
                name: c.name,
                displayName: c.displayName,
                type: c.type,
                isSystem: c.name.startsWith('__')
              })))
            }, { filters: { id: String(report.id) } });
          }
        }
      }
    } catch (err: any) {
      console.error(`Failed to process table ${table.tableName}:`, err.message);
    }
  }

  console.log('Global audit column application completed.');
}

applyAuditColumnsGlobally();
