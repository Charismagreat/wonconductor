const { executeSQL } = require('./src/egdesk-helpers');

async function test() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';
    
    try {
        console.log("Testing isDeleted = '0'...");
        const res1 = await executeSQL("SELECT COUNT(*) FROM report_row WHERE isDeleted = '0'");
        console.log("Success with string '0'!");
    } catch (e) {
        console.error("Failed with '0':", e.message);
    }

    try {
        console.log("Testing isDeleted = 0...");
        const res2 = await executeSQL("SELECT COUNT(*) FROM report_row WHERE isDeleted = 0");
        console.log("Success with int 0!");
    } catch (e) {
        console.error("Failed with 0:", e.message);
    }
}

test();
