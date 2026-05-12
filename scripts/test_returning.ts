import { executeSQL } from './egdesk-helpers.ts';

async function test() {
    try {
        const now = new Date().toISOString();
        const sql = `INSERT INTO micro_app_projects (name, sources, status, createdBy, createdAt, updatedAt) 
                     VALUES ('Test RETURNING', '[]', 'DRAFT', '1', '${now}', '${now}') 
                     RETURNING id`;
        const res = await executeSQL(sql);
        console.log("SQL Result:", JSON.stringify(res, null, 2));
    } catch (e: any) {
        console.error("SQL failed:", e.message);
    }
}

test();
