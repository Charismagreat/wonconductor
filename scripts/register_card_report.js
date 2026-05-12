const { executeSQL, callUserDataTool } = require('./src/egdesk-helpers');

async function main() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';

    const reportId = 'rep-card-receipt';
    const reportName = '법인카드 사용 내역';
    const description = '법인이 보유한 신용카드의 영수증 사진을 분석하여 사용 내역을 자동 기록합니다.';
    
    const columns = [
        { name: "사용일시", type: "DATE" },
        { name: "가맹점명", type: "TEXT" },
        { name: "사용금액", type: "NUMBER" },
        { name: "카드 종류", type: "TEXT" },
        { name: "카드 번호", type: "TEXT" },
        { name: "지출목적", type: "TEXT" },
        { name: "승인번호", type: "TEXT" }
    ];

    try {
        console.log(`Checking if report '${reportName}' already exists...`);
        const existing = await executeSQL(`SELECT id FROM report WHERE id = '${reportId}' OR name = '${reportName}'`);
        
        if (existing.rows && existing.rows.length > 0) {
            console.log("Report already exists. Updating schema...");
            await executeSQL(`UPDATE report SET columns = '${JSON.stringify(columns)}', description = '${description}' WHERE id = '${existing.rows[0].id}'`);
        } else {
            console.log("Creating new report...");
            // report 테이블 컬럼: id, name, description, columns, createdAt, updatedAt, isDeleted
            const now = new Date().toISOString();
            const sql = `
                INSERT INTO report (id, name, description, columns, createdAt, updatedAt, isDeleted)
                VALUES (
                    '${reportId}', 
                    '${reportName}', 
                    '${description}', 
                    '${JSON.stringify(columns)}', 
                    '${now}', 
                    '${now}', 
                    0
                )
            `;
            await executeSQL(sql);
        }
        console.log("Successfully registered Corporate Card Receipt report.");
    } catch (e) {
        console.error("Failed to register report:", e.message);
    }
}

main();
