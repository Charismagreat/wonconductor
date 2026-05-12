
import { 
  queryTaxInvoices,
  listBankConnections
} from './egdesk-helpers.ts';

async function finalAuditAttempt() {
  console.log('>>> [FinanceHub Audit] 마지막 전수 조사를 시작합니다...');
  
  try {
    // 1. 우선 연결된 계좌/사업자가 있는지 확인
    console.log('\n--- [Bank Connections] 조회 중... ---');
    const connections = await listBankConnections();
    console.log('연결 정보:', JSON.stringify(connections, null, 2));

    // 2. 세금계산서 무조건 조회 (필터 최소화)
    console.log('\n--- [Tax Invoices] 무필터 조회 중... ---');
    const res = await queryTaxInvoices({ limit: 100, offset: 0 });
    const rows = Array.isArray(res) ? res : (res?.rows || res?.data || []);
    
    if (rows.length > 0) {
      console.log(`성공! 실제 컬럼 목록:`);
      console.log(Object.keys(rows[0]).join(', '));
      console.log('첫 번째 행 샘플:', JSON.stringify(rows[0], null, 2));
    } else {
      console.log('결과: 여전히 데이터가 0건입니다. (서버 응답:', JSON.stringify(res, null, 2), ')');
    }

  } catch (error: any) {
    console.error('!!! 최종 시도 중 에러 발생:', error.message);
  }
}

finalAuditAttempt();
