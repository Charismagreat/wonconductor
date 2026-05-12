const { executeSQL } = require('./src/egdesk-helpers');

async function test() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';
    
    try {
        console.log("Selecting all from report_row...");
        const result = await executeSQL("SELECT * FROM report_row LIMIT 1");
        console.log("Results count:", result.rows.length);
        if (result.rows.length > 0) {
            console.log("Columns in result:", Object.keys(result.rows[0]));
            console.log("Values:", JSON.stringify(result.rows[0], null, 2));
        }
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

test();
