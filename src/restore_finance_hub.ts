import { createTable, deleteTable, insertRows, queryTable, updateRows, deleteRows } from './egdesk-helpers';
import fs from 'fs/promises';

async function restoreFinanceHub() {
    console.log('--- Restoring Finance Hub Tables ---');

    // 1. Restore card_approvals from recovered JSON
    try {
        const recoveredData = JSON.parse(await fs.readFile('recovered_card_approvals.json', 'utf-8'));
        const schema = [
            { name: 'date', type: 'TEXT' },
            { name: 'merchant', type: 'TEXT' },
            { name: 'amount', type: 'INTEGER' },
            { name: 'user', type: 'TEXT' },
            { name: 'metadata', type: 'TEXT' },
            { name: '__created_at', type: 'TEXT' },
            { name: '__updated_at', type: 'TEXT' },
            { name: '__creator_id', type: 'TEXT' }
        ];

        console.log(`Restoring card_approvals with ${recoveredData.length} rows...`);
        try { await deleteTable('card_approvals'); } catch (e) {}
        
        await createTable('신용카드 거래 내역 (FinanceHub)', schema, { tableName: 'card_approvals' });
        
        const rowsToInsert = recoveredData.map((r: any) => ({
            date: r.approvalDate,
            merchant: r.merchantName,
            amount: r.amount,
            user: '시스템',
            metadata: JSON.stringify({ cardNumber: r.cardNumber }),
            __created_at: new Date().toISOString(),
            __updated_at: new Date().toISOString(),
            __creator_id: 'system'
        }));

        await insertRows('card_approvals', rowsToInsert);
        console.log('Successfully restored card_approvals');

        // Update table_master
        const tableMasterRows = await queryTable('table_master', { filters: { tableName: 'card_approvals' } });
        if (tableMasterRows.length === 0) {
            await insertRows('table_master', [{
                tableName: 'card_approvals',
                displayName: '신용카드 거래 내역 (FinanceHub)',
                category: 'Finance',
                description: '통합 신용카드 승인 내역 (복구됨)',
                isSystemTable: 1,
                schema: JSON.stringify(schema),
                createdAt: new Date().toISOString()
            }]);
        } else {
            await updateRows('table_master', {
                displayName: '신용카드 거래 내역 (FinanceHub)',
                schema: JSON.stringify(schema),
                updatedAt: new Date().toISOString()
            }, { filters: { tableName: 'card_approvals' } });
        }
    } catch (err) {
        console.error('Failed to restore card_approvals:', err);
    }

    // 2. Fix dashboard_master pointers
    const financeReports = [
        { id: 1, tableName: 'card_approvals' },
        { id: 3, tableName: 'hometax_sales_tax_invoices' },
        { id: 4, tableName: 'hometax_sales_invoices' },
        { id: 5, tableName: 'hometax_purchase_tax_invoices' },
        { id: 6, tableName: 'hometax_purchase_invoices' },
        { id: 7, tableName: 'hometax_cash_receipts' },
        { id: 8, tableName: 'promissory_notes' }
    ];

    for (const report of financeReports) {
        try {
            await updateRows('dashboard_master', {
                tableName: report.tableName,
                updatedAt: new Date().toISOString()
            }, { filters: { id: String(report.id) } });
            console.log(`Updated dashboard_master for report ${report.id} -> ${report.tableName}`);
        } catch (err) {
            console.error(`Failed to update dashboard_master for report ${report.id}:`, err);
        }
    }

    // 3. Clean up orphaned table_master entries (the tb_ ones for these reports)
    const allTableMaster = await queryTable('table_master');
    const toDelete = allTableMaster.filter((t: any) => 
        (t.tableName.startsWith('tb_card_approvals') || 
         t.tableName.startsWith('tb_hometax') || 
         t.tableName.startsWith('tb_promissory_notes')) &&
        t.tableName !== 'card_approvals'
    );

    for (const t of toDelete) {
        console.log(`Cleaning up orphaned table_master entry: ${t.tableName}`);
        await deleteRows('table_master', { filters: { tableName: t.tableName } });
    }

    console.log('--- Restoration Complete ---');
}

restoreFinanceHub();
