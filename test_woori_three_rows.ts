// test_woori_three_rows.ts
import { runAITool } from './src/lib/ai-tools';

async function testWooriThreeRows() {
  const tableId = 'bank-product:woori:woori_b2b_loan_executions:1';
  console.log(`>>> [테스트] startDate: "2026-04-20" 조건으로 '${tableId}' 조회를 시도합니다.`);

  try {
    const res = await runAITool('run_studio_data_query', {
      intent: 'list',
      tableId,
      startDate: '2026-04-20',
      limit: 10
    });

    console.log('--------------------------------------------------');
    console.log(`조회 결과 개수: ${res?.length || 0}건`);
    console.log('--------------------------------------------------');
    
    if (Array.isArray(res)) {
      res.forEach((row: any, i: number) => {
        console.log(`  [${i + 1}] ID: ${row.id}, 채권번호: ${row.receivable_number}, 수취일자: ${row.received_date}, 대출원금: ${row.applied_amount}, rn: ${row.rn}`);
      });
    }
  } catch (error: any) {
    console.error('에러:', error.message);
  }
}

testWooriThreeRows();
