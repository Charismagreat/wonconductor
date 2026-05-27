// test_run_studio_query_variations.ts
import { runAITool } from './src/lib/ai-tools';

async function testVariations() {
  const tableIds = [
    'bank-product:bank-product:woori_b2b_loan_executions',
    'bank-product:woori:woori_b2b_loan_executions:1'
  ];

  for (const tableId of tableIds) {
    console.log(`\n==================================================`);
    console.log(`>>> [테스트] run_studio_data_query 호출`);
    console.log(`파라미터 - intent: "list", tableId: "${tableId}"`);
    console.log(`==================================================`);

    try {
      const res = await runAITool('run_studio_data_query', {
        intent: 'list',
        tableId,
        limit: 10
      });

      console.log(`응답 결과 타입: ${typeof res}`);
      console.log(`응답 결과 Array 여부: ${Array.isArray(res)}`);
      console.log(`반환된 행 개수: ${res?.length || 0}건`);
      if (Array.isArray(res) && res.length > 0) {
        console.log('데이터 샘플 (첫 2개 행):', JSON.stringify(res.slice(0, 2), null, 2));
      } else {
        console.log('응답 내용:', JSON.stringify(res, null, 2));
      }
    } catch (error: any) {
      console.error('!!! 에러 발생:', error.message);
    }
  }
}

testVariations();
