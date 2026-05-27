// test_analyze_april.ts
import { queryBankProductTable } from './egdesk-helpers';

async function testAnalyzeApril() {
  const tableSlug = 'woori_b2b_loan_executions';
  try {
    const res = await queryBankProductTable({ tableSlug, limit: 100 });
    const aprilRows = (res.rows || []).filter((r: any) => r.received_date === '2026-04-20');
    
    console.log(`>>> [분석] 2026-04-20 수취일 데이터 분석 (총 ${aprilRows.length}건):`);
    aprilRows.forEach((row: any, i: number) => {
      console.log(`  Row [${i + 1}] ID: ${row.id}`);
      console.log(`    채권번호(receivable_number): ${row.receivable_number}`);
      console.log(`    대출원금: ${row.applied_amount}`);
      console.log(`    생성일자(created_at): ${row.created_at}`);
      console.log(`    갱신일자(updated_at): ${row.updated_at}`);
    });
  } catch (error: any) {
    console.error(error.message);
  }
}

testAnalyzeApril();
