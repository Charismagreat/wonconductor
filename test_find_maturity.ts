// test_find_maturity.ts
import { queryBankProductTable } from './egdesk-helpers';

async function findMaturity() {
  const tableSlug = 'woori_b2b_loan_executions';
  console.log(`>>> [테스트] '${tableSlug}' 테이블에서 5월, 6월, 7월 만기 데이터를 조사합니다.`);

  try {
    const res = await queryBankProductTable({
      tableSlug,
      limit: 100
    });

    const rows = res.rows || [];
    console.log(`전체 행 개수: ${rows.length}건`);
    console.log('--------------------------------------------------');
    
    // 만기일 컬럼이 2026년인 데이터를 필터링하고 분석
    const targetRows = rows.filter((r: any) => {
      const matDate = r.receivable_maturity_date || r.loan_maturity_date || '';
      return matDate.startsWith('2026-05') || matDate.startsWith('2026-06') || matDate.startsWith('2026-07');
    });

    console.log(`5월, 6월, 7월 만기 대상 데이터 개수: ${targetRows.length}건`);
    targetRows.forEach((row: any, i: number) => {
      console.log(`  [${i + 1}] ID: ${row.id}`);
      console.log(`    채권번호(receivable_number): ${row.receivable_number}`);
      console.log(`    수취일자(received_date): ${row.received_date}`);
      console.log(`    채권만기일(receivable_maturity_date): ${row.receivable_maturity_date}`);
      console.log(`    대출만기일(loan_maturity_date): ${row.loan_maturity_date}`);
      console.log(`    대출원금: ${row.applied_amount}, 잔액: ${row.loan_balance}`);
    });
    console.log('--------------------------------------------------');

  } catch (error: any) {
    console.error(error.message);
  }
}

findMaturity();
