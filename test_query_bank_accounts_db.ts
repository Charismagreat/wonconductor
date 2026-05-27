// test_query_bank_accounts_db.ts
import { queryTable } from './egdesk-helpers';

async function test() {
  console.log('>>> [테스트] bank_accounts 물리 테이블을 조회합니다...');
  try {
    const rowsRaw = await queryTable('bank_accounts', { limit: 100 });
    const rows = Array.isArray(rowsRaw) ? rowsRaw : (rowsRaw?.rows || []);
    console.log(`조회된 행 개수: ${rows.length}개`);
    rows.forEach((r: any, i: number) => {
      console.log(`[${i+1}] 일자: ${r.일자 || r.date}, 은행명: ${r.은행명 || r.bankName}, 계좌번호: ${r.계좌번호 || r.accountNumber}, 계좌명: ${r.계좌명 || r.accountName}, 잔액: ${r.잔액 || r.balance}`);
    });
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();
