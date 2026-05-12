const { executeSQL } = require('./src/egdesk-helpers');

async function test() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';
    
    const queries = [
        "SELECT COUNT(*) FROM report_row WHERE isDeleted = 0",
        "SELECT * FROM report_row ORDER BY createdAt DESC LIMIT 1",
        "SELECT u.fullName FROM \"user\" u LIMIT 1",
        "SELECT rr.id FROM report_row rr JOIN report r ON rr.reportId = r.id WHERE rr.isDeleted = 0 ORDER BY rr.createdAt DESC LIMIT 1"
    ];

    for (const q of queries) {
        try {
            console.log(`Testing: ${q}`);
            const result = await executeSQL(q);
            console.log(`  Success! (${Array.isArray(result) ? result.length : 'OK'})`);
        } catch (e) {
            console.error(`  Failed: ${e.message}`);
        }
    }
}

test();
