const { callUserDataTool } = require('./src/egdesk-helpers');

async function main() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';

    const reportId = 'rep-card-' + Date.now();
    const reportName = '법인카드 사용 내역';
    
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
        console.log(`Registering report '${reportName}' with full schema...`);
        const now = new Date().toISOString();
        const result = await callUserDataTool('user_data_insert_rows', {
            tableName: 'report',
            rows: [{
                id: reportId,
                name: reportName,
                description: '법인 신용카드 영수증 분석 및 증빙 보고',
                tableName: 'report_row', // 모든 데이터는 공통 테이블에 저장 (가상화 레이어)
                columns: JSON.stringify(columns),
                ownerId: 'system-admin', // 기본 관리자 ID
                isDeleted: 0,
                createdAt: now,
                updatedAt: now
            }]
        });
        
        if (result.success && result.inserted > 0) {
            console.log("Successfully registered Corporate Card Receipt report.");
        } else {
            console.log("Registration result:", JSON.stringify(result, null, 2));
        }
    } catch (e) {
        console.error("Failed to register report:", e.message);
    }
}

main();
