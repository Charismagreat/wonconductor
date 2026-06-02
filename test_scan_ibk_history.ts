// test_scan_ibk_history.ts
import { queryTable } from './egdesk-helpers';

async function test() {
  console.log('>>> [테스트] ibk_loan_history 테이블의 모든 계좌번호를 스캔합니다...');
  try {
    const { queryBankProductTable } = require('./egdesk-helpers');
    const res = await queryBankProductTable({ tableSlug: 'ibk_loan_history', limit: 500 });
    const rows = Array.isArray(res) ? res : (res?.rows || []);
    
    console.log(`총 행 수: ${rows.length}개`);
    const uniqueAccs = new Set(rows.map((r: any) => r.account_number || r.accountNumber || '공란'));
    console.log('실제 들어있는 고유 계좌번호 목록:', Array.from(uniqueAccs));
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();
