import { insertRows } from './egdesk-helpers.ts';

async function test() {
    try {
        const now = new Date().toISOString();
        const data = {
            name: "Test " + Date.now(),
            sources: "[]",
            status: "DRAFT",
            createdBy: "1",
            createdAt: now,
            updatedAt: now
        };
        const res = await insertRows('micro_app_projects', [data]);
        console.log("Insert Result:", JSON.stringify(res, null, 2));
    } catch (e: any) {
        console.error("Insert failed:", e.message);
    }
}

test();
