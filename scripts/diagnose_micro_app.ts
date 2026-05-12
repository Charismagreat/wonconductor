import { getTableSchema, queryTable, deleteTable } from './egdesk-helpers.ts';

async function main() {
    try {
        const tables = ['micro_app_projects', 'micro_app_config', 'dashboard_master', 'dashboard_data'];

        for (const tableName of tables) {
            console.log(`\nDiagnosing ${tableName}...`);
            try {
                const schema: any = await getTableSchema(tableName);
                console.log("Schema:", JSON.stringify(schema, null, 2));

                const rows = await queryTable(tableName, { limit: 5 });
                console.log("Rows count:", rows.length);

                if (rows.length === 0) {
                    console.log("Table is empty.");
                } else {
                    console.log("First row:", JSON.stringify(rows[0], null, 2));
                }
            } catch (e: any) {
                console.log(`${tableName} check failed or table missing:`, e.message);
            }
        }

    } catch (err: any) {
        console.error("Diagnostic failed:", err.message);
    }
}

main();
