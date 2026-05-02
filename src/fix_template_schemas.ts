import { queryTable, updateRows, insertRows, listTables } from './egdesk-helpers.ts';
import { INDUSTRY_TEMPLATES } from './lib/constants/industry-templates.ts';

async function fixTemplates() {
    try {
        console.log("Fixing template schemas and data...");

        const reports = await queryTable('dashboard_master');
        const res = await listTables();
        const existingTables = Array.isArray(res) ? res : (res.tables || []);

        for (const template of INDUSTRY_TEMPLATES) {
            // Flexible matching for reportId
            const report = reports.find((r: any) => 
                r.reportId === template.id || 
                r.reportId === `rep-${template.id}` ||
                r.reportId === template.id.replace('tpl_', '')
            );
            
            if (!report) continue;

            console.log(`Processing template: ${template.displayName} (${report.reportId})`);

            // 1. Prepare columns JSON
            const columns = template.schema.map(s => ({
                name: s.name,
                displayName: s.displayName,
                type: s.type.toLowerCase() === 'real' ? 'number' : s.type.toLowerCase(),
                isSystem: false
            }));

            // Add system columns
            columns.push(
                { name: '__created_at', displayName: '생성일시', type: 'date', isSystem: true },
                { name: '__updated_at', displayName: '수정일시', type: 'date', isSystem: true },
                { name: '__creator_id', displayName: '작성자', type: 'string', isSystem: true }
            );

            // 2. Update dashboard_master
            await updateRows('dashboard_master', {
                columns: JSON.stringify(columns)
            }, { filters: { reportId: report.reportId } });

            // 3. Restore initial data if table is empty
            const physicalTable = report.tableName;
            if (physicalTable && existingTables.includes(physicalTable)) {
                try {
                    const data = await queryTable(physicalTable, { limit: 1 });
                    if (data.length === 0 && template.initialData) {
                        console.log(`  Restoring initial data for ${physicalTable}...`);
                        const rowsToInsert = template.initialData.map(d => ({
                            ...d,
                            __created_at: new Date().toISOString(),
                            __updated_at: new Date().toISOString(),
                            __creator_id: 'system'
                        }));
                        await insertRows(physicalTable, rowsToInsert);
                    }
                } catch (e) {
                    console.error(`  Failed to query or insert into ${physicalTable}:`, e.message);
                }
            }
        }

        console.log("Template fix completed.");

    } catch (err) {
        console.error("Fix failed:", err);
    }
}

fixTemplates();
