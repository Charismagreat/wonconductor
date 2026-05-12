import { listTables } from './egdesk-helpers.ts';

async function check() {
    try {
        const res = await listTables();
        const tables = res.tables || res;
        console.log("Available Tables:", tables.map((t: any) => t.tableName || t));
        
        const tableNames = tables.map((t: any) => (t.tableName || t).toLowerCase());
        if (tableNames.includes('user')) {
            console.log("Table 'user' exists.");
        } else {
            console.log("Table 'user' is MISSING!");
        }
    } catch (err) {
        console.error("Failed to list tables:", err);
    }
}

check();
