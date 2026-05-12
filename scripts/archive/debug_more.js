const { executeSQL } = require('./src/egdesk-helpers');

async function test() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';
    
    try {
        console.log("SELECT updatedAt...");
        await executeSQL("SELECT updatedAt FROM report_row LIMIT 1");
        console.log("updatedAt OK");

        console.log("SELECT isDeleted...");
        await executeSQL("SELECT isDeleted FROM report_row LIMIT 1");
        console.log("isDeleted OK");

    } catch (e) {
        console.error("Failed:", e.message);
    }
}

test();
