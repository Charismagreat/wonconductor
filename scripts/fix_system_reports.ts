import { queryTable, updateRows } from './egdesk-helpers';
import { TABLES } from '../egdesk.config';
import { DbSyncService } from './lib/services/db-sync-service';

async function fixSystemReports() {
  console.log('Fixing system-level reports (FinanceHub/Hometax)...');

  // Mapping from reportId in dashboard_master to table key in TABLES (egdesk.config.ts)
  const mapping: Record<string, string> = {
    'bank_transactions': 'table1',
    'card_approvals': 'table7',
    'promissory_notes': 'table4',
    'hometax_sales_tax_invoices': 'table6',
    'hometax_purchase_tax_invoices': 'table5',
    'hometax_cash_receipts': 'table130',
    'hometax_purchase_invoices': 'table131',
    'hometax_sales_invoices': 'table132'
  };

  const reports = await queryTable('dashboard_master', { limit: 1000 });

  for (const report of reports) {
    const tableKey = mapping[report.reportId];
    if (tableKey && (TABLES as any)[tableKey]) {
      const tableDef = (TABLES as any)[tableKey];
      console.log(`Syncing ${report.name} (${report.reportId}) with schema from ${tableKey}...`);

      const columns = tableDef.columns.map((c: string) => {
        let type = 'text';
        if (c === 'id') type = 'number';
        else if (c.includes('Date') || c.includes('Date')) type = 'date';
        else if (c.includes('amount') || c.includes('Amount') || c.includes('balance') || c.includes('Balance') || c.includes('withdrawal') || c.includes('deposit')) type = 'currency';
        
        return {
          name: c,
          displayName: c,
          type: type
        };
      });

      // Ensure system columns
      const hasCreatedAt = columns.some((c: any) => c.name === '__created_at');
      if (!hasCreatedAt) {
        columns.push({ name: '__created_at', displayName: '생성일시', type: 'date' });
        columns.push({ name: '__updated_at', displayName: '수정일시', type: 'date' });
        columns.push({ name: '__creator_id', displayName: '생성자', type: 'text' });
      }

      await updateRows('dashboard_master', {
        columns: JSON.stringify(columns)
      }, {
        filters: { id: String(report.id) }
      });

      console.log(`Migrating physical table for ${report.reportId}...`);
      try {
        const oldCols = JSON.parse(report.columns || '[]');
        await DbSyncService.migratePhysicalTable(
          report.reportId,
          report.name,
          report.tableName,
          oldCols,
          columns
        );
      } catch (e) {
        console.error(`Failed to migrate ${report.reportId}:`, e);
      }
    }
  }

  console.log('System report fix completed.');
}

fixSystemReports();
