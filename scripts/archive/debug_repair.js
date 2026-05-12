const { repairVirtualTableAction } = require('./src/app/actions');

async function debug() {
    const reportId = 'YOUR_REPORT_ID_HERE'; // 실사용 ID로 교체 필요
    try {
        console.log('Starting repair debugging...');
        const result = await repairVirtualTableAction(reportId);
        console.log('Result:', result);
    } catch (err) {
        console.error('FAILED with error:', err);
    }
}
// 실제 실행은 하지 않고 구조만 확인
