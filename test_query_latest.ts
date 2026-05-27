// test_query_latest.ts
import { queryBankProductTable } from './egdesk-helpers';

async function testQueryLatest() {
  const tableSlug = 'ibk_loan_transactions';
  
  console.log(`>>> [테스트] 1. 일반 queryBankProductTable 호출 (limit: 5)`);
  try {
    const normalRes = await queryBankProductTable({
      tableSlug,
      limit: 5
    });
    console.log('일반 쿼리 행 개수:', normalRes.rows?.length);
    if (normalRes.rows && normalRes.rows.length > 0) {
      console.log('첫 번째 행 샘플 (일반):', {
        account_number: normalRes.rows[0].account_number,
        transaction_date: normalRes.rows[0].transaction_date,
        loan_balance: normalRes.rows[0].loan_balance
      });
    }
  } catch (error: any) {
    console.error('일반 쿼리 실패:', error.message);
  }

  console.log('\n>>> [테스트] 2. latestOnly: true 옵션을 추가하여 queryBankProductTable 호출 (limit: 5)');
  try {
    const latestRes = await queryBankProductTable({
      tableSlug,
      limit: 5,
      // @ts-ignore
      latestOnly: true
    });
    console.log('latestOnly 쿼리 응답 결과:');
    console.log('총 매칭 개수:', latestRes.totalMatching);
    console.log('반환된 행 개수:', latestRes.rows?.length);
    if (latestRes.rows && latestRes.rows.length > 0) {
      latestRes.rows.forEach((row: any, i: number) => {
        console.log(`행 [${i + 1}]:`, {
          account_number: row.account_number,
          transaction_date: row.transaction_date,
          loan_balance: row.loan_balance,
          synced_at: row.synced_at
        });
      });
    }
  } catch (error: any) {
    console.error('latestOnly 쿼리 실패:', error.message);
  }
}

testQueryLatest();
