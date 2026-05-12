const { executeSQL } = require('./src/egdesk-helpers');

async function test() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';
    
    try {
        console.log("Simple query...");
        const res1 = await executeSQL("SELECT * FROM report_row LIMIT 1");
        console.log("report_row success:", !!res1);

        console.log("Joining report_row and report...");
        const res2 = await executeSQL("SELECT rr.*, r.name FROM report_row rr JOIN report r ON rr.reportId = r.id LIMIT 1");
        console.log("Join 1 success:", !!res2);

        console.log("Full join...");
        const res3 = await executeSQL("SELECT rr.*, r.name, u.fullName FROM report_row rr JOIN report r ON rr.reportId = r.id LEFT JOIN user u ON rr.creatorId = u.id LIMIT 1");
        console.log("Full join success:", !!res3);

    } catch (e) {
        console.error("Error during test:", e.message);
    }
}

test();
