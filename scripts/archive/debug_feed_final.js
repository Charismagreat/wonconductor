const { executeSQL } = require('./src/egdesk-helpers');

const query = `
    SELECT 
        "rr"."id",
        "rr"."reportId",
        "rr"."data",
        "rr"."createdAt",
        "r"."name" as "reportName",
        "u"."fullName" as "creatorName"
    FROM "report_row" "rr"
    JOIN "report" "r" ON "rr"."reportId" = "r"."id"
    LEFT JOIN "user" "u" ON "rr"."creatorId" = "u"."id"
    WHERE CAST("rr"."isDeleted" AS INTEGER) = 0
    ORDER BY "rr"."createdAt" DESC
    LIMIT 20
`;

async function test() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';
    
    try {
        console.log("Executing quoted query...");
        const result = await executeSQL(query);
        console.log("DONE! Rows fetched:", result.rows.length);
    } catch (e) {
        console.error("FAILED EVEN WITH QUOTING:", e.message);
    }
}

test();
