const { callUserDataTool } = require('./src/egdesk-helpers');

async function main() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';

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
        console.log(`Registering report '${reportName}' via user_data_insert_rows...`);
        const now = new Date().toISOString();
        const result = await callUserDataTool('user_data_insert_rows', {
            tableName: 'report',
            rows: [{
                id: 'rep-card-receipt-' + Date.now(), 
                name: reportName,
                description: description,
                columns: JSON.stringify(columns),
                createdAt: now,
                updatedAt: now,
                isDeleted: 0
            }]
        });
        console.log("Successfully registered report:", result);
    } catch (e) {
        console.error("Failed to register report via tool:", e.message);
    }
}

main();
