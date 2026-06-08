// test_find_widget_by_title.ts
import { queryTable } from './egdesk-helpers';

async function test() {
  console.log('>>> [테스트] bank_accounts DB 테이블의 원본 데이터를 조회합니다...');
  try {
    const accountsRaw = await queryTable('bank_accounts', { limit: 100 });
    const accounts = Array.isArray(accountsRaw) ? accountsRaw : (accountsRaw?.rows || []);
    console.log(`원본 계좌 개수: ${accounts.length}개`);
    
    accounts.forEach((acc: any) => {
      const isLoan = acc.accountType === 'loan' || String(acc.accountName || '').includes('대출') || acc.isLoan === true;
      if (isLoan) {
        console.log(`[대출 계좌]`);
        console.log(`  id: ${acc.id}`);
        console.log(`  은행명: ${acc.은행명 || acc.bankId || acc.bankName}`);
        console.log(`  계좌번호: ${acc.계좌번호 || acc.accountNumber}`);
        console.log(`  계좌명: ${acc.계좌명 || acc.accountName}`);
        console.log(`  잔액: ${acc.잔액 || acc.balance}`);
        console.log(`  약정금액/limit: ${acc.약정금액 || acc.limit}`);
        console.log(`  사용가능한도: ${acc.사용가능한도 || acc.availableLimit}`);
        console.log(`  accountType: ${acc.accountType}`);
        console.log(`  isLoan: ${acc.isLoan}`);
        console.log('  -----------------------------------------');
      }
    });
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();
