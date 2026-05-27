// test_query_banking.ts
import { queryBankProductTable } from './egdesk-helpers';

async function testQueryBanking() {
  const tableSlug = 'ibk_loan_transactions';
  console.log(`>>> [테스트] ${tableSlug} 테이블 데이터 쿼리 중...`);
  try {
    const res = await queryBankProductTable({
      tableSlug,
      limit: 10
    });
    console.log('--------------------------------------------------');
    console.log('쿼리 응답 결과:');
    console.log(JSON.stringify(res, null, 2));
    console.log('--------------------------------------------------');
  } catch (error: any) {
    console.error('!!! 테스트 중 에러 발생:', error.message);
  }
}

testQueryBanking();
