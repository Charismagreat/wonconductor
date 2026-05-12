const { callUserDataTool } = require('./src/egdesk-helpers');

async function main() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';

    const now = new Date().toISOString();
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
        const result = await callUserDataTool('user_data_insert_rows', {
            tableName: 'report',
            rows: [{
                id: 'rep-card-receipt',
                name: '법인카드 사용 내역',
                description: '법인 신용카드 영수증 분석 및 증빙 보고',
                tableName: 'report_row',
                columns: JSON.stringify(columns),
                ownerId: 'system-admin',
                isDeleted: 0,
                lastSerial: 0,
                createdAt: now,
                updatedAt: now
            }]
        });
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main();
