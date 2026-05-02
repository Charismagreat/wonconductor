import { queryTable, updateRows } from '../egdesk-helpers';

async function hideSystemColumns() {
    console.log('--- Hiding System Columns in UI ---');

    try {
        const res = await queryTable('dashboard_master', { limit: 1000 });
        // Since we are using the root egdesk-helpers, res is the object {rows, total, ...}
        const reports = res.rows || [];
        console.log(`Found ${reports.length} reports.`);

        const systemFields = ['id', 'projectId', '__created_at', '__updated_at', '__creator_id', '데이터ID'];

        for (const report of reports) {
            if (!report.columns) continue;

            let columns: any[];
            try {
                columns = JSON.parse(report.columns);
            } catch (e) {
                continue;
            }

            let changeCount = 0;
            const updatedColumns = columns.map(col => {
                if (systemFields.includes(col.name)) {
                    if (!col.hidden) {
                        changeCount++;
                        return { ...col, hidden: true };
                    }
                }
                return col;
            });

            if (changeCount > 0) {
                console.log(`Hiding ${changeCount} system columns for report ${report.id} (${report.name})`);
                await updateRows('dashboard_master', {
                    columns: JSON.stringify(updatedColumns),
                    updatedAt: new Date().toISOString()
                }, { filters: { id: String(report.id) } });
            }
        }

        console.log('--- System Columns Hidden Successfully ---');
    } catch (err) {
        console.error('Error hiding system columns:', err);
    }
}

hideSystemColumns();
