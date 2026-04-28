import { queryTable, executeSQL } from './egdesk-helpers.ts';

async function check() {
    try {
        console.log("--- micro_app_projects count ---");
        const res1 = await queryTable('micro_app_projects', { limit: 1 });
        console.log("Count:", res1.length);

        console.log("\n--- micro_app_config count ---");
        const res2 = await queryTable('micro_app_config', { limit: 1 });
        console.log("Count:", res2.length);

        console.log("\n--- micro_app_projects schema ---");
        const schema = await executeSQL("PRAGMA table_info(micro_app_projects)");
        console.log(JSON.stringify(schema, null, 2));
    } catch (e: any) {
        console.error("Error checking tables:", e.message);
    }
}

check();
