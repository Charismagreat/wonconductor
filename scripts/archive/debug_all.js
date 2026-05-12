const { executeSQL } = require('./src/egdesk-helpers');

async function test() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';
    
    try {
        console.log("Fetching all report_rows...");
        const result = await executeSQL("SELECT * FROM report_row");
        console.log("Success! Total rows:", result.rows.length);
    } catch (e) {
        console.error("FAILED even for SELECT * FROM report_row:", e.message);
    }
}

test();
