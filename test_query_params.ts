// test_query_params.ts
import { queryBankProductTable } from './egdesk-helpers';

async function testParams() {
  const tableSlug = 'ibk_loan_history';
  console.log(`>>> [테스트] ${tableSlug} 테이블에 대해 다양한 파라미터 테스트 진행`);

  const paramSets = [
    { name: '기본 쿼리', params: { tableSlug } },
    { name: 'latestOnly: true', params: { tableSlug, latestOnly: true } },
    { name: 'onlyLatest: true', params: { tableSlug, onlyLatest: true } },
    { name: 'latest: true', params: { tableSlug, latest: true } },
    { name: 'isLatest: true', params: { tableSlug, isLatest: true } },
  ];

  for (const set of paramSets) {
    console.log(`\n--- 테스트 대상: ${set.name} ---`);
    try {
      // @ts-ignore
      const res = await queryBankProductTable(set.params);
      console.log(`결과 - 총 매칭: ${res.totalMatching}, 반환된 행: ${res.rows?.length || 0}`);
      if (res.rows && res.rows.length > 0) {
        console.log(`첫 2개 행:`, res.rows.slice(0, 2).map((r: any) => ({
          account_number: r.account_number,
          transaction_date: r.transaction_date,
          amount: r.amount || r.transaction_amount || r.loan_balance,
          synced_at: r.synced_at
        })));
      }
    } catch (error: any) {
      console.error(`실패:`, error.message);
    }
  }
}

testParams();
