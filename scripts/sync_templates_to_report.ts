import { queryTable, insertRows, listTables } from './egdesk-helpers.ts';
import { INDUSTRY_TEMPLATES } from './src/lib/constants/industry-templates.ts';

async function syncTemplates() {
  try {
    console.log('--- Starting Template Sync to Report Table ---');
    
    // 1. Get existing physical tables
    const tableResult = await listTables();
    const tableInfoList = Array.isArray(tableResult) ? tableResult : (tableResult?.tables || []);
    const existingPhysicalTableNames = tableInfoList.map((t: any) => t.tableName);
    console.log(`Found ${existingPhysicalTableNames.length} physical tables in DB.`);

    // 2. Identify which templates have physical tables
    const templatesToRegister = INDUSTRY_TEMPLATES.filter((tpl: any) => 
      existingPhysicalTableNames.includes(tpl.id)
    );
    console.log(`Found ${templatesToRegister.length} matching templates ready to be registered.`);

    if (templatesToRegister.length === 0) {
      console.log('No matching physical tables found for templates.');
      return;
    }

    // 3. Prepare rows for 'report' table
    const now = new Date().toISOString();
    const reportRows = templatesToRegister.map((tpl: any) => {
      const columns = tpl.schema.map((col: any) => ({
        id: col.name,
        name: col.displayName,
        type: col.type.toLowerCase() === 'integer' || col.type.toLowerCase() === 'real' ? 'number' : 'string',
        isRequired: col.notNull || false,
      }));

      return {
        id: tpl.id,
        name: tpl.displayName,
        sheetName: tpl.displayName,
        description: tpl.description,
        tableName: tpl.id,
        columns: JSON.stringify(columns),
        uiConfig: JSON.stringify({ category: tpl.category }),
        aiConfig: JSON.stringify({}),
        isDeleted: 0,
        ownerId: 'admin',
        lastSerial: 0,
        createdAt: now,
        updatedAt: now
      };
    });

    // 4. Insert into 'report' table
    console.log(`Checking existing reports in registry...`);
    const reportResult = await queryTable('report', { limit: 1000 }).catch(() => []);
    const existingReports = Array.isArray(reportResult) ? reportResult : (reportResult?.rows || []);
    const existingReportIds = new Set(existingReports.map((r: any) => r.id));
    
    const finalRowsToInsert = reportRows.filter((row: any) => !existingReportIds.has(row.id));
    
    if (finalRowsToInsert.length > 0) {
        console.log(`Inserting ${finalRowsToInsert.length} new reports into 'report' table...`);
        await insertRows('report', finalRowsToInsert);
        console.log(`✓ Successfully registered ${finalRowsToInsert.length} new reports.`);
    } else {
        console.log('All matching templates are already registered in the "report" table.');
    }

  } catch (err) {
    console.error('Error during template sync:', err);
  }
}

syncTemplates();
