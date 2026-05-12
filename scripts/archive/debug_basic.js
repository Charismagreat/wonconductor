const { executeSQL } = require('./src/egdesk-helpers');

async function test() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';
    
    try {
        console.log("Testing COUNT(*) without WHERE...");
        const res1 = await executeSQL("SELECT COUNT(*) FROM report_row");
        console.log("Success! Result:", JSON.stringify(res1));
    } catch (e) {
        console.error("Failed without WHERE:", e.message);
    }

    try {
        console.log("Testing SELECT id, isDeleted FROM report_row LIMIT 1...");
        const res2 = await executeSQL("SELECT id, isDeleted FROM report_row LIMIT 1");
        console.log("Success! Result:", JSON.stringify(res2));
    } catch (e) {
        console.error("Failed select:", e.message);
    }
}

test();
