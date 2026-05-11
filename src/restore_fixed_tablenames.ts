import { queryTable, getTableSchema, updateRows, deleteTable, createTable, insertRows, listTables } from './egdesk-helpers';
import * as fs from 'fs';
import * as path from 'path';

async function restoreFixedTableNames() {
  console.log('Restoring fixed system table names...');

  const tables = await queryTable('table_master', { limit: 1000 });
  const result = await listTables();
  const currentTables = Array.isArray(result) ? result : (result?.tables || []);
  const physicalTables = currentTables.map((t: any) => (typeof t === 'string' ? t : (t.tableName || t.name)));
  
  const nameMapping: Record<string, string> = {
    '은행 계좌 거래 내역 (FinanceHub)': 'bank_transactions',
    '신용카드 거래 내역 (FinanceHub)': 'card_approvals',
    '매출세금계산서 (홈택스)': 'hometax_sales_tax_invoices',
    '매출계산서 (홈택스)': 'hometax_sales_invoices',
    '매입세금계산서 (홈택스)': 'hometax_purchase_tax_invoices',
    '매입계산서 (홈택스)': 'hometax_purchase_invoices',
    '현금영수증 내역 (홈택스)': 'hometax_cash_receipts',
    '전자어음 내역 (FinanceHub)': 'promissory_notes',
    '부서 관리': 'department',
    'dashboard_chart': 'dashboard_chart',
    'micro_app_projects': 'micro_app_projects',
    'workspace_item': 'workspace_item',
    'table_knowledge': 'table_knowledge',
    'master_client_employee': 'master_client_employee',
    'master_product': 'master_product',
    'master_client': 'master_client',
    'workflow_steering': 'workflow_steering',
    'workflow_instance': 'workflow_instance',
    'workflow_template': 'workflow_template',
    'action_task': 'action_task',
    'action_task_history': 'action_task_history'
  };

  for (const table of tables) {
    const originalName = nameMapping[table.displayName];
    const currentName = table.tableName;
    
    // Only proceed if it's a suffixed table and we have a mapping
    if (currentName.startsWith('tb_') && originalName) {
      
      // CRITICAL: Check if the source table actually exists physically
      if (!physicalTables.includes(currentName)) {
        console.log(`Skipping ${currentName} -> ${originalName}: source table missing physically.`);
        // Optional: delete orphaned table_master entry
        continue;
      }

      console.log(`Restoring ${currentName} -> ${originalName}...`);

      try {
        // Ensure destination doesn't exist (unless it's the same name)
        if (currentName !== originalName) {
            // CRITICAL SAFETY: Never delete a system table to restore a suffixed one
            const { SYSTEM_TABLES } = await import('./app/actions/shared');
            const isSystemTable = SYSTEM_TABLES.some(st => st.tableName === originalName);
            if (isSystemTable) {
                console.warn(`  CRITICAL: Target table ${originalName} is a system table. Skipping destructive restoration to prevent data loss.`);
                continue;
            }

            const backupPath = path.join(process.cwd(), `${originalName}_backup.json`);
            if (fs.existsSync(backupPath)) {
                try {
                    await deleteTable(originalName);
                } catch (e) {}
            } else {
                console.warn(`  Skipping deletion of ${originalName}: No backup file found for safety.`);
                // If it exists physically, we might want to skip or merge instead of creating new
                if (physicalTables.includes(originalName)) {
                    console.log(`  Target table ${originalName} already exists. Skipping recreation.`);
                    continue;
                }
            }
        }

        const physicalSchema = await getTableSchema(currentName);
        const tableSchema = physicalSchema.map((c: any) => ({
            name: c.name,
            type: c.type as 'TEXT' | 'INTEGER'
        }));

        // 1. Create original table
        await createTable(originalName, tableSchema, { tableName: originalName });
        
        // 2. Migrate data
        const data = await queryTable(currentName, { limit: 100000 });
        if (data && data.length > 0) {
            await insertRows(originalName, data);
        }

        // 3. Update table_master
        await updateRows('table_master', {
            tableName: originalName,
            schema: JSON.stringify(physicalSchema),
            updatedAt: new Date().toISOString()
        }, { filters: { tableName: currentName } });

        // 4. Update dashboard_master
        const reports = await queryTable('dashboard_master', { filters: { tableName: currentName } });
        for (const report of reports) {
            await updateRows('dashboard_master', {
                tableName: originalName
            }, { filters: { id: String(report.id) } });
        }

        // 5. Delete suffixed table
        await deleteTable(currentName);

        console.log(`  Successfully restored ${originalName}`);
      } catch (err: any) {
        console.error(`Failed to restore ${originalName}:`, err.message);
      }
    }
  }

  console.log('System table name restoration completed.');
}

restoreFixedTableNames();
